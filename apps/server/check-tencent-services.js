#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function checkTencentServices() {
  console.log('[检查] 检查腾讯云服务配置和状态');

  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  console.log('[检查] 配置信息:', {
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey,
    secretIdPrefix: secretId?.substring(0, 8) + '...'
  });

  if (!secretId || !secretKey) {
    console.log('[检查] ❌ 缺少必要配置');
    return;
  }

  if (secretId === 'your-tencent-secret-id') {
    console.log('[检查] ❌ 使用示例配置，请设置真实密钥');
    return;
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const OcrClient = tencentcloud.ocr.v20181119.Client;

    console.log('[检查] SDK加载成功');

    // 尝试创建客户端
    const client = new OcrClient({
      credential: {
        secretId: secretId,
        secretKey: secretKey,
      },
      region: "ap-beijing",
      profile: {
        httpProfile: {
          endpoint: "ocr.tencentcloudapi.com",
        },
      },
    });

    console.log('[检查] 客户端创建成功');

    // 尝试调用API（使用一个简单的测试）
    console.log('[检查] 尝试连接腾讯云API...');

    // 使用GeneralBasicOCR测试连接
    try {
      const result = await client.GeneralBasicOCR({
        "ImageUrl": "https://www.baidu.com/img/flexible/logo/pc/result.png"
      });
      console.log('[检查] ✅ API连接成功');
      console.log('[检查] 响应:', JSON.stringify(result, null, 2));
    } catch (apiError) {
      console.log('[检查] ❌ API调用失败:', apiError.message);

      if (apiError.code === 'FailedOperation.DownLoadError') {
        console.log('[检查] 💡 建议: 这是图片下载问题，不是认证问题');
        console.log('[检查] 💡 OCR服务本身是正常的，问题在于图片URL无法访问');
      } else if (apiError.code === 'UnauthorizedOperation') {
        console.log('[检查] 💡 建议: 请检查OCR服务是否已开通');
      } else if (apiError.code === 'AuthFailure.SecretIdNotFound') {
        console.log('[检查] 💡 建议: SecretId不正确');
      } else if (apiError.code === 'AuthFailure.SignatureFailure') {
        console.log('[检查] 💡 建议: SecretKey不正确');
      }
    }

  } catch (error) {
    console.log('[检查] ❌ 检查过程出错:', error.message);
  }
}

checkTencentServices().catch(console.error);