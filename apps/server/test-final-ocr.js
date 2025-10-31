#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function testFinalOCR() {
  console.log('[测试] 测试完整的OCR降级功能');

  try {
    // 导入编译后的模块
    const { recognizeImageByUrl } = require('./dist/lib/aliyun');

    // 使用一个包含文字的测试图片
    const testImageUrl = "https://via.placeholder.com/300x150/000000/FFFFFF?text=Hello+World+你好世界";

    console.log('[测试] 开始OCR识别测试图片:', testImageUrl);
    console.log('[测试] 预期流程：阿里云OCR失败 -> 自动降级到OpenAI Vision');

    const result = await recognizeImageByUrl(testImageUrl);

    console.log('[测试] ✅ OCR识别成功!');
    console.log('[测试] 识别结果内容:', result.body?.data?.content);
    console.log('[测试] 完整结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[测试] ❌ OCR识别失败:', error.message);

    if (error.message.includes('ocrServiceNotOpen')) {
      console.log('[测试] ❌ 阿里云OCR仍然失败，且OpenAI降级也失败了');
      console.log('[测试] 💡 请检查：');
      console.log('   1. OpenAI API Key是否有效');
      console.log('   2. 网络连接是否正常');
      console.log('   3. OpenAI账户余额是否充足');
    }
  }
}

testFinalOCR().catch(console.error);