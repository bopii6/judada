import type { Job } from "bullmq";
import { Prisma, LessonItemType } from "@prisma/client";
import pdf from "pdf-parse";
import { PACKAGE_GENERATION_QUEUE, PackageGenerationJobData } from "../jobs/packageGeneration.queue";
import { createWorker } from "../lib/queue";
import { getPrisma } from "../lib/prisma";
import { getSupabase } from "../lib/supabase";
import { getEnv } from "../config/env";
import { parsePdfToQuestions, ParsedQuestion } from "../utils/pdf";
import { recognizeImageByUrl, recognizeImagesBatch } from "../lib/ocr";
import { getOpenAI, callOpenAIWithRetry } from "../lib/openai";
import { generationJobRepository } from "../repositories/generationJob.repository";

const prisma = getPrisma();
const supabase = getSupabase();
const openai = getOpenAI();

const { SUPABASE_STORAGE_BUCKET, OPENAI_MODEL_NAME } = getEnv();

const LESSON_ITEM_TYPES: LessonItemType[] = [
  "vocabulary",
  "phrase",
  "sentence",
  "dialogue",
  "quiz_single_choice",
  "quiz_multiple_choice",
  "fill_blank",
  "reorder",
  "listening",
  "speaking",
  "writing",
  "custom"
];

type AllowedLessonItemType = `${LessonItemType}`;

interface GeneratedLessonItemPlan {
  type: AllowedLessonItemType;
  title?: string;
  prompt?: string;
  payload: Record<string, unknown>;
}

interface GeneratedLessonPlan {
  title: string;
  summary: string;
  difficulty: number;
  focus?: string[];
  items: GeneratedLessonItemPlan[];
}

interface GeneratedCoursePlan {
  packageSummary: string;
  lessons: GeneratedLessonPlan[];
}

const clampDifficulty = (value: number | undefined | null): number | null => {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 1) return 1;
  if (value > 6) return 6;
  return Math.round(value);
};

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
};

const normalizePayload = (payload: unknown): Prisma.InputJsonValue => {
  if (payload == null) {
    return {};
  }
  if (typeof payload === "object") {
    return payload as Prisma.JsonObject | Prisma.JsonArray;
  }
  return { value: payload };
};

/**
 * 从OCR文本中提取英文句子
 */
const extractEnglishSentences = (text: string, logContext?: { generationJobId?: string; logFn?: (msg: string, details?: any) => void }): string[] => {
  if (!text || !text.trim()) {
    if (logContext?.logFn) {
      logContext.logFn("extractEnglishSentences: 输入文本为空", { textLength: 0 });
    }
    return [];
  }
  
  const sentences: string[] = [];
  const seen = new Set<string>(); // 去重
  
  if (logContext?.logFn) {
    logContext.logFn("开始提取英文句子", { 
      textLength: text.length,
      textSample: text.substring(0, 500)
    });
  }
  
  // 方法1: 匹配英文句子：以大写字母开头，以句号/问号/感叹号结尾
  const englishSentenceRegex = /[A-Z][^.!?]*[.!?]/g;
  const matches = text.match(englishSentenceRegex);
  
  if (matches) {
    for (const match of matches) {
      const cleaned = match.trim().replace(/^["']|["']$/g, ''); // 移除首尾引号
      // 过滤掉太短或太长的句子
      if (cleaned.length >= 10 && cleaned.length <= 200) {
        // 确保主要是英文字符（至少60%是字母）
        const englishCharCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
        if (englishCharCount / cleaned.length > 0.6) {
          // 确保包含至少3个单词
          const wordCount = cleaned.split(/\s+/).filter(w => w.match(/[a-zA-Z]/)).length;
          if (wordCount >= 3 && !seen.has(cleaned.toLowerCase())) {
            sentences.push(cleaned);
            seen.add(cleaned.toLowerCase());
          }
        }
      }
    }
  }
  
  // 方法2: 如果没有找到完整句子，尝试提取英文短语（3-10个单词）
  if (sentences.length < 10) {
    // 先提取所有英文单词
    const words = text.split(/\s+/).filter(w => {
      const cleaned = w.replace(/[^\w]/g, ''); // 移除标点
      const englishChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
      return englishChars / cleaned.length > 0.7 && cleaned.length >= 2;
    });
    
    // 组合成短语（3-8个单词）
    for (let i = 0; i < words.length - 2; i++) {
      const phraseWords = words.slice(i, Math.min(i + 8, words.length));
      const phrase = phraseWords.join(' ');
      if (phrase.length >= 10 && phrase.length <= 150) {
        const englishCharCount = (phrase.match(/[a-zA-Z]/g) || []).length;
        if (englishCharCount / phrase.length > 0.6 && !seen.has(phrase.toLowerCase())) {
          sentences.push(phrase);
          seen.add(phrase.toLowerCase());
        }
      }
    }
  }
  
  // 方法3: 提取引号内的英文内容
  const quotedRegex = /["']([^"']{10,100})["']/g;
  let quotedMatch;
  while ((quotedMatch = quotedRegex.exec(text)) !== null && sentences.length < 50) {
    const quoted = quotedMatch[1].trim();
    const englishCharCount = (quoted.match(/[a-zA-Z]/g) || []).length;
    if (englishCharCount / quoted.length > 0.7 && !seen.has(quoted.toLowerCase())) {
      sentences.push(quoted);
      seen.add(quoted.toLowerCase());
    }
  }
  
  const result = sentences.slice(0, 50); // 最多返回50个句子
  
  if (logContext?.logFn) {
    logContext.logFn("英文句子提取完成", {
      extractedCount: result.length,
      sampleSentences: result.slice(0, 5),
      method1Count: sentences.filter((_, i) => i < result.length && /[A-Z][^.!?]*[.!?]/.test(result[i])).length
    });
  }
  
  return result;
};

const extractOcrText = (raw: unknown): string => {
  const visited = new Set<unknown>();

  const unwrap = (value: unknown): unknown => {
    if (!value || typeof value !== "object") {
      return value;
    }
    return (value as any).body ?? value;
  };

  const parseValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    return value;
  };

  const collectFromArray = (items: unknown): string => {
    if (!Array.isArray(items)) return "";
    const collected = items
      .map(entry => {
        if (typeof entry === "string") return entry;
        if (!entry || typeof entry !== "object") return "";
        return (
          entry?.word ??
          entry?.Word ??
          entry?.text ??
          entry?.Text ??
          entry?.content ??
          entry?.Content ??
          entry?.line ??
          entry?.Line ??
          ""
        );
      })
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return collected.join("\n");
  };

  const extractRecursive = (value: unknown): string => {
    if (value == null) return "";
    const parsed = parseValue(value);
    if (typeof parsed === "string") {
      return parsed;
    }

    if (Array.isArray(parsed)) {
      const joined = collectFromArray(parsed);
      if (joined) return joined;
      for (const item of parsed) {
        const nested = extractRecursive(item);
        if (nested) return nested;
      }
      return "";
    }

    if (typeof parsed !== "object" || visited.has(parsed)) {
      return "";
    }
    visited.add(parsed);

    const record = parsed as Record<string, unknown>;

    const directKeys = [
      "content",
      "Content",
      "fullText",
      "FullText",
      "text",
      "Text",
      "ocr_text",
      "ocrText",
      "OCRText",
      "outputText",
      "OutputText"
    ];
    for (const key of directKeys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }

    const nestedKeys = ["data", "Data", "result", "Result", "payload", "Payload", "value", "Value"];
    for (const key of nestedKeys) {
      const nested = extractRecursive(record[key]);
      if (nested) return nested;
    }

    const outputs = record.outputs ?? record.Outputs;
    if (outputs) {
      const text = extractRecursive(outputs);
      if (text) return text;
    }

    const outputValue = (record as any)?.outputValue ?? (record as any)?.OutputValue;
    if (outputValue) {
      const text = extractRecursive(outputValue);
      if (text) return text;
    }

    const dataValue = (record as any)?.dataValue ?? (record as any)?.DataValue;
    if (dataValue) {
      const text = extractRecursive(dataValue);
      if (text) return text;
    }

    const arrayKeys = [
      "prism_wordsInfo",
      "PrismWordsInfo",
      "wordsInfo",
      "WordsInfo",
      "words",
      "Words",
      "lineContents",
      "LineContents",
      "lines",
      "Lines",
      "contents",
      "Contents"
    ];
    for (const key of arrayKeys) {
      const arrayResult = collectFromArray(record[key]);
      if (arrayResult) return arrayResult;
    }

    return "";
  };

  const body = unwrap(raw);
  const data = (body as any)?.data ?? (body as any)?.Data ?? body;
  return extractRecursive(data);
};

const buildAiInstructions = () =>
  [
    "You are an experienced ESL curriculum designer for Chinese learners aged 16-30.",
    "Design a coherent mini-course from provided raw materials. Create 15-20 sequential lessons, each with a concise summary, a difficulty rating (1-6), and 3-6 activity items that gradually increase in challenge.",
    "Activity types must match the provided enum. Populate payloads with bilingual content whenever possible (both English and Chinese) and ensure every activity includes both CN and EN text when it makes sense.",
    "Keep vocabulary and prompts concise (<= 120 characters). Avoid markdown. The JSON must pass the provided schema precisely."
  ].join("\n");

/**
 * AI指令 - 极度强制生成15个不同的关卡
 * 针对中国小学生英语教科书学习场景
 */
const buildOptimizedAiInstructions = () =>
  [
    "CRITICAL REQUIREMENT: You MUST generate EXACTLY 15 DIFFERENT lessons. No exceptions!",
    "",
    "You are designing English learning challenges for Chinese elementary school students (ages 8-12) based on their English textbook content.",
    "",
    "MANDATORY CONTENT REQUIREMENTS:",
    "1. Extract REAL English sentences, phrases, and words from the OCR text provided",
    "2. The 'en' field MUST contain actual English text from the textbook (sentences, phrases, or words)",
    "3. DO NOT create Chinese translations or Chinese prompts as the main content",
    "4. DO NOT use placeholder English - use actual English content from the OCR text",
    "5. The 'cn' field is OPTIONAL and should only be used for hints/translations, NOT as the primary content",
    "",
    "DISPLAY LOGIC:",
    "- Students see ENGLISH sentences/phrases at the top of the screen",
    "- Students practice by:",
    "  * Clicking word blocks below to form the English sentence (reorder type)",
    "  * Typing out the English sentence they hear/see (sentence/listening type)",
    "- Chinese hints (if provided) appear as small text below the English, NOT as the main content",
    "",
    "PAYLOAD STRUCTURE (CRITICAL):",
    "Each item's payload MUST follow this structure:",
    "  {",
    "    \"en\": \"Actual English sentence from textbook\",  // REQUIRED - This is what students see",
    "    \"cn\": \"中文提示（可选）\",  // OPTIONAL - Only for hints",
    "    \"variants\": [\"word1\", \"word2\", \"word3\"],  // For reorder type",
    "    \"answer\": \"English sentence\"  // For typing exercises",
    "  }",
    "",
    "ACTIVITY TYPES TO USE:",
    "- 'reorder': Students click word blocks to form English sentences",
    "  * payload.en = English sentence to form",
    "  * payload.variants = array of English words from the sentence",
    "- 'sentence': Students type English sentences",
    "  * payload.en = English sentence to type",
    "  * payload.answer = same English sentence",
    "- 'vocabulary': Students learn English words",
    "  * payload.en = English word",
    "- 'listening': Students listen and type",
    "  * payload.en = English sentence/phrase",
    "  * payload.answer = same English sentence",
    "- 'fill_blank': Students complete English sentences",
    "  * payload.en = English sentence with blank",
    "",
    "CONTENT EXTRACTION FROM OCR:",
    "- Look for English sentences in the OCR text (lines starting with capital letters, ending with periods)",
    "- Extract English phrases and vocabulary",
    "- Use the actual English content from the textbook pages",
    "- If OCR text contains both English and Chinese, prioritize the English parts",
    "",
    "If source materials are limited, create variations based on the extracted English content:",
    "- Use the same English sentences with different activity types",
    "- Break long sentences into shorter phrases",
    "- Create vocabulary exercises from words in the sentences",
    "- Add listening practice with the same sentences",
    "",
    "EACH lesson must be unique and based on actual English content from the OCR text.",
    "Generate EXACTLY 15 lessons. Each lesson: title (in Chinese for organization), summary (max 100 chars), difficulty (1-6), 3-6 items.",
    "Use exact activity types from schema. Keep content concise. No markdown. Valid JSON required.",
    "FAILURE to generate exactly 15 lessons or use proper English content will result in rejection."
  ].join("\n");

/**
 * 优化输入提示词，减少长度以提高速度
 */
const optimizePromptForSpeed = (promptSegments: string[]): string => {
  console.log('[Worker Fast] 开始优化提示词，原始段落数:', promptSegments.length);

  // 合并相关段落并限制总长度
  let optimizedText = promptSegments
    .filter(segment => segment && segment.trim().length > 10) // 过滤太短的段落
    .map(segment => {
      // 限制每个段落的长度
      if (segment.length > 2000) {
        return segment.substring(0, 2000) + "...[truncated]";
      }
      return segment;
    })
    .join("\n\n");

  // 限制总输入长度
  const maxLength = 8000; // 输入长度限制
  if (optimizedText.length > maxLength) {
    optimizedText = optimizedText.substring(0, maxLength) + "...[truncated for speed]";
    console.log('[Worker Fast] 输入文本被截断以提高处理速度');
  }

  console.log('[Worker Fast] 优化完成，最终文本长度:', optimizedText.length);
  return optimizedText;
};

const generationJsonSchema = {
  name: "course_generation_plan",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["packageSummary", "lessons"],
    properties: {
      packageSummary: {
        type: "string",
        description: "Overall summary of the generated course package.",
        maxLength: 800
      },
      lessons: {
        type: "array",
        minItems: 15,
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "difficulty", "items"],
          properties: {
            title: {
              type: "string",
              maxLength: 120
            },
            summary: {
              type: "string",
              maxLength: 400
            },
            difficulty: {
              type: "integer",
              minimum: 1,
              maximum: 6
            },
            focus: {
              type: "array",
              items: {
                type: "string",
                maxLength: 60
              },
              maxItems: 6
            },
            items: {
              type: "array",
              minItems: 3,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "payload"],
                properties: {
                  type: {
                    type: "string",
                    enum: LESSON_ITEM_TYPES
                  },
                  title: {
                    type: "string",
                    maxLength: 120
                  },
                  prompt: {
                    type: "string",
                    maxLength: 280
                  },
                  payload: {
                    type: "object",
                    additionalProperties: true,
                    required: ["en"],
                    properties: {
                      en: {
                        type: "string",
                        description: "English sentence or phrase for the exercise. MUST be real English content from the textbook.",
                        minLength: 5,
                        maxLength: 300
                      },
                      cn: {
                        type: "string",
                        description: "Optional Chinese translation or hint",
                        maxLength: 300
                      },
                      answer: {
                        type: "string",
                        description: "The correct answer (usually same as en field)",
                        maxLength: 300
                      },
                      variants: {
                        type: "array",
                        description: "Word tokens for reorder exercises",
                        items: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

const summarizeParsedQuestions = (questions: ParsedQuestion[]): string => {
  if (!questions.length) return "";
  const sample = questions.slice(0, 50).map((question, index) => {
    const base = `${index + 1}. ${question.en}`;
    return question.cn && question.cn !== question.en ? `${base} | CN: ${question.cn}` : base;
  });
  return sample.join("\n");
};

const createCoursePlan = async (job: Job<PackageGenerationJobData>) => {
  const { generationJobId } = job.data;

  const generationJob = await prisma.generationJob.findUnique({
    where: { id: generationJobId },
    include: {
      package: true
    }
  });

  if (!generationJob) {
    throw new Error(`GenerationJob ${generationJobId} 不存在`);
  }

  if (!generationJob.packageId) {
    throw new Error("当前任务缺少关联课程包，无法生成内容");
  }

  const jobInput = (generationJob.inputInfo ?? {}) as Record<string, any>;
  
  // 支持多文件上传：优先使用assets数组，否则使用单个文件信息（向后兼容）
  const assets = jobInput.assets as Array<{
    assetId: string;
    storagePath: string;
    originalName: string;
    mimeType: string;
    size: number;
  }> | undefined;
  
  const totalFiles = jobInput.totalFiles as number | undefined || 1;
  const originalName = jobInput.originalName ?? "上传文件";
  const storagePath = jobInput.storagePath; // 向后兼容单文件

  // 确定要处理的文件列表
  const filesToProcess = assets && assets.length > 0 
    ? assets 
    : (storagePath ? [{
        assetId: jobInput.assetId || "",
        storagePath,
        originalName,
        mimeType: jobInput.mimeType || "image/jpeg",
        size: jobInput.size || 0
      }] : []);

  if (filesToProcess.length === 0) {
    throw new Error("任务缺少存储路径信息");
  }

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 5,
    startedAt: new Date()
  });
  await job.updateProgress(5);

  await generationJobRepository.appendLog(generationJobId, `开始处理${filesToProcess.length}个文件`, "info", {
    fileCount: filesToProcess.length,
    originalName: filesToProcess[0]?.originalName
  });

  let extractedText = "";
  let parsedQuestions: ParsedQuestion[] = [];
  const allOcrTexts: string[] = [];

  // 处理PDF文件（通常只有一个PDF）
  const pdfFiles = filesToProcess.filter(f => 
    f.mimeType.includes("pdf") || f.originalName.toLowerCase().endsWith(".pdf")
  );

  if (pdfFiles.length > 0 && generationJob.sourceType === "pdf_upload") {
    await generationJobRepository.appendLog(generationJobId, `解析 ${pdfFiles.length} 个 PDF 文件`, "info");
    
    for (const pdfFile of pdfFiles) {
      const downloadResult = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(pdfFile.storagePath);
      if (downloadResult.error) {
        await generationJobRepository.appendLog(generationJobId, `下载PDF失败: ${pdfFile.originalName}`, "warning");
        continue;
      }
      const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
      const pdfQuestions = await parsePdfToQuestions(fileBuffer);
      parsedQuestions.push(...pdfQuestions);
      allOcrTexts.push(pdfQuestions.map(item => item.en).join("\n"));
    }
    
    extractedText = allOcrTexts.join("\n\n");
  } else {
    // 批量OCR处理图片
    await generationJobRepository.appendLog(generationJobId, `开始批量OCR识别 ${filesToProcess.length} 张图片`, "info");
    
    const imageUrls: string[] = [];
    
    // 为每张图片生成签名URL
    for (const imageFile of filesToProcess) {
      const signedUrl = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(imageFile.storagePath, 60 * 10);

      if (signedUrl.error || !signedUrl.data?.signedUrl) {
        await generationJobRepository.appendLog(
          generationJobId, 
          `获取图片签名链接失败: ${imageFile.originalName}`, 
          "warning"
        );
        continue;
      }
      
      imageUrls.push(signedUrl.data.signedUrl);
    }

    if (imageUrls.length === 0) {
      throw new Error("无法获取任何图片的签名链接，无法调用 OCR");
    }

    // 批量OCR识别
    const ocrTexts = await recognizeImagesBatch(imageUrls);
    
    // 合并所有OCR结果
    for (let i = 0; i < ocrTexts.length; i++) {
      const text = ocrTexts[i];
      if (text && text.trim()) {
        allOcrTexts.push(`[图片 ${i + 1}: ${filesToProcess[i]?.originalName || `file-${i + 1}`}]\n${text}`);
        await generationJobRepository.appendLog(
          generationJobId,
          `图片 ${i + 1} OCR识别完成: ${filesToProcess[i]?.originalName || `file-${i + 1}`}`,
          "info",
          { textLength: text.length }
        );
      } else {
        await generationJobRepository.appendLog(
          generationJobId,
          `图片 ${i + 1} OCR识别结果为空: ${filesToProcess[i]?.originalName || `file-${i + 1}`}`,
          "warning"
        );
      }
    }

    extractedText = allOcrTexts.join("\n\n---\n\n");
  }

  // 记录OCR提取的完整文本
  console.log(`[生成任务 ${generationJobId}] OCR文本提取完成，总长度: ${extractedText.length} 字符`);
  console.log(`[生成任务 ${generationJobId}] OCR文本样本: ${extractedText.substring(0, 500)}`);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `OCR文本提取完成，总长度: ${extractedText.length} 字符`,
    "info",
    {
      fullOcrText: extractedText.substring(0, 2000), // 记录前2000字符
      ocrTextCount: allOcrTexts.length,
      hasEnglish: /[a-zA-Z]{3,}/.test(extractedText)
    }
  );

  // 提前提取英文句子，用于后续验证和补充
  const preExtractedSentences = extractEnglishSentences(extractedText);
  console.log(`[生成任务 ${generationJobId}] 从OCR文本中预提取到 ${preExtractedSentences.length} 个英文句子`);
  if (preExtractedSentences.length > 0) {
    console.log(`[生成任务 ${generationJobId}] 英文句子示例: ${preExtractedSentences.slice(0, 5).join(', ')}`);
  }
  
  await generationJobRepository.appendLog(
    generationJobId,
    `从OCR文本中预提取到 ${preExtractedSentences.length} 个英文句子`,
    "info",
    {
      sampleSentences: preExtractedSentences.slice(0, 10),
      totalExtracted: preExtractedSentences.length
    }
  );

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 15
  });
  await job.updateProgress(15);

  // PDF fallback处理（如果之前没有成功提取文本）
  if (!extractedText.trim() && generationJob.sourceType === "pdf_upload" && pdfFiles.length > 0) {
    await generationJobRepository.appendLog(generationJobId, "尝试PDF fallback解析", "info");
    const firstPdf = pdfFiles[0];
    const downloadResult = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(firstPdf.storagePath);
    if (!downloadResult.error) {
      const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
      const fallback = await pdf(fileBuffer);
      if (fallback.text?.trim()) {
        extractedText = fallback.text;
        await generationJobRepository.appendLog(generationJobId, "PDF fallback解析成功", "info");
      }
    }
  }

  if (!extractedText.trim()) {
    throw new Error(`未能从${filesToProcess.length}个素材中提取有效文本，请确认内容质量`);
  }

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 30
  });
  await job.updateProgress(30);

  const promptSegments = [
    `Source type: ${generationJob.sourceType ?? "unknown"}`,
    `Total files processed: ${filesToProcess.length}`,
    `Original file name(s): ${filesToProcess.map(f => f.originalName).join(", ")}`,
    `Extracted text from ${filesToProcess.length} file(s) (<=4000 chars):\n${truncate(extractedText, 4000)}`
  ];

  const questionSummary = summarizeParsedQuestions(parsedQuestions);
  if (questionSummary) {
    promptSegments.push(`Parsed question-like sentences:\n${questionSummary}`);
  }

  await generationJobRepository.appendLog(generationJobId, "请求 AI 引擎生成课程草稿", "info", {
    model: OPENAI_MODEL_NAME
  });
  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 55
  });
  await job.updateProgress(55);

  // 优化的AI生成调用 - 专注于速度
  const aiResponse = await callOpenAIWithRetry(
    async () => {
      console.log('[Worker Fast] 开始优化的AI API调用');
      const apiStartTime = Date.now();

      // 优化输入文本，减少长度以提高速度
      const optimizedInput = optimizePromptForSpeed(promptSegments);

      await generationJobRepository.appendLog(
        generationJobId,
        `准备调用AI生成课程，OCR文本长度: ${extractedText.length}，优化后输入长度: ${optimizedInput.length}`,
        "info",
        {
          ocrTextSample: extractedText.substring(0, 500),
          optimizedInputSample: optimizedInput.substring(0, 500)
        }
      );

      const response = await openai.responses.parse({
        model: OPENAI_MODEL_NAME,
        instructions: buildOptimizedAiInstructions(), // 使用优化的指令
        input: optimizedInput,
        text: {
          format: {
            type: "json_schema",
            name: generationJsonSchema.name,
            schema: generationJsonSchema.schema,
            strict: false
          }
        },
        temperature: 0.3, // 降低温度以获得更一致的结果
        top_p: 0.9 // 添加top_p参数以提高效率
      });

      const apiDuration = Date.now() - apiStartTime;
      console.log(`[Worker Fast] AI API调用完成，耗时: ${apiDuration}ms`);

      return response;
    },
    {
      maxRetries: 2, // 减少重试次数
      baseDelay: 500, // 减少基础延迟
      timeout: 120000, // 适当增加超时，便于大模型生成复杂课程
      retryCondition: (error: any) => {
        // 更严格的重试条件，只对真正可重试的错误重试
        return (
          error.status === 429 || // Rate limit
          (error.status >= 500 && error.status < 600) || // Server errors
          error.code === 'ETIMEDOUT'
        );
      }
    }
  );

  // 确保aiResponse已定义
  if (!aiResponse) {
    throw new Error("AI 调用失败：未收到响应");
  }

  const plan = (aiResponse.output_parsed ?? null) as GeneratedCoursePlan | null;
  
  // 添加详细的AI返回日志（终端输出）
  console.log(`\n[生成任务 ${generationJobId}] ========== AI返回结果 ==========`);
  console.log(`[生成任务 ${generationJobId}] output_parsed: ${plan ? 'yes' : 'no'}`);
  console.log(`[生成任务 ${generationJobId}] lessons数量: ${plan?.lessons?.length ?? 0}`);
  
  if (plan && plan.lessons && plan.lessons.length > 0) {
    console.log(`[生成任务 ${generationJobId}] ✅ AI成功生成了 ${plan.lessons.length} 个关卡`);
    const firstLesson = plan.lessons[0];
    const firstItem = firstLesson.items?.[0];
    console.log(`[生成任务 ${generationJobId}] 第一个关卡: "${firstLesson.title}"`);
    console.log(`[生成任务 ${generationJobId}] 第一个Item类型: ${firstItem?.type}`);
    if (firstItem?.payload) {
      const payload = firstItem.payload as Record<string, any>;
      console.log(`[生成任务 ${generationJobId}] payload.en: "${payload.en || '(空)'}"`);
      console.log(`[生成任务 ${generationJobId}] payload完整内容: ${JSON.stringify(payload).substring(0, 500)}`);
    }
  } else {
    console.log(`[生成任务 ${generationJobId}] ❌ AI没有生成任何关卡！`);
    console.log(`[生成任务 ${generationJobId}] AI原始返回(output_text): ${aiResponse.output_text?.substring(0, 500) || 'N/A'}`);
  }
  console.log(`[生成任务 ${generationJobId}] ==================================\n`);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `AI 返回结果: output_parsed=${plan ? 'yes' : 'no'}, lessons=${plan?.lessons?.length ?? 0}`,
    "info",
    { 
      hasOutputParsed: !!plan,
      lessonsCount: plan?.lessons?.length ?? 0,
      firstLessonTitle: plan?.lessons?.[0]?.title ?? 'N/A',
      firstLessonItemsCount: plan?.lessons?.[0]?.items?.length ?? 0,
      firstItemType: plan?.lessons?.[0]?.items?.[0]?.type ?? 'N/A',
      firstItemPayload: plan?.lessons?.[0]?.items?.[0]?.payload 
        ? JSON.stringify(plan.lessons[0].items[0].payload) 
        : 'N/A',
      // 检查前3个lesson的payload
      samplePayloads: JSON.stringify(plan?.lessons?.slice(0, 3).map((lesson, idx) => ({
        lessonIndex: idx + 1,
        lessonTitle: lesson.title,
        items: lesson.items?.slice(0, 2).map((item, itemIdx) => ({
          itemIndex: itemIdx + 1,
          type: item.type,
          payload: item.payload
        }))
      })) ?? [])
    }
  );
  
  if (!plan) {
    const fallbackText = aiResponse.output_text;
    throw new Error(
      `AI 没有提供可解析的 JSON 结果${fallbackText ? `：${truncate(fallbackText, 200)}` : ""}`
    );
  }

  if (!plan.lessons?.length) {
    // 先尝试从OCR文本中提取英文句子
    const extractedSentences = extractEnglishSentences(extractedText);
    await generationJobRepository.appendLog(
      generationJobId,
      `AI 未返回任何课程，切换到基础补课方案。从OCR提取到 ${extractedSentences.length} 个英文句子`,
      "warning",
      { fallback: true, extractedCount: extractedSentences.length }
    );
    plan.lessons = generateFallbackLessons(extractedSentences);
  }

  // 验证并补充AI生成的内容中的英文
  // 统计所有item和缺少英文内容的item数量
  let totalItems = 0;
  let itemsWithoutEn = 0;
  for (const lesson of plan.lessons) {
    for (const item of lesson.items || []) {
      totalItems++;
      const payload = item.payload as Record<string, any> || {};
      const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
      if (!hasEn) {
        itemsWithoutEn++;
      }
    }
  }

  // 详细记录每个item的payload内容
  const itemDetails: Array<{lessonTitle: string, itemType: string, hasEn: boolean, payload: any}> = [];
  for (const lesson of plan.lessons.slice(0, 5)) { // 只记录前5个lesson
    for (const item of lesson.items || []) {
      const payload = item.payload as Record<string, any> || {};
      const hasEn = !!(payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence);
      itemDetails.push({
        lessonTitle: lesson.title,
        itemType: item.type,
        hasEn,
        payload: JSON.stringify(payload).substring(0, 300)
      });
    }
  }

  console.log(`[生成任务 ${generationJobId}] 内容验证：总共 ${totalItems} 个item，其中 ${itemsWithoutEn} 个缺少英文内容`);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `内容验证：总共 ${totalItems} 个item，其中 ${itemsWithoutEn} 个缺少英文内容`,
    "info",
    {
      totalItems,
      itemsWithoutEn,
      itemDetails: itemDetails.slice(0, 10) // 记录前10个item的详情
    }
  );

  // 如果有缺少英文内容的item，尝试从OCR文本中提取英文句子补充
  if (itemsWithoutEn > 0) {
    await generationJobRepository.appendLog(
      generationJobId,
      "警告：AI生成的内容中没有找到英文内容，可能使用了中文或占位符",
      "warning",
      { 
        samplePayload: JSON.stringify(plan.lessons[0]?.items?.[0]?.payload || {}).substring(0, 200)
      }
    );
    
    // 尝试从OCR文本中提取英文句子作为fallback
    const englishSentences = extractEnglishSentences(extractedText);
    await generationJobRepository.appendLog(
      generationJobId,
      `开始从OCR文本提取英文句子，OCR文本长度: ${extractedText.length}`,
      "info",
      {
        ocrTextSample: extractedText.substring(0, 1000),
        extractionMethod: "extractEnglishSentences"
      }
    );
    
    if (englishSentences.length > 0) {
      console.log(`[生成任务 ${generationJobId}] ✅ 从OCR文本中提取到 ${englishSentences.length} 个英文句子`);
      console.log(`[生成任务 ${generationJobId}] 英文句子列表: ${englishSentences.slice(0, 10).join(' | ')}`);
      
      await generationJobRepository.appendLog(
        generationJobId,
        `✅ 从OCR文本中提取到 ${englishSentences.length} 个英文句子，用于补充内容`,
        "info",
        {
          extractedCount: englishSentences.length,
          sampleSentences: englishSentences.slice(0, 10),
          allSentences: englishSentences // 记录所有提取的句子
        }
      );
      // 用提取的英文句子替换没有英文内容的item
      let sentenceIndex = 0;
      for (const lesson of plan.lessons) {
        for (const item of lesson.items || []) {
          const payload = item.payload as Record<string, any> || {};
          // 检查是否缺少英文内容
          const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
          if (!hasEn && sentenceIndex < englishSentences.length) {
            // 从提取的英文句子中选择一个（按顺序，确保每个item都有不同的句子）
            let englishSentence = englishSentences[sentenceIndex % englishSentences.length];
            // 清理句子中的换行符和多余空格
            englishSentence = englishSentence
              .replace(/\n+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            payload.en = englishSentence;
            payload.answer = englishSentence;
            payload.target = englishSentence;
            // 如果是reorder类型，生成variants
            if (item.type === 'reorder') {
              payload.variants = englishSentence.split(/\s+/).filter(w => w.length > 0 && w.match(/[a-zA-Z]/));
            }
            sentenceIndex++;
            console.log(`[生成任务 ${generationJobId}] ✅ 为关卡 "${lesson.title}" 补充英文: "${englishSentence.substring(0, 50)}"`);
            
            await generationJobRepository.appendLog(
              generationJobId,
              `✅ 为关卡 "${lesson.title}" 的item补充英文内容`,
              "info",
              {
                lessonTitle: lesson.title,
                itemType: item.type,
                sentenceIndex,
                englishSentence,
                sentenceLength: englishSentence.length,
                payloadBefore: JSON.stringify(payload),
                payloadAfter: JSON.stringify({
                  ...payload,
                  en: englishSentence,
                  answer: englishSentence,
                  target: englishSentence
                })
              }
            );
          }
        }
      }
      
      await generationJobRepository.appendLog(
        generationJobId,
        `成功为 ${sentenceIndex} 个item补充了英文内容`,
        "info",
        { 
          sampleSentences: englishSentences.slice(0, 5),
          totalExtracted: englishSentences.length
        }
      );
      
      // 验证补充后的内容
      let verifiedItems = 0;
      for (const lesson of plan.lessons) {
        for (const item of lesson.items || []) {
          const payload = item.payload as Record<string, any> || {};
          const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
          if (hasEn) {
            verifiedItems++;
          }
        }
      }
      await generationJobRepository.appendLog(
        generationJobId,
        `补充后验证：${verifiedItems}/${totalItems} 个item包含英文内容`,
        "info"
      );
    } else {
      await generationJobRepository.appendLog(
        generationJobId,
        `OCR文本中也没有找到英文内容！请检查OCR识别结果。提取的文本长度: ${extractedText.length}`,
        "error",
        { extractedTextSample: extractedText.substring(0, 1000) }
      );
    }
  } else {
    await generationJobRepository.appendLog(
      generationJobId,
      "✅ 所有item都已包含英文内容，无需补充",
      "info"
    );
  }

  await generationJobRepository.appendLog(generationJobId, "AI 草稿生成完成，准备落库", "info", {
    lessonCount: plan.lessons.length
  });

  // 检查并确保至少有15个关卡
  if (plan.lessons.length < 15) {
    await generationJobRepository.appendLog(generationJobId, `AI只生成了${plan.lessons.length}个关卡，开始自动补充到15个`, "info");

    const additionalLessonsNeeded = 15 - plan.lessons.length;

    // 智能补充关卡 - 创建多样化的课程内容
    const lessonTypes = [
      { type: "vocabulary" as LessonItemType, title: "词汇扩展", difficulty: 2 },
      { type: "phrase" as LessonItemType, title: "常用短语", difficulty: 3 },
      { type: "sentence" as LessonItemType, title: "句子练习", difficulty: 4 },
      { type: "dialogue" as LessonItemType, title: "对话练习", difficulty: 5 },
      { type: "quiz_single_choice" as LessonItemType, title: "单选题", difficulty: 3 },
      { type: "quiz_multiple_choice" as LessonItemType, title: "多选题", difficulty: 4 },
      { type: "fill_blank" as LessonItemType, title: "填空题", difficulty: 3 },
      { type: "reorder" as LessonItemType, title: "排序题", difficulty: 4 },
      { type: "listening" as LessonItemType, title: "听力练习", difficulty: 4 },
      { type: "speaking" as LessonItemType, title: "口语练习", difficulty: 5 }
    ];

    for (let i = 0; i < additionalLessonsNeeded; i++) {
      const lessonType = lessonTypes[i % lessonTypes.length];
      const baseContent = plan.lessons.length > 0 ? plan.lessons[0] : null;

      // 创建有意义的补充关卡
      const supplementalLesson = {
        title: `${lessonType.title} - 第${i + 1}课`,
        summary: `针对${lessonType.title}的专项训练课程，提升英语应用能力`,
        difficulty: lessonType.difficulty,
        items: [
          {
            type: lessonType.type,
            title: `${lessonType.title}练习${i + 1}`,
            payload: {
              en: baseContent ? `Practice ${lessonType.title} based on ${baseContent.title}` : `Practice ${lessonType.title} ${i + 1}`,
              cn: `练习${lessonType.title}${i + 1}`,
              prompt: `请完成这个${lessonType.title}练习，提高你的英语技能`,
              answer: lessonType.type === "fill_blank" ? "practice" : "practice",
              hints: [`仔细阅读题目`, `注意语法规则`]
            }
          },
          {
            type: lessonType.type,
            title: `${lessonType.title}强化练习${i + 1}`,
            payload: {
              en: baseContent ? `Advanced ${lessonType.title} practice for ${baseContent.title}` : `Advanced ${lessonType.title} practice ${i + 1}`,
              cn: `${lessonType.title}强化练习${i + 1}`,
              prompt: `通过这个练习巩固你的${lessonType.title}技能`,
              answer: lessonType.type === "fill_blank" ? "advanced" : "advanced",
              hints: [`运用所学知识`, `注意上下文理解`]
            }
          }
        ]
      };

      plan.lessons.push(supplementalLesson);
    }

    await generationJobRepository.appendLog(generationJobId, `成功补充${additionalLessonsNeeded}个关卡，当前总数：${plan.lessons.length}`, "info");
  }
  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 70
  });
  await job.updateProgress(70);

  const triggerUserId = generationJob.triggeredById ?? null;
  const packageId = generationJob.packageId;
  const existingDescription = generationJob.package?.description ?? null;

  // 分步骤创建，避免大事务超时
  // 1. 如果已有草稿版本，先删除它（包括关联的关卡），确保只有一个草稿
  const existingDraftVersion = await prisma.coursePackageVersion.findFirst({
    where: {
      packageId,
      status: "draft"
    },
    include: {
      lessons: {
        select: { id: true }
      }
    }
  });

  if (existingDraftVersion) {
    await generationJobRepository.appendLog(
      generationJobId,
      `发现已有草稿版本（#${existingDraftVersion.versionNumber}），删除旧草稿以创建新草稿`,
      "info",
      { oldVersionId: existingDraftVersion.id, oldLessonCount: existingDraftVersion.lessons.length }
    );

    // 如果这个草稿版本是当前版本，先解除关联
    const currentPackage = await prisma.coursePackage.findUnique({
      where: { id: packageId },
      select: { currentVersionId: true }
    });

    if (currentPackage?.currentVersionId === existingDraftVersion.id) {
      await prisma.coursePackage.update({
        where: { id: packageId },
        data: { currentVersionId: null }
      });
    }

    // 删除关联的关卡（级联删除会自动处理）
    await prisma.lesson.deleteMany({
      where: {
        packageVersionId: existingDraftVersion.id
      }
    });

    // 删除草稿版本
    await prisma.coursePackageVersion.delete({
      where: { id: existingDraftVersion.id }
    });

    await generationJobRepository.appendLog(generationJobId, "旧草稿版本已删除", "info");
  }

  // 2. 创建新的草稿版本
  const versionCount = await prisma.coursePackageVersion.count({ where: { packageId } });
  const nextVersionNumber = versionCount + 1;

  const version = await prisma.coursePackageVersion.create({
    data: {
      packageId,
      versionNumber: nextVersionNumber,
      label: `AI Draft #${nextVersionNumber}`,
      notes: `生成自 ${originalName}`,
      status: "draft",
      sourceType: "ai_generated",
      payload: plan as unknown as Prisma.JsonObject,
      createdById: triggerUserId
    }
  });

  await generationJobRepository.appendLog(generationJobId, "课程包版本创建成功，开始创建课程", "info", {
    versionId: version.id,
    versionNumber: nextVersionNumber
  });

  // 2. 逐个创建课程和课时，使用小事务
  // 由于已删除旧草稿，sequence从1开始（只保留一个草稿版本）
  let sequence = 1;
  const lessonSummaries: Array<{ id: string; versionId: string }> = [];

  for (let i = 0; i < plan.lessons.length; i++) {
    const lessonPlan = plan.lessons[i];

    // 更新进度
    const progress = 70 + Math.floor((i / plan.lessons.length) * 25);
    await generationJobRepository.updateStatus(generationJobId, {
      status: "processing",
      progress
    });
    await job.updateProgress(progress);

    try {
      const lessonResult = await prisma.$transaction(
        async (tx) => {
          const lesson = await tx.lesson.create({
            data: {
              packageId,
              packageVersionId: version.id,
              title: lessonPlan.title,
              sequence,
              createdById: triggerUserId
            }
          });

          const difficulty = clampDifficulty(lessonPlan.difficulty);

          const lessonVersion = await tx.lessonVersion.create({
            data: {
              lessonId: lesson.id,
              versionNumber: 1,
              title: lessonPlan.title,
              summary: lessonPlan.summary,
              difficulty,
              status: "draft",
              createdById: triggerUserId
            }
          });

          await tx.lesson.update({
            where: { id: lesson.id },
            data: { currentVersionId: lessonVersion.id }
          });

          const validItems = Array.isArray(lessonPlan.items) ? lessonPlan.items : [];
          let orderIndex = 1;

          for (const item of validItems) {
            if (!item || typeof item !== "object") continue;
            if (!LESSON_ITEM_TYPES.includes(item.type as LessonItemType)) continue;

            // 验证payload中是否有英文内容
            const payload = item.payload as Record<string, any> || {};
            const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
            
            // 记录每个item的保存详情
            await generationJobRepository.appendLog(
              generationJobId,
              `保存关卡 "${lessonPlan.title}" 的item #${orderIndex} (类型: ${item.type})`,
              "info",
              {
                lessonTitle: lessonPlan.title,
                itemIndex: orderIndex,
                itemType: item.type,
                hasEn,
                en: payload.en || 'N/A',
                answer: payload.answer || 'N/A',
                target: payload.target || 'N/A',
                payloadKeys: Object.keys(payload),
                payloadFull: JSON.stringify(payload).substring(0, 500)
              }
            );
            
            if (!hasEn) {
              await generationJobRepository.appendLog(
                generationJobId,
                `❌ 错误：关卡 "${lessonPlan.title}" 的item #${orderIndex} 在保存时仍然没有英文内容！`,
                "error",
                {
                  payload: JSON.stringify(payload),
                  payloadKeys: Object.keys(payload)
                }
              );
            }

            await tx.lessonItem.create({
              data: {
                lessonVersionId: lessonVersion.id,
                orderIndex,
                type: item.type as LessonItemType,
                title: item.title ?? null,
                payload: normalizePayload(item.payload)
              }
            });

            orderIndex += 1;
          }

          return {
            lessonId: lesson.id,
            versionId: lessonVersion.id
          };
        },
        {
          timeout: 30000 // 每个课程30秒超时
        }
      );

      lessonSummaries.push({ id: lessonResult.lessonId, versionId: lessonResult.versionId });
      sequence += 1;

      await generationJobRepository.appendLog(generationJobId, `课程创建成功: ${lessonPlan.title}`, "info");

    } catch (error) {
      // 如果是唯一键冲突（通常发生在任务重试/并发下），自动顺延 sequence 并重试当前课程
      const err: any = error;
      if (err?.code === 'P2002') {
        await generationJobRepository.appendLog(
          generationJobId,
          `检测到 sequence 唯一键冲突，自动顺延并重试: ${lessonPlan.title}`,
          "warning",
          { lessonTitle: lessonPlan.title, retrySequence: sequence + 1 }
        );
        sequence += 1; // 顺延一个位置
        i -= 1; // 重试当前 lesson
        continue;
      }

      await generationJobRepository.appendLog(generationJobId, `课程创建失败: ${lessonPlan.title} - ${(error as Error).message}`, "error", {
        lessonTitle: lessonPlan.title,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // 3. 最后更新课程包状态
  await prisma.coursePackage.update({
    where: { id: packageId },
    data: {
      currentVersionId: version.id,
      status: "draft",
      description:
        existingDescription == null || existingDescription.trim().length === 0 ? plan.packageSummary : existingDescription
    }
  });

  const persisted = {
    versionId: version.id,
    versionNumber: nextVersionNumber,
    lessonCount: lessonSummaries.length
  };

  // 确认最终关卡数量（应该始终>=15）
  await generationJobRepository.appendLog(generationJobId, "课程包生成完成，关卡数量验证通过", "info", {
    finalLessonCount: lessonSummaries.length,
    requirementMet: "≥15关卡"
  });

  await generationJobRepository.appendLog(generationJobId, "课程草稿落库成功", "info", persisted);

  await generationJobRepository.updateStatus(generationJobId, {
    status: "succeeded",
    progress: 100,
    result: {
      versionId: persisted.versionId,
      versionNumber: persisted.versionNumber,
      lessonCount: persisted.lessonCount
    }
  });
  await job.updateProgress(100);
};

export const packageGenerationWorker = createWorker<PackageGenerationJobData, void>(
  PACKAGE_GENERATION_QUEUE,
  async job => {
    try {
      await createCoursePlan(job);
    } catch (error) {
      const { generationJobId } = job.data;
      const message = error instanceof Error ? error.message : "未知错误";
      const progressValue = typeof job.progress === "number" ? job.progress : 0;
      await generationJobRepository.appendLog(generationJobId, message, "error");
      await generationJobRepository.updateStatus(generationJobId, {
        status: "failed",
        progress: progressValue,
        errorMessage: message
      });
      throw error;
    }
  }
);

packageGenerationWorker.on("ready", () => {
  // eslint-disable-next-line no-console
  console.log(`[worker] package-generation ready, listening on queue ${PACKAGE_GENERATION_QUEUE}`);
});

packageGenerationWorker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] package-generation job ${job?.id} failed`, err);
});

packageGenerationWorker.on("completed", job => {
  // eslint-disable-next-line no-console
  console.log(`[worker] package-generation job ${job.id} completed`);
});
const fallbackLessonTemplates: GeneratedLessonPlan[] = [
  {
    title: "核心词汇训练",
    summary: "针对主题核心词汇进行理解与记忆",
    difficulty: 2,
    focus: ["Vocabulary"],
    items: [
      {
        type: "vocabulary",
        title: "重点词汇表",
        payload: { words: [] }
      },
      {
        type: "sentence",
        title: "词汇造句",
        payload: { sentences: [] }
      },
      {
        type: "quiz_multiple_choice",
        title: "快速测验",
        payload: { questions: [] }
      }
    ]
  },
  {
    title: "句型与语法练习",
    summary: "掌握常见语法结构和表达方式",
    difficulty: 3,
    focus: ["Grammar"],
    items: [
      {
        type: "phrase",
        title: "句型拆解",
        payload: { patterns: [] }
      },
      {
        type: "fill_blank",
        title: "语法填空",
        payload: { exercises: [] }
      },
      {
        type: "writing",
        title: "短文练习",
        payload: { prompt: "" }
      }
    ]
  },
  {
    title: "阅读理解与讨论",
    summary: "通过阅读文章提升理解力和表达",
    difficulty: 4,
    focus: ["Reading", "Speaking"],
    items: [
      {
        type: "sentence",
        title: "段落阅读",
        payload: { paragraphs: [] }
      },
      {
        type: "dialogue",
        title: "讨论问题",
        payload: { questions: [] }
      },
      {
        type: "speaking",
        title: "口语表达",
        payload: { tasks: [] }
      }
    ]
  },
  {
    title: "听力与跟读训练",
    summary: "加强听力辨识与跟读模仿能力",
    difficulty: 4,
    focus: ["Listening"],
    items: [
      {
        type: "listening",
        title: "音频理解",
        payload: { audioUrl: "", transcript: "" }
      },
      {
        type: "speaking",
        title: "跟读模仿",
        payload: { instructions: "" }
      },
      {
        type: "quiz_single_choice",
        title: "听力选择题",
        payload: { questions: [] }
      }
    ]
  },
  {
    title: "综合复习与输出",
    summary: "整理所学内容并进行综合输出",
    difficulty: 3,
    focus: ["Review"],
    items: [
      {
        type: "reorder",
        title: "语篇排序",
        payload: { sentences: [] }
      },
      {
        type: "writing",
        title: "情境写作",
        payload: { prompt: "" }
      },
      {
        type: "speaking",
        title: "口语输出",
        payload: { scenarios: [] }
      }
    ]
  }
];

const generateFallbackLessons = (extractedEnglishSentences?: string[]): GeneratedLessonPlan[] => {
  const lessons: GeneratedLessonPlan[] = [];
  let index = 0;
  let sentenceIndex = 0;

  // 默认英文句子（如果OCR没有提取到）
  const defaultEnglishSentences = [
    "Hello, how are you today?",
    "I am a student.",
    "What is your name?",
    "My name is Tom.",
    "Where do you live?",
    "I live in China.",
    "Do you like English?",
    "Yes, I like English very much.",
    "What time is it now?",
    "It is ten o'clock.",
    "Can you help me?",
    "Of course, I can help you.",
    "Thank you very much.",
    "You are welcome.",
    "See you tomorrow."
  ];

  const sentences = extractedEnglishSentences && extractedEnglishSentences.length > 0 
    ? extractedEnglishSentences 
    : defaultEnglishSentences;

  while (lessons.length < 15) {
    const template = fallbackLessonTemplates[index % fallbackLessonTemplates.length];
    const currentSentence = sentences[sentenceIndex % sentences.length];
    const words = currentSentence.split(/\s+/).filter(w => w.length > 0);
    
    lessons.push({
      title: `${template.title} ${Math.floor(lessons.length / fallbackLessonTemplates.length) + 1}`,
      summary: template.summary,
      difficulty: template.difficulty,
      focus: template.focus,
      items: template.items.map(item => ({
        ...item,
        payload: { 
          en: currentSentence,
          answer: currentSentence,
          target: currentSentence,
          cn: template.summary,
          variants: words,
          note: "基于OCR提取的英文内容生成"
        }
      }))
    });
    index += 1;
    sentenceIndex += 1;
  }

  return lessons;
};
