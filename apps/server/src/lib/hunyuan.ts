import * as tencentcloud from "tencentcloud-sdk-nodejs";
import type { Message } from "tencentcloud-sdk-nodejs/tencentcloud/services/hunyuan/v20230901/hunyuan_models";

import { getEnv } from "../config/env";

const { hunyuan } = tencentcloud;

type HunyuanClient = InstanceType<typeof hunyuan.v20230901.Client>;

let hunyuanClient: HunyuanClient | null = null;

const getHunyuanClient = (): HunyuanClient => {
  if (hunyuanClient) {
    return hunyuanClient;
  }

  const env = getEnv();

  hunyuanClient = new hunyuan.v20230901.Client({
    credential: {
      secretId: env.TENCENT_SECRET_ID,
      secretKey: env.TENCENT_SECRET_KEY
    },
    region: env.TENCENT_HUNYUAN_REGION,
    profile: {
      httpProfile: {
        endpoint: "hunyuan.tencentcloudapi.com",
        proxy: ""
      }
    }
  });

  return hunyuanClient;
};

interface ChatOptions {
  temperature?: number;
  model?: string;
}

export const callHunyuanChat = async (
  messages: Message[],
  options: ChatOptions = {},
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
  }
): Promise<string> => {
  const env = getEnv();
  const client = getHunyuanClient();
  const model = options.model ?? env.TENCENT_HUNYUAN_MODEL;
  const temperature = options.temperature ?? 0.6;
  const { maxRetries = 0, baseDelay = 1000 } = retryOptions ?? {};

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Hunyuan] 重试 ${attempt}/${maxRetries}...`);
      } else {
        console.log(`[Hunyuan] ChatCompletions start -> model=${model}, temp=${temperature}`);
      }

      const response = await client.ChatCompletions({
        Model: model,
        Messages: messages,
        Stream: false,
        Temperature: temperature
      });

      const content = response?.Choices?.[0]?.Message?.Content?.trim();
      if (!content) {
        throw new Error("Hunyuan返回内容为空");
      }

      console.log(`[Hunyuan] ChatCompletions success -> model=${model}`);
      return content;
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.code === "LimitExceeded" || error.message?.includes("限频");
      const isRetryable = isRateLimit || (error.status >= 500 && error.status < 600);

      if (!isRetryable || attempt === maxRetries) {
        console.error("[Hunyuan] Chat调用失败:", error);
        throw error;
      }

      // 指数退避：限频错误使用更长的延迟
      const delay = isRateLimit ? baseDelay * Math.pow(2, attempt) * 2 : baseDelay * Math.pow(1.5, attempt);
      console.warn(`[Hunyuan] 限频或服务器错误，${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
