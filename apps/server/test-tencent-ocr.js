#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function testTencentOCR() {
  console.log('[测试] 开始测试腾讯云OCR服务');

  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  console.log('[测试] 配置信息:', {
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey,
    secretIdPrefix: secretId?.substring(0, 8) + '...'
  });

  if (!secretId || !secretKey) {
    console.error('[错误] 缺少腾讯云OCR配置');
    console.log('[配置] 请在.env文件中设置:');
    console.log('TENCENT_SECRET_ID=your-actual-secret-id');
    console.log('TENCENT_SECRET_KEY=your-actual-secret-key');
    return;
  }

  if (secretId === 'your-tencent-secret-id') {
    console.log('[提示] 检测到示例配置，请先设置真实的腾讯云SecretId和SecretKey');
    console.log('');
    console.log('[获取配置步骤]:');
    console.log('1. 访问腾讯云控制台: https://console.cloud.tencent.com/');
    console.log('2. 点击右上角头像 -> "访问管理"');
    console.log('3. 左侧菜单 -> "访问密钥" -> "API密钥管理"');
    console.log('4. 点击"新建密钥"或使用现有密钥');
    console.log('5. 将SecretId和SecretKey填入.env文件');
    console.log('');
    console.log('[开通OCR服务]:');
    console.log('1. 在腾讯云控制台搜索"文字识别OCR"');
    console.log('2. 开通OCR服务（有免费额度）');
    console.log('3. 确保账户余额充足');
    return;
  }

  try {
    // 导入编译后的模块
    const { recognizeImageByUrl } = require('./dist/lib/ocr');

    // 使用一个更稳定的公开测试图片
    const testImageUrl = "https://www.baidu.com/img/flexible/logo/pc/result.png";

    console.log('[测试] 开始OCR识别测试图片:', testImageUrl);

    const result = await recognizeImageByUrl(testImageUrl);

    console.log('[测试] ✅ 腾讯云OCR识别成功!');
    console.log('[测试] 识别结果内容:', result.body?.data?.content);
    console.log('[测试] 完整结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[测试] ❌ 腾讯云OCR识别失败:', error.message);

    if (error.message.includes('SecretId')) {
      console.log('[建议] 请检查SecretId和SecretKey是否正确');
    } else if (error.message.includes('network')) {
      console.log('[建议] 请检查网络连接');
    } else if (error.message.includes('UnauthorizedOperation')) {
      console.log('[建议] 请检查腾讯云OCR服务是否已开通');
    }
  }
}

testTencentOCR().catch(console.error);