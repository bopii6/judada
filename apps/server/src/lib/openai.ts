import OpenAI from "openai";
import { getEnv } from "../config/env";

let openaiClient: OpenAI | null = null;

/**
 * OpenAI 客户端封装：优化版本
 * 专注于性能和速度优化
 */
export const getOpenAI = () => {
  if (!openaiClient) {
    const { OPENAI_API_KEY } = getEnv();
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      // 减少超时时间以提高响应速度
      timeout: 60000, // 60秒超时（减少到合理范围）
      // 减少重试次数以提高速度
      maxRetries: 1,
      // 添加基础URL
      baseURL: 'https://api.openai.com/v1',
      // 优化的请求头
      defaultHeaders: {
        'User-Agent': 'Course-Gen-Worker/2.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      // HTTP连接优化
      httpAgent: undefined, // 自动管理连接池
      // 添加连接配置优化
      organization: undefined // 不设置组织，避免额外检查
    });
  }
  return openaiClient;
};

/**
 * 检查网络连接状态
 */
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve) => {
      const request = https.get('https://api.openai.com/v1/models', (res: any) => {
        resolve(res.statusCode === 200 || res.statusCode === 401); // 401也表示连接正常
      });

      request.on('error', () => {
        resolve(false);
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
};

/**
 * 优化的OpenAI API调用包装器 - 专注于速度
 * 减少重试次数和网络检查，更快失败
 */
export const callOpenAIWithRetry = async <T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    retryCondition?: (error: any) => boolean;
    timeout?: number;
  } = {}
): Promise<T> => {
  const {
    maxRetries = 2, // 减少重试次数
    baseDelay = 500, // 减少基础延迟
    timeout = 60000, // 添加超时参数
    retryCondition = (error: any) => {
      // 只对真正的网络错误和服务器错误重试，更快失败
      return (
        error.status === 429 || // Rate limit (总是重试)
        (error.status >= 500 && error.status < 600) || // Server errors
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout') ||
        error.type === 'network_error'
      );
    }
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      console.log(`[OpenAI Fast] API调用 ${attempt + 1}/${maxRetries + 1}`);

      // 为API调用添加超时包装
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API调用超时')), timeout);
      });

      const result = await Promise.race([apiCall(), timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(`[OpenAI Fast] API调用成功，耗时: ${duration}ms`);

      return result;
    } catch (error: any) {
      lastError = error;

      console.warn(`[OpenAI Fast] API调用失败 (${attempt + 1}/${maxRetries + 1}):`, {
        message: error.message,
        code: error.code,
        status: error.status,
        type: error.type
      });

      // 如果不满足重试条件，直接抛出错误
      if (!retryCondition(error) || attempt === maxRetries) {
        throw error;
      }

      // 快速重试延迟
      const delay = baseDelay * Math.pow(1.5, attempt); // 指数增长但更温和
      console.log(`[OpenAI Fast] ${delay}ms后快速重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * 流式API调用 - 用于实时反馈和更好的用户体验
 */
export const callOpenAIStream = async (
  apiCall: () => Promise<any>,
  onChunk?: (chunk: string) => void,
  options: { timeout?: number } = {}
): Promise<any> => {
  const { timeout = 60000 } = options;

  try {
    console.log('[OpenAI Stream] 开始流式API调用');
    const startTime = Date.now();

    // 包装API调用以支持超时
    const streamPromise = async () => {
      const response = await apiCall();

      if (response.choices?.[0]?.delta?.content && onChunk) {
        onChunk(response.choices[0].delta.content);
      }

      return response;
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('流式API调用超时')), timeout);
    });

    const result = await Promise.race([streamPromise(), timeoutPromise]);

    const duration = Date.now() - startTime;
    console.log(`[OpenAI Stream] 流式调用完成，耗时: ${duration}ms`);

    return result;
  } catch (error: any) {
    console.error('[OpenAI Stream] 流式调用失败:', error.message);
    throw error;
  }
};
