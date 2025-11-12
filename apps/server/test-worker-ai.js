#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

/**
 * 直接测试Worker中的AI生成功能
 */
async function testWorkerAIGeneration() {
  console.log('[测试] 开始测试Worker AI生成功能');

  try {
    // 动态导入worker模块
    const { callOpenAIWithRetry } = require('./dist/lib/openai');
    const { recognizeImageByUrl } = require('./dist/lib/ocr');

    console.log('[步骤1] 测试OCR功能...');

    // 测试OCR识别
    const testImageUrl = "https://www.baidu.com/img/flexible/logo/pc/result.png";
    const ocrResult = await recognizeImageByUrl(testImageUrl);
    console.log('[OCR结果] 识别的文字:', ocrResult.body?.data?.content);

    console.log('\n[步骤2] 测试OpenAI API调用...');

    // 测试OpenAI API调用（使用一个简单的请求）
    const openaiTestResult = await callOpenAIWithRetry(async () => {
      const openai = require('./dist/lib/openai').getOpenAI();
      return await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "user", content: "请用一句话介绍什么是OCR技术？" }
        ],
        max_tokens: 100,
        temperature: 0.7
      });
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    });

    console.log('[OpenAI结果] AI回复:', openaiTestResult.choices[0]?.message?.content);

    console.log('\n[步骤3] 模拟完整的课程生成流程...');

    // 模拟从OCR识别到AI生成课程的完整流程
    const recognizedText = ocrResult.body?.data?.content || "百度";

    console.log('[模拟] 基于识别的文字进行课程生成...');

    const courseGenerationPrompt = `基于以下文字内容"${recognizedText}"，请生成一个简单的英语学习课程计划，包含：
1. 课程标题
2. 3个关键词汇
3. 1个例句
请以JSON格式返回。`;

    const coursePlanResult = await callOpenAIWithRetry(async () => {
      const openai = require('./dist/lib/openai').getOpenAI();
      return await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "你是一个专业的英语课程设计助手，总是返回有效的JSON格式。" },
          { role: "user", content: courseGenerationPrompt }
        ],
        max_tokens: 500,
        temperature: 0.4,
        response_format: { type: "json_object" }
      });
    }, {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 30000
    });

    const coursePlan = JSON.parse(coursePlanResult.choices[0]?.message?.content || '{}');
    console.log('[课程生成结果] 生成的课程计划:', JSON.stringify(coursePlan, null, 2));

    console.log('\n✅ 所有测试完成！OCR和AI生成功能正常工作。');

  } catch (error) {
    console.error('[错误] 测试失败:', error.message);

    if (error.message.includes('OpenAI')) {
      console.log('[建议] 请检查OpenAI API密钥配置');
    } else if (error.message.includes('TENCENT')) {
      console.log('[建议] 请检查腾讯云OCR配置');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('[建议] 请检查网络连接');
    }
  }
}

// 运行测试
testWorkerAIGeneration().catch(console.error);