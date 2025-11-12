#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function testExistingOpenAI() {
  console.log('[测试] 使用现有OpenAI配置测试OCR');

  try {
    // 导入现有的OpenAI配置
    const { getOpenAI } = require('./src/lib/openai');
    const { recognizeImageWithOpenAI } = require('./src/lib/aliyun');

    const openai = getOpenAI();
    console.log('[测试] OpenAI客户端创建成功');

    // 使用一个简单的测试图片URL
    const testImageUrl = "https://via.placeholder.com/300x150/000000/FFFFFF?text=Hello+World+你好世界";

    console.log('[测试] 开始OCR识别测试图片:', testImageUrl);

    const result = await recognizeImageWithOpenAI(testImageUrl);

    console.log('[测试] ✅ OCR识别成功!');
    console.log('[测试] 识别结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[测试] ❌ OCR识别失败:', error.message);
    console.error('[测试] 完整错误:', error);
  }
}

testExistingOpenAI().catch(console.error);