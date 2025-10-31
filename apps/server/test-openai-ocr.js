#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });
const OpenAI = require('openai');

async function testOpenAI() {
  console.log('[测试] 开始测试OpenAI Vision OCR服务');

  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL_NAME;

  console.log('[测试] 配置信息:', {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey?.substring(0, 10) + '...',
    model: modelName
  });

  if (!apiKey) {
    console.error('[错误] 缺少OpenAI API Key');
    return;
  }

  const openai = new OpenAI({
    apiKey: apiKey
  });

  // 使用一个包含文字的测试图片
  const testImageUrl = "https://img.alicdn.com/imgextra/i1/O1CN01sTbMh91sT2pJXu2h5_!!6000000005767-0-tps-800-450.jpg";

  try {
    console.log('[测试] 开始OpenAI Vision OCR识别...');

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 使用支持视觉的模型
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请识别这张图片中的所有文字内容，包括中英文。请按照原文格式输出，不要添加任何额外的解释或格式。如果图片中没有文字，请返回空字符串。"
            },
            {
              type: "image_url",
              image_url: {
                url: testImageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content || "";

    console.log('[测试] ✅ OpenAI Vision OCR识别成功!');
    console.log('[测试] 识别结果:');
    console.log('----------------------------------------');
    console.log(content);
    console.log('----------------------------------------');

    // 返回兼容格式
    const result = {
      body: {
        data: {
          content: content.trim()
        }
      }
    };

    console.log('[测试] 兼容格式结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[测试] ❌ OpenAI Vision OCR识别失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('错误类型:', error.type);

    if (error.code === 'insufficient_quota') {
      console.log('[建议] OpenAI账户余额不足，请充值或检查计费设置');
    } else if (error.code === 'model_not_found') {
      console.log('[建议] GPT-4o模型不可用，请检查API权限');
    }
  }
}

testOpenAI().catch(console.error);