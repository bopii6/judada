#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });
const OCRClient = require("@alicloud/ocr-api20210707").default;
const { Config } = require("@alicloud/openapi-core/dist/utils");

const TEST_CONFIGS = [
  {
    name: "杭州区域 (默认配置)",
    endpoint: "ocr-api.cn-hangzhou.aliyuncs.com",
    regionId: "cn-hangzhou"
  },
  {
    name: "上海区域",
    endpoint: "ocr-api.cn-shanghai.aliyuncs.com",
    regionId: "cn-shanghai"
  },
  {
    name: "北京区域",
    endpoint: "ocr-api.cn-beijing.aliyuncs.com",
    regionId: "cn-beijing"
  }
];

async function testOcrConfig(config) {
  console.log(`\n[测试] 测试配置: ${config.name}`);

  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;

  console.log(`  - Endpoint: ${config.endpoint}`);
  console.log(`  - Region: ${config.regionId}`);
  console.log(`  - AccessKey: ${accessKeyId?.substring(0, 8)}...`);

  const clientConfig = new Config({
    accessKeyId,
    accessKeySecret,
    endpoint: config.endpoint,
    regionId: config.regionId
  });

  const client = new OCRClient(clientConfig);

  // 使用简单的测试图片
  const testImageUrl = "https://gw.alicdn.com/imgextra/i1/O1CN01sTbMh91sT2pJXu2h5_!!6000000005767-0-tps-800-450.jpg";

  try {
    console.log('  - 正在调用OCR服务...');
    const request = new (require("@alicloud/ocr-api20210707").RecognizeGeneralRequest)({
      url: testImageUrl
    });

    const result = await client.recognizeGeneral(request);
    console.log('  ✅ 成功! OCR服务正常工作');
    console.log('  📄 识别结果预览:', JSON.stringify(result.body?.data?.content || '无内容').substring(0, 100) + '...');
    return true;

  } catch (error) {
    console.log('  ❌ 失败!');
    console.log(`     错误代码: ${error.code}`);
    console.log(`     错误信息: ${error.message}`);
    console.log(`     状态码: ${error.statusCode}`);

    if (error.code === 'ocrServiceNotOpen') {
      console.log('     💡 建议: 该区域OCR服务未开通');
    } else if (error.code === 'Forbidden.RAM') {
      console.log('     💡 建议: RAM用户权限不足');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('     💡 建议: AccessKey配置错误');
    }
    return false;
  }
}

async function runDiagnosis() {
  console.log('🔍 阿里云OCR服务诊断开始');
  console.log('==========================================');

  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    console.log('❌ 环境变量中缺少AccessKey配置');
    return;
  }

  let successCount = 0;

  for (const config of TEST_CONFIGS) {
    const success = await testOcrConfig(config);
    if (success) successCount++;

    // 添加延迟避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n==========================================');
  console.log('📊 诊断结果汇总:');
  console.log(`   - 成功配置数量: ${successCount}/${TEST_CONFIGS.length}`);

  if (successCount === 0) {
    console.log('\n🚨 所有配置均失败，建议检查:');
    console.log('   1. 主账号是否已开通OCR服务');
    console.log('   2. RAM用户是否有OCR服务权限');
    console.log('   3. 账户余额是否充足');
    console.log('   4. AccessKey是否正确');
    console.log('\n📞 建议联系阿里云技术支持: 95187');
  } else {
    console.log('\n✅ 找到可用配置! 请更新.env文件中的配置');
  }
}

runDiagnosis().catch(console.error);