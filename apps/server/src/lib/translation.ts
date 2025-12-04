import { callHunyuanChat } from "./hunyuan";

/**
 * 翻译缓存：避免重复翻译相同句子
 */
const translationCache = new Map<string, string>();

/**
 * 带重试的翻译函数
 */
async function translateWithRetry(
  enText: string,
  maxRetries = 3,
  baseDelay = 1000
): Promise<string | null> {
  try {
    // 使用带重试的 callHunyuanChat
    const translation = await callHunyuanChat(
      [
        {
          Role: "system",
          Content:
            "你是专业的英语翻译助手。请将英文句子准确翻译成中文。要求：1. 只返回翻译结果，不要添加任何解释；2. 翻译要准确、自然；3. 不要添加课程标题、学习目标等额外内容；4. 只返回纯粹的中文翻译。"
        },
        {
          Role: "user",
          Content: `请将以下英文句子翻译成中文：\n\n${enText}`
        }
      ],
      { temperature: 0.2 },
      { maxRetries, baseDelay }
    );

    if (translation && translation !== "[翻译生成中...]") {
      const cleanTranslation = translation.replace(/\n+/g, "").trim();
      // 缓存翻译结果
      translationCache.set(enText.toLowerCase(), cleanTranslation);
      return cleanTranslation;
    }
    return null;
  } catch (error: any) {
    console.error(`[Translation] 翻译失败:`, error.message);
    return null;
  }
}

/**
 * 批量翻译：收集所有需要翻译的句子，批量处理
 * 策略：
 * 1. 先检查缓存
 * 2. 去重相同句子
 * 3. 批量翻译（控制并发）
 * 4. 返回翻译结果映射
 */
export async function batchTranslate(
  sentences: string[],
  options: {
    concurrency?: number; // 并发数，默认 3
    delayBetweenBatches?: number; // 批次间延迟，默认 500ms
  } = {}
): Promise<Map<string, string>> {
  const { concurrency = 3, delayBetweenBatches = 500 } = options;
  const translationMap = new Map<string, string>();

  // 1. 去重并检查缓存
  const uniqueSentences = Array.from(new Set(sentences.filter(s => s && s.trim())));
  const toTranslate: string[] = [];

  for (const sentence of uniqueSentences) {
    const cacheKey = sentence.toLowerCase();
    const cached = translationCache.get(cacheKey);
    if (cached) {
      translationMap.set(sentence, cached);
    } else {
      toTranslate.push(sentence);
    }
  }

  console.log(
    `[Batch Translation] 总共 ${uniqueSentences.length} 个句子，${translationMap.size} 个来自缓存，${toTranslate.length} 个需要翻译`
  );

  if (toTranslate.length === 0) {
    return translationMap;
  }

  // 2. 批量翻译（控制并发）
  for (let i = 0; i < toTranslate.length; i += concurrency) {
    const batch = toTranslate.slice(i, i + concurrency);
    const batchPromises = batch.map(sentence =>
      translateWithRetry(sentence).then(translation => ({
        sentence,
        translation
      }))
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.translation) {
        translationMap.set(result.value.sentence, result.value.translation);
      } else {
        console.warn(`[Batch Translation] 翻译失败: ${batch[index]?.substring(0, 50)}...`);
        // 翻译失败时不设置，保持为空
      }
    });

    // 批次间延迟，避免限频
    if (i + concurrency < toTranslate.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`[Batch Translation] 批量翻译完成，成功 ${translationMap.size}/${uniqueSentences.length}`);
  return translationMap;
}

/**
 * 单个句子翻译（带缓存）
 */
export async function translateSentence(enText: string): Promise<string | null> {
  if (!enText || !enText.trim()) {
    return null;
  }

  // 检查缓存
  const cacheKey = enText.toLowerCase();
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 翻译
  const translation = await translateWithRetry(enText);
  return translation;
}

/**
 * 清空翻译缓存
 */
export function clearTranslationCache(): void {
  translationCache.clear();
  console.log("[Translation] 翻译缓存已清空");
}
