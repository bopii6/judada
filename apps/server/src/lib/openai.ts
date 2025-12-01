import https from "node:https";

import axios, { AxiosInstance } from "axios";

import { getEnv } from "../config/env";

type JsonSchemaFormat =
  | {
      type?: string;
      name?: string;
      schema?: Record<string, unknown>;
      strict?: boolean;
    }
  | undefined;

interface StructuredResponse<T = unknown> {
  id?: string;
  output_text: string;
  output_parsed: T | null;
  raw?: unknown;
}

interface ParseRequest {
  model?: string;
  instructions?: string;
  input?: string;
  text?: {
    format?: JsonSchemaFormat;
  };
  temperature?: number;
  top_p?: number;
}

interface AIClient {
  responses: {
    parse: (payload: ParseRequest) => Promise<StructuredResponse>;
  };
}

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const COMPLETIONS_PATH = "/chat/completions";

let cachedClient: AIClient | null = null;

const sanitizeBaseUrl = (url: string) => url.replace(/\/$/, "");

interface MessageContent {
  type: "text";
  text: string;
}

interface Message {
  role: "system" | "user";
  content: MessageContent[];
}

const buildMessages = (
  instructions: string | undefined,
  input: string | undefined,
  schema?: Record<string, unknown>
): Message[] => {
  const schemaPrompt = schema
    ? `请严格按照以下JSON Schema返回JSON结果，不要包含任何额外文字：${JSON.stringify(schema)}`
    : "请直接输出JSON格式结果，不要附加额外解释。";

  const userContent = [input ?? "", schemaPrompt].filter(Boolean).join("\n\n").trim();

  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: instructions?.trim() || "You are a helpful ESL curriculum design assistant."
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: userContent
        }
      ]
    }
  ];
};

const stripCodeFences = (value: string) => value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

const extractJsonBlock = (value: string) => {
  const trimmed = value.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
};

const tryParseJson = (value: string): Record<string, unknown> | null => {
  if (!value) return null;
  const cleaned = stripCodeFences(value);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const block = extractJsonBlock(cleaned);
      if (block) {
        return JSON.parse(block);
      }
    } catch {
      return null;
    }
  }
  return null;
};

const createClient = (): AIClient => {
  const { ZHIPU_API_KEY, ZHIPU_BASE_URL, ZHIPU_TIMEOUT, ZHIPU_MODEL } = getEnv();
  if (!ZHIPU_API_KEY) {
    throw new Error("ZHIPU_API_KEY 未配置");
  }

  const axiosInstance: AxiosInstance = axios.create({
    baseURL: sanitizeBaseUrl(ZHIPU_BASE_URL || DEFAULT_BASE_URL),
    timeout: ZHIPU_TIMEOUT ?? 150000,
    headers: {
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  return {
    responses: {
      parse: async (payload: ParseRequest): Promise<StructuredResponse> => {
        const modelName = payload.model || ZHIPU_MODEL;
        const schema = payload.text?.format?.schema;
        const strict = payload.text?.format?.strict ?? false;
        const messages = buildMessages(payload.instructions, payload.input, schema as Record<string, unknown> | undefined);

        const requestBody = {
          model: modelName,
          messages,
          temperature: payload.temperature ?? 0.3,
          top_p: payload.top_p ?? 0.9,
          stream: false
        };

        const { data } = await axiosInstance.post(COMPLETIONS_PATH, requestBody);
        const content = data?.choices?.[0]?.message?.content ?? "";
        const parsed = schema ? tryParseJson(content) : null;

        if (schema && strict && !parsed) {
          throw new Error("AI 返回的内容无法解析为有效的 JSON");
        }

        return {
          id: data?.id,
          raw: data,
          output_text: content,
          output_parsed: parsed
        };
      }
    }
  };
};

export const getOpenAI = () => {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
};

export const checkNetworkConnectivity = async (): Promise<boolean> => {
  const { ZHIPU_BASE_URL } = getEnv();
  const url = `${sanitizeBaseUrl(ZHIPU_BASE_URL || DEFAULT_BASE_URL)}/models`;

  return new Promise(resolve => {
    const request = https.get(url, res => {
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });

    request.on("error", () => resolve(false));
    request.setTimeout(5000, () => {
      request.destroy();
      resolve(false);
    });
  });
};

const enrichError = (error: any) => {
  if (error?.response) {
    error.status = error.response.status;
    error.code = error.code ?? error.response?.data?.code;
  }
  return error;
};

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
    maxRetries = 2,
    baseDelay = 500,
    timeout = 60000,
    retryCondition = (error: any) => {
      return (
        error.status === 429 ||
        (error.status >= 500 && error.status < 600) ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNRESET" ||
        error.message?.includes("timeout") ||
        error.type === "network_error"
      );
    }
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      console.log(`[AI Fast] API调用 ${attempt + 1}/${maxRetries + 1}`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("API调用超时")), timeout);
      });

      const result = await Promise.race([apiCall(), timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`[AI Fast] API调用成功，耗时: ${duration}ms`);

      return result;
    } catch (error: any) {
      const normalizedError = enrichError(error);
      lastError = normalizedError;

      console.warn(`[AI Fast] API调用失败 (${attempt + 1}/${maxRetries + 1}):`, {
        message: normalizedError.message,
        code: normalizedError.code,
        status: normalizedError.status,
        type: normalizedError.type
      });

      if (!retryCondition(normalizedError) || attempt === maxRetries) {
        throw normalizedError;
      }

      const delay = baseDelay * Math.pow(1.5, attempt);
      console.log(`[AI Fast] ${delay}ms后快速重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export const callOpenAIStream = async (
  apiCall: () => Promise<any>,
  onChunk?: (chunk: string) => void,
  options: { timeout?: number } = {}
): Promise<any> => {
  const { timeout = 60000 } = options;

  try {
    console.log("[AI Stream] 开始流式API调用");
    const startTime = Date.now();

    const streamPromise = async () => {
      const response = await apiCall();
      if (typeof response === "string" && onChunk) {
        onChunk(response);
      }
      return response;
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("流式API调用超时")), timeout);
    });

    const result = await Promise.race([streamPromise(), timeoutPromise]);

    const duration = Date.now() - startTime;
    console.log(`[AI Stream] 流式调用完成，耗时: ${duration}ms`);

    return result;
  } catch (error: any) {
    console.error("[AI Stream] 流式调用失败:", error.message);
    throw error;
  }
};
