import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { emailService } from '../services/email';
import { getEnv } from '../config/env';

const router = Router();

// Redis客户端和回退存储
let redis: Redis | null = null;
let useRedisFallback = false;
const fallbackStorage = new Map<string, { data: any; expiresAt: number }>();

// 初始化Redis连接
function getRedis() {
  if (useRedisFallback) {
    return null;
  }

  if (!redis) {
    try {
      const env = getEnv();
      // 使用最兼容的构造方式，避免类型不匹配
      redis = new Redis(env.REDIS_URL);

      redis.on('error', (error) => {
        console.error('Redis连接错误，切换到内存存储:', error.message);
        useRedisFallback = true;
        redis = null;
      });

      redis.on('connect', () => {
        console.log('Redis连接成功');
      });
    } catch (error) {
      console.error('初始化Redis失败，使用内存存储:', error);
      useRedisFallback = true;
    }
  }
  return redis;
}

// 内存存储操作（回退方案）
async function setStorageValue(key: string, value: any, ttlSeconds: number): Promise<void> {
  if (useRedisFallback) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    fallbackStorage.set(key, { data: value, expiresAt });

    // 设置自动清理
    setTimeout(() => {
      fallbackStorage.delete(key);
    }, ttlSeconds * 1000);
    return;
  }

  const redisClient = getRedis();
  if (redisClient) {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  }
}

async function getStorageValue(key: string): Promise<any> {
  if (useRedisFallback) {
    const item = fallbackStorage.get(key);
    if (!item || Date.now() > item.expiresAt) {
      fallbackStorage.delete(key);
      return null;
    }
    return item.data;
  }

  const redisClient = getRedis();
  if (redisClient) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }
  return null;
}

async function deleteStorageKey(key: string): Promise<void> {
  if (useRedisFallback) {
    fallbackStorage.delete(key);
    return;
  }

  const redisClient = getRedis();
  if (redisClient) {
    await redisClient.del(key);
  }
}

// 生成6位随机验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 验证码存储键名前缀
const VERIFICATION_CODE_PREFIX = 'verification_code:';
const RATE_LIMIT_PREFIX = 'email_rate_limit:';

// Redis键名生成函数
function getVerificationCodeKey(email: string): string {
  return `${VERIFICATION_CODE_PREFIX}${email.toLowerCase()}`;
}

function getRateLimitKey(email: string): string {
  return `${RATE_LIMIT_PREFIX}${email.toLowerCase()}`;
}

// 发送验证码请求
const sendCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

// 验证验证码请求
const verifyCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().length(6, '验证码必须是6位数字'),
});

// 发送验证码
router.post('/send-code', async (req, res, next) => {
  try {
    const { email } = sendCodeSchema.parse(req.body);
    const emailLower = email.toLowerCase();

    // 检查1分钟内是否已发送过验证码
    const rateLimitKey = getRateLimitKey(emailLower);
    const lastSent = await getStorageValue(rateLimitKey);

    if (lastSent) {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      if (lastSent > oneMinuteAgo) {
        return res.status(429).json({
          success: false,
          message: '请等待1分钟后再次发送验证码',
        });
      }
    }

    // 生成验证码
    const code = generateVerificationCode();
    const verificationKey = getVerificationCodeKey(emailLower);

    // 存储验证码（5分钟过期）
    const verificationData = {
      code,
      attempts: 0,
      createdAt: Date.now(),
    };

    // 使用管道操作存储验证码和发送限制
    await Promise.all([
      setStorageValue(verificationKey, verificationData, 5 * 60), // 5分钟过期
      setStorageValue(rateLimitKey, Date.now(), 60), // 1分钟发送限制
    ]);

    // 发送邮件
    const emailSent = await emailService.sendVerificationCode(email, code);

    if (!emailSent) {
      // 清理已存储的验证码（保持逻辑一致）
      await Promise.all([
        deleteStorageKey(verificationKey),
        deleteStorageKey(rateLimitKey),
      ]);

      // 不再兜底，直接返回失败，前端应显示错误
      return res.status(500).json({
        success: false,
        message: '邮件发送失败，请稍后重试',
      });
    }

    res.json({
      success: true,
      message: '验证码已发送到您的邮箱，请查收',
    });
  } catch (error) {
    next(error);
  }
});

// 验证验证码并登录
router.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = verifyCodeSchema.parse(req.body);
    const emailLower = email.toLowerCase();

    // 查找验证码
    const verificationKey = getVerificationCodeKey(emailLower);
    const verification = await getStorageValue(verificationKey);

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: '验证码无效或已过期',
      });
    }

    // 检查验证码尝试次数
    if (verification.attempts >= 3) {
      await Promise.all([
        deleteStorageKey(verificationKey),
        deleteStorageKey(getRateLimitKey(emailLower)),
      ]);
      return res.status(429).json({
        success: false,
        message: '验证码尝试次数过多，请重新获取',
      });
    }

    // 增加尝试次数
    verification.attempts++;

    // 更新尝试次数
    await setStorageValue(verificationKey, verification, 5 * 60);

    // 验证验证码
    if (verification.code !== code) {
      return res.status(400).json({
        success: false,
        message: '验证码错误',
      });
    }

    // 删除已使用的验证码
    await deleteStorageKey(verificationKey);

    // 获取环境变量
    const env = getEnv();
    const jwtSecret = env.JWT_SECRET;

    // 使用邮箱作为唯一标识符，确保同一邮箱总是得到相同的用户ID
    const userId = 'email-' + Buffer.from(emailLower).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const token = jwt.sign(
      {
        id: userId,
        email,
        name: email.split('@')[0],
        loginType: 'email',
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: userId,
        name: email.split('@')[0],
        email,
        loginType: 'email',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
