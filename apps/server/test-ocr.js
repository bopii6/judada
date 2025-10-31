#!/usr/bin/env node

// 强制删除缓存的环境变量
delete process.env.ALIYUN_OCR_ACCESS_KEY_ID;
delete process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;
delete process.env.ALIYUN_OCR_REGION_ID;
delete process.env.ALIYUN_OCR_ENDPOINT;

// 重新加载.env文件
require('dotenv').config({ path: '../../.env' });

console.log('[调试] 环境变量检查:', {
  envPath: '../../.env',
  accessKeyId: process.env.ALIYUN_OCR_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_OCR_ACCESS_KEY_SECRET ? '已设置' : '未设置'
});
const OCRClient = require("@alicloud/ocr-api20210707").default;
const { Config } = require("@alicloud/openapi-core/dist/utils");

async function testOcr() {
  console.log('[测试] 开始测试阿里云OCR服务');

  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;
  // 尝试不同的Endpoint配置
  const endpoint = process.env.ALIYUN_OCR_ENDPOINT || "ocr-api.cn-hangzhou.aliyuncs.com";
  const regionId = process.env.ALIYUN_OCR_REGION_ID || "cn-hangzhou";

  console.log('[测试] 配置信息:', {
    accessKeyId: accessKeyId?.substring(0, 8) + '...',
    hasAccessKeySecret: !!accessKeySecret,
    endpoint,
    regionId,
    fullAccessKeyId: accessKeyId
  });

  const config = new Config({
    accessKeyId,
    accessKeySecret,
    endpoint,
    regionId
  });

  const client = new OCRClient(config);

  // 使用一个公开的测试图片URL
  const testImageUrl = "https://img.alicdn.com/imgextra/i4/O1CN016xQmzG1UcLNaTVq4h_!!6000000002555-0-tps-2880-1800.jpg";

  try {
    console.log('[测试] 开始OCR识别...');
    const request = new (require("@alicloud/ocr-api20210707").RecognizeGeneralRequest)({
      url: testImageUrl
    });

    const result = await client.recognizeGeneral(request);
    console.log('[测试] OCR识别成功!');
    console.log('[测试] 识别结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[测试] OCR识别失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('状态码:', error.statusCode);
    console.error('请求ID:', error.requestId);

    if (error.code === 'ocrServiceNotOpen') {
      console.log('\n[建议] OCR服务未开通，请检查:');
      console.log('1. 是否已在阿里云控制台开通OCR服务');
      console.log('2. 是否开通了相应的语言权限（如英语、小语种等）');
      console.log('3. 账户余额是否充足');
      console.log('4. AccessKey是否有OCR服务权限');
    }
  }
}

testOcr().catch(console.error);