const { PrismaClient } = require('@prisma/client');
const { callHunyuanChat } = require('./dist/lib/hunyuan');

const prisma = new PrismaClient();

/**
 * 为英文句子生成中文翻译
 */
async function generateTranslation(enText) {
  try {
    if (!enText || !enText.trim()) {
      return null;
    }

    console.log(`[翻译] 正在翻译: ${enText.substring(0, 50)}...`);
    
    const translation = await callHunyuanChat([
      {
        Role: "system",
        Content: "你是专业的英语翻译助手。请将英文句子准确翻译成中文。要求：1. 只返回翻译结果，不要添加任何解释、说明或额外内容；2. 翻译要准确、自然；3. 如果是单词，返回对应的中文意思；4. 如果是句子，返回完整的句子翻译。"
      },
      {
        Role: "user",
        Content: `请将以下英文翻译成中文：\n\n${enText}`
      }
    ], { temperature: 0.2, timeout: 10000 });

    const cleanTranslation = translation.replace(/\n+/g, '').trim();
    
    if (cleanTranslation && cleanTranslation.length > 0) {
      console.log(`[翻译] 翻译成功: ${cleanTranslation.substring(0, 50)}...`);
      return cleanTranslation;
    }
    
    return null;
  } catch (error) {
    console.error(`[翻译] 翻译失败:`, error.message);
    return null;
  }
}

/**
 * 修复单个关卡的翻译
 */
async function fixLessonTranslation(lessonId, lessonTitle, enText, currentCn, summary) {
  try {
    // 检查是否需要修复
    // 情况1: cn 等于 summary (摘要)
    // 情况2: cn 等于 en (英文，可能是fallback导致的)
    const needsFix = currentCn === summary || currentCn === enText;
    
    if (!needsFix) {
      console.log(`[跳过] Lesson ${lessonId}: cn 既不是 summary 也不是英文，无需修复`);
      return { fixed: false, reason: '无需修复' };
    }

    // 如果没有英文内容，跳过
    if (!enText || !enText.trim()) {
      console.log(`[跳过] Lesson ${lessonId}: 没有英文内容`);
      return { fixed: false, reason: '没有英文内容' };
    }

    // 生成翻译
    const translation = await generateTranslation(enText);
    
    if (!translation || translation === '[翻译生成中...]') {
      console.log(`[跳过] Lesson ${lessonId}: 翻译生成失败`);
      return { fixed: false, reason: '翻译生成失败' };
    }

    // 更新数据库
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        currentVersion: {
          include: {
            items: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    if (!lesson || !lesson.currentVersion) {
      console.log(`[跳过] Lesson ${lessonId}: 关卡或版本不存在`);
      return { fixed: false, reason: '关卡或版本不存在' };
    }

    const firstItem = lesson.currentVersion.items[0];
    if (!firstItem) {
      console.log(`[跳过] Lesson ${lessonId}: 没有 item`);
      return { fixed: false, reason: '没有 item' };
    }

    // 更新 payload.cn
    const payload = firstItem.payload && typeof firstItem.payload === 'object' 
      ? { ...(firstItem.payload as Record<string, unknown>) }
      : {};
    
    payload.cn = translation;
    payload.updatedAt = new Date().toISOString();

    await prisma.lessonItem.update({
      where: { id: firstItem.id },
      data: {
        payload: payload as any
      }
    });

    console.log(`[修复成功] Lesson #${lesson.sequence} "${lessonTitle}": "${enText}" -> "${translation}"`);
    return { fixed: true, translation };
  } catch (error) {
    console.error(`[错误] Lesson ${lessonId}:`, error.message);
    return { fixed: false, error: error.message };
  }
}

/**
 * 主函数：修复所有有问题的关卡
 */
async function main() {
  console.log('🚀 开始修复翻译数据...\n');

  try {
    // 1. 获取所有有问题的关卡
    const allLessons = await prisma.lesson.findMany({
      where: {
        deletedAt: null
      },
      include: {
        currentVersion: {
          include: {
            items: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        package: true
      },
      orderBy: {
        sequence: 'asc'
      }
    });

    console.log(`📊 总共找到 ${allLessons.length} 个关卡\n`);

    // 2. 筛选出有问题的关卡
    const problematicLessons = [];

    for (const lesson of allLessons) {
      if (!lesson.currentVersion) continue;
      
      const firstItem = lesson.currentVersion.items?.[0];
      if (!firstItem) continue;

      const payload = (firstItem.payload ?? {}) as Record<string, unknown>;
      const summary = lesson.currentVersion.summary;
      const payloadCn = payload.cn as string | undefined;
      const payloadEn = (payload.en as string) ?? (payload.target as string) ?? (payload.answer as string) ?? null;

      // 检查是否有问题：
      // 1. cn 等于 summary (摘要)
      // 2. cn 等于 en (英文，可能是fallback导致的)
      const isProblematic = payloadEn && payloadCn && (
        (summary && payloadCn === summary) || 
        payloadCn === payloadEn
      );
      
      if (isProblematic) {
        problematicLessons.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          sequence: lesson.sequence,
          packageId: lesson.packageId,
          packageTitle: lesson.package?.title || '未知',
          en: payloadEn,
          cn: payloadCn,
          summary: summary || null
        });
      }
    }

    console.log(`⚠️  找到 ${problematicLessons.length} 个有问题的关卡\n`);

    if (problematicLessons.length === 0) {
      console.log('✅ 没有需要修复的关卡！');
      return;
    }

    // 3. 显示问题列表
    console.log('问题关卡列表：');
    problematicLessons.slice(0, 10).forEach((item, index) => {
      console.log(`  ${index + 1}. #${item.sequence} "${item.lessonTitle}"`);
      console.log(`     英文: ${item.en.substring(0, 60)}...`);
      console.log(`     当前cn: ${item.cn}`);
      console.log('');
    });

    if (problematicLessons.length > 10) {
      console.log(`  ... 还有 ${problematicLessons.length - 10} 个关卡\n`);
    }

    // 4. 询问是否继续
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question(`\n是否开始修复这 ${problematicLessons.length} 个关卡？(y/n): `, resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ 用户取消操作');
      return;
    }

    // 5. 开始修复
    console.log('\n🔄 开始修复...\n');

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < problematicLessons.length; i++) {
      const item = problematicLessons[i];
      console.log(`\n[${i + 1}/${problematicLessons.length}] 处理关卡 #${item.sequence}...`);

      const result = await fixLessonTranslation(
        item.lessonId,
        item.lessonTitle,
        item.en,
        item.cn,
        item.summary
      );

      if (result.fixed) {
        fixedCount++;
      } else {
        skippedCount++;
      }

      if (result.error) {
        errorCount++;
      }

      // 添加延迟，避免API限流
      if (i < problematicLessons.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
      }
    }

    // 6. 输出统计
    console.log('\n' + '='.repeat(60));
    console.log('📊 修复完成统计：');
    console.log(`  ✅ 成功修复: ${fixedCount} 个`);
    console.log(`  ⏭️  跳过: ${skippedCount} 个`);
    console.log(`  ❌ 错误: ${errorCount} 个`);
    console.log(`  📝 总计: ${problematicLessons.length} 个`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 发生错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
main()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
