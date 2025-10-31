#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function testMultipleOCRImages() {
  console.log('[测试] 开始测试多张图片的腾讯云OCR服务');

  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey || secretId === 'your-tencent-secret-id') {
    console.error('[错误] 腾讯云OCR配置不正确');
    return;
  }

  try {
    // 导入编译后的模块
    const { recognizeImageByUrl } = require('./dist/lib/ocr');

    // 测试多个不同的图片URL
    const testImages = [
      {
        name: "腾讯云官方示例图片",
        url: "https://ocr-demo-1254418846.cos.ap-guangzhou.myqcloud.com/general/general.jpg"
      },
      {
        name: "公共图片服务",
        url: "https://picsum.photos/400/200?text=Hello+World+测试文字"
      },
      {
        name: "简单的文字图片",
        url: "https://dummyimage.com/400x200/000/fff&text=Sample+Text+123"
      }
    ];

    for (const image of testImages) {
      console.log(`\n[测试] 测试图片: ${image.name}`);
      console.log(`[测试] 图片URL: ${image.url}`);

      try {
        const result = await recognizeImageByUrl(image.url);
        console.log(`[测试] ✅ 识别成功!`);
        console.log(`[测试] 识别内容: ${result.body?.data?.content || '无内容'}`);
      } catch (error) {
        console.log(`[测试] ❌ 识别失败: ${error.message}`);
      }

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n[测试] 测试完成!');

  } catch (error) {
    console.error('[测试] ❌ 测试过程出错:', error.message);
  }
}

testMultipleOCRImages().catch(console.error);