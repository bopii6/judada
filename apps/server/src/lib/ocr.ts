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

/**
 * 使用腾讯云OCR识别图片文字
 * 支持通用文字识别
 */
export const recognizeImageByUrl = async (imageUrl: string) => {
  const client = getOcrClient();

  console.log('[OCR Debug] 调用腾讯云OCR服务:', {
    imageUrl,
    secretId: process.env.TENCENT_SECRET_ID?.substring(0, 8) + '...'
  });

  try {
    // 首先尝试使用图片URL
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

    // 返回与原系统兼容的格式
    return {
      body: {
        data: {
          content: content.trim()
        }
      }
    };
  } catch (error: any) {
    console.warn('[OCR Debug] 图片URL方式失败，尝试其他方式:', error.message);

    // 如果URL方式失败，尝试不同的参数组合
    try {
      console.log('[OCR Debug] 尝试简化参数重新识别');
      const simpleParams = {
        "ImageUrl": imageUrl,
      };

      const result = await client.GeneralBasicOCR(simpleParams);

      console.log('[OCR Debug] 简化参数方式调用成功');

      const textDetections = result.TextDetections || [];
      const content = textDetections
        .map((item: any) => item.DetectedText)
        .filter((text: string) => text && text.trim())
        .join('\n');

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