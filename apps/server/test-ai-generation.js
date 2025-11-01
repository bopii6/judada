#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

const fs = require('fs');
const path = require('path');
// Node.js 18+ 内置 fetch 和 FormData，无需额外导入

/**
 * 测试AI生成课程功能
 */
async function testAICourseGeneration() {
  console.log('[测试] 开始测试AI生成课程功能');

  const baseUrl = 'http://localhost:4000';
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    console.error('[错误] 缺少ADMIN_KEY环境变量');
    return;
  }

  try {
    // 1. 创建一个测试课程包
    console.log('\n[步骤1] 创建测试课程包...');
    const createPackageResponse = await fetch(`${baseUrl}/api/admin/course-packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        title: 'AI测试课程包',
        topic: '英语学习',
        description: '用于测试AI生成功能的课程包',
        label: 'AI测试',
        notes: '这是一个通过API创建的测试课程包'
      })
    });

    if (!createPackageResponse.ok) {
      throw new Error(`创建课程包失败: ${createPackageResponse.status} ${createPackageResponse.statusText}`);
    }

    const packageData = await createPackageResponse.json();
    const packageId = packageData.pkg.id;
    console.log(`[成功] 课程包创建成功，ID: ${packageId}`);

    // 2. 准备测试图片文件
    console.log('\n[步骤2] 准备测试文件...');
    const testImagePath = path.join(__dirname, 'test-image.png');

    // 如果没有测试图片，创建一个简单的测试图片
    if (!fs.existsSync(testImagePath)) {
      console.log('[提示] 创建测试图片文件...');
      // 创建一个简单的base64编码的PNG图片（1x1像素的透明图片）
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const testImageBuffer = Buffer.from(testImageBase64, 'base64');
      fs.writeFileSync(testImagePath, testImageBuffer);
    }

    // 3. 上传文件并触发AI生成
    console.log('\n[步骤3] 上传文件并触发AI生成...');

    // 手动构建multipart/form-data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const fileData = fs.readFileSync(testImagePath);

    let formData = '';

    // 添加文件
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="file"; filename="test-image.png"\r\n`;
    formData += `Content-Type: image/png\r\n\r\n`;

    const formBuffer = Buffer.from(formData, 'utf8');
    const endBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

    // 添加triggeredById字段
    const midData = `\r\n--${boundary}\r\n`;
    const midBuffer = Buffer.from(midData, 'utf8');

    const triggerData = 'Content-Disposition: form-data; name="triggeredById"\r\n\r\n00000000-0000-0000-0000-000000000000';
    const triggerBuffer = Buffer.from(triggerData, 'utf8');

    const finalBuffer = Buffer.concat([
      formBuffer,
      fileData,
      midBuffer,
      triggerBuffer,
      endBuffer
    ]);

    const generateResponse = await fetch(`${baseUrl}/api/admin/course-packages/${packageId}/generate`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': finalBuffer.length
      },
      body: finalBuffer
    });

    if (!generateResponse.ok) {
      throw new Error(`触发AI生成失败: ${generateResponse.status} ${generateResponse.statusText}`);
    }

    const generateData = await generateResponse.json();
    console.log('[成功] AI生成任务已提交');
    console.log('[信息] 任务ID:', generateData.job.id);
    console.log('[信息] 资源ID:', generateData.asset.id);

    // 4. 检查任务状态
    console.log('\n[步骤4] 检查任务状态...');
    await checkJobStatus(baseUrl, adminKey, generateData.job.id);

    // 5. 清理测试文件
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('\n[清理] 已删除测试图片文件');
    }

  } catch (error) {
    console.error('[错误] 测试失败:', error.message);
  }
}

/**
 * 检查任务状态
 */
async function checkJobStatus(baseUrl, adminKey, jobId) {
  const maxChecks = 30; // 最多检查30次（约1分钟）
  let checkCount = 0;

  while (checkCount < maxChecks) {
    try {
      const response = await fetch(`${baseUrl}/api/jobs/course-generation/${jobId}`, {
        headers: {
          'x-admin-key': adminKey
        }
      });

      if (response.ok) {
        const jobData = await response.json();
        console.log(`[状态] 任务状态: ${jobData.job.status}, 进度: ${jobData.job.progress || 0}%`);

        if (jobData.job.status === 'completed') {
          console.log('[成功] AI生成任务完成！');
          console.log('[结果] 生成的课程数据:', JSON.stringify(jobData.job.result, null, 2));
          return true;
        } else if (jobData.job.status === 'failed') {
          console.log('[失败] AI生成任务失败:', jobData.job.error);
          return false;
        }
      } else {
        console.log(`[警告] 无法获取任务状态: ${response.status}`);
      }
    } catch (error) {
      console.log(`[警告] 检查任务状态时出错: ${error.message}`);
    }

    checkCount++;
    if (checkCount < maxChecks) {
      console.log(`[等待] 2秒后再次检查... (${checkCount}/${maxChecks})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('[超时] 任务状态检查超时');
  return false;
}

// 运行测试
testAICourseGeneration().catch(console.error);