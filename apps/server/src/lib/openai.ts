import OpenAI from "openai";
import { getEnv } from "../config/env";

let openaiClient: OpenAI | null = null;

/**
 * OpenAI 客户端封装：后续用于生成词汇、课程内容、练习题。
 * 统一在这里实例化，便于未来替换或增加日志。
 */
export const getOpenAI = () => {
  if (!openaiClient) {
    const { OPENAI_API_KEY } = getEnv();
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      // 增强超时设置
      timeout: 120000, // 120秒超时（增加）
      // 添加重试配置
      maxRetries: 2,
      // 添加HTTP配置
      httpAgent: undefined, // 让Node.js自动管理
      // 添加基础URL重试
      baseURL: 'https://api.openai.com/v1',
      // 添加请求头优化
      defaultHeaders: {
        'User-Agent': 'Course-Generation-Worker/1.0'
      }
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
 * 带重试的OpenAI API调用包装器
 */
export const callOpenAIWithRetry = async <T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryCondition?: (error: any) => boolean;
  } = {}
): Promise<T> => {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 30000,
    retryCondition = (error: any) => {
      // 网络相关错误才重试
      return (
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('Connection error') ||
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.type === 'network_error' ||
        error.status === 429 || // Rate limit
        (error.status >= 500 && error.status < 600) // Server errors
      );
    }
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OpenAI] API调用尝试 ${attempt + 1}/${maxRetries + 1}`);

      // 在重试前检查网络连接
      if (attempt > 0) {
        const isNetworkOk = await checkNetworkConnectivity();
        if (!isNetworkOk) {
          console.warn(`[OpenAI] 网络连接检查失败，等待${baseDelay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, baseDelay));
        }
      }

      const result = await apiCall();

      if (attempt > 0) {
        console.log(`[OpenAI] API调用成功 (第${attempt + 1}次尝试)`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      console.warn(`[OpenAI] API调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, {
        message: error.message,
        code: error.code,
        status: error.status,
        type: error.type
      });

      // 如果不满足重试条件，直接抛出错误
      if (!retryCondition(error)) {
        throw error;
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        throw new Error(`OpenAI API调用失败，已重试${maxRetries}次。最后错误: ${error.message}`);
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      console.log(`[OpenAI] ${delay}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
