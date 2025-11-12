import * as tencentcloud from "tencentcloud-sdk-nodejs";
import { getEnv } from "../config/env";

// 导入OCR客户端
const OcrClient = tencentcloud.ocr.v20181119.Client;

type OcrClientInstance = InstanceType<typeof OcrClient>;

let ocrClient: OcrClientInstance | null = null;

const createClient = () => {
  const env = getEnv() as any;
  const { TENCENT_SECRET_ID, TENCENT_SECRET_KEY } = env;

  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    throw new Error('腾讯云OCR配置缺失：请在.env文件中设置TENCENT_SECRET_ID和TENCENT_SECRET_KEY');
  }

  const clientConfig = {
    credential: {
      secretId: TENCENT_SECRET_ID,
      secretKey: TENCENT_SECRET_KEY,
    },
    region: "ap-beijing", // 可根据需要调整区域
    profile: {
      httpProfile: {
        endpoint: "ocr.tencentcloudapi.com",
      },
    },
  };

  return new OcrClient(clientConfig);
};

export const getOcrClient = () => {
  if (!ocrClient) {
    ocrClient = createClient();
  }
  return ocrClient;
};

// OCR结果缓存，避免重复识别同一张图片
const ocrCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30分钟缓存

/**
 * 使用腾讯云OCR识别图片文字 - 优化版本
 * 添加了缓存、并发处理和重试机制
 */
export const recognizeImageByUrl = async (imageUrl: string): Promise<{ body: { data: { content: string } } }> => {
  const startTime = Date.now();

  // 检查缓存
  const cacheKey = imageUrl;
  const cached = ocrCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log('[OCR Debug] 使用缓存结果:', imageUrl);
    return {
      body: {
        data: {
          content: cached.content
        }
      }
    };
  }

  const client = getOcrClient();

  console.log('[OCR Debug] 调用腾讯云OCR服务:', {
    imageUrl,
    secretId: process.env.TENCENT_SECRET_ID?.substring(0, 8) + '...'
  });

  // 使用Promise.race来设置超时限制
  const ocrPromise = async () => {
    // 首先尝试使用图片URL，优先使用DOC场景（文档识别更准确）
    const params = {
      "ImageUrl": imageUrl,
      "Scene": "DOC", // 文档识别场景
    };

    console.log('[OCR Debug] 尝试使用图片URL方式识别');
    const result = await client.GeneralBasicOCR(params);

    console.log('[OCR Debug] 腾讯云OCR调用成功');

    // 提取文字内容
    const textDetections = result.TextDetections || [];
    const content = textDetections
      .map((item: any) => item.DetectedText)
      .filter((text: string) => text && text.trim())
      .join('\n');

    return content.trim();
  };

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('OCR请求超时')), 15000); // 15秒超时
  });

  try {
    const content = await Promise.race([ocrPromise(), timeoutPromise]);

    // 缓存结果
    ocrCache.set(cacheKey, { content, timestamp: Date.now() });

    // 清理过期缓存
    cleanExpiredCache();

    const duration = Date.now() - startTime;
    console.log('[OCR Debug] OCR识别完成，耗时:', `${duration}ms`);

    return {
      body: {
        data: {
          content
        }
      }
    };
  } catch (error: any) {
    console.warn('[OCR Debug] 主要方式失败，尝试简化参数:', error.message);

    // 如果主要方式失败，尝试简化参数并快速重试
    try {
      console.log('[OCR Debug] 尝试简化参数重新识别');
      const simpleParams = {
        "ImageUrl": imageUrl,
      };

      // 设置较短的超时时间
      const simpleOcrPromise = client.GeneralBasicOCR(simpleParams);
      const simpleTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('简化OCR请求超时')), 10000); // 10秒超时
      });

      const result = await Promise.race([simpleOcrPromise, simpleTimeoutPromise]) as any;

      console.log('[OCR Debug] 简化参数方式调用成功');

      const textDetections = result.TextDetections || [];
      const content = textDetections
        .map((item: any) => item.DetectedText)
        .filter((text: string) => text && text.trim())
        .join('\n');

      // 缓存结果（即使是从简化方式获得的）
      ocrCache.set(cacheKey, { content: content.trim(), timestamp: Date.now() });

      return {
        body: {
          data: {
            content: content.trim()
          }
        }
      };
    } catch (simpleError: any) {
      console.error('[OCR Debug] 所有方式都失败:', simpleError.message);

      // 提供详细错误信息
      const errorMessage = simpleError.message || '未知错误';
      const errorCode = simpleError.code || 'UNKNOWN_ERROR';

      throw new Error(`腾讯云OCR调用失败 [${errorCode}]: ${errorMessage}`);
    }
  }
};

/**
 * 清理过期的OCR缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of ocrCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      ocrCache.delete(key);
    }
  }
  // 如果缓存太大，删除最旧的一半
  if (ocrCache.size > 100) {
    const entries = Array.from(ocrCache.entries());
    const halfCount = Math.floor(entries.length / 2);
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, halfCount)
      .forEach(([key]) => ocrCache.delete(key));
  }
}

/**
 * 批量OCR识别 - 用于并发处理多张图片
 */
export const recognizeImagesBatch = async (imageUrls: string[]): Promise<string[]> => {
  console.log('[OCR Debug] 开始批量OCR识别，图片数量:', imageUrls.length);

  // 并发处理，但限制并发数为3以避免过载
  const concurrencyLimit = 3;
  const results: string[] = [];

  for (let i = 0; i < imageUrls.length; i += concurrencyLimit) {
    const batch = imageUrls.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(url =>
      recognizeImageByUrl(url).then(result => result.body.data.content)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`[OCR Debug] 图片 ${i + index} OCR失败:`, result.reason);
        results.push(''); // 失败的图片返回空字符串
      }
    });

    // 添加小延迟避免API频率限制
    if (i + concurrencyLimit < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('[OCR Debug] 批量OCR识别完成');
  return results;
};