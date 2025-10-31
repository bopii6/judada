import type { Job } from "bullmq";
import { Prisma, LessonItemType } from "@prisma/client";
import pdf from "pdf-parse";
import { PACKAGE_GENERATION_QUEUE, PackageGenerationJobData } from "../jobs/packageGeneration.queue";
import { createWorker } from "../lib/queue";
import { getPrisma } from "../lib/prisma";
import { getSupabase } from "../lib/supabase";
import { getEnv } from "../config/env";
import { parsePdfToQuestions, ParsedQuestion } from "../utils/pdf";
import { recognizeImageByUrl } from "../lib/ocr";
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
    "Design a coherent mini-course from provided raw materials. Assemble 3-5 lessons, each with concise summary, a difficulty rating (1-6), and 3-6 activity items.",
    "Activity types must match the provided enum. Populate payloads with bilingual content whenever possible (both English and Chinese).",
    "Keep vocabulary and prompts concise (<= 120 characters). Avoid markdown. The JSON must pass the provided schema."
  ].join("\n");

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
        minItems: 2,
        maxItems: 6,
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
                additionalProperties: true,
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
                    type: "object"
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
  const originalName = jobInput.originalName ?? "上传文件";
  const storagePath = jobInput.storagePath;

  if (!storagePath) {
    throw new Error("任务缺少存储路径信息");
  }

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 5,
    startedAt: new Date()
  });
  await job.updateProgress(5);

  await generationJobRepository.appendLog(generationJobId, "开始下载素材", "info", {
    storagePath,
    originalName
  });

  const downloadResult = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(storagePath);
  if (downloadResult.error) {
    throw new Error(`下载素材失败: ${downloadResult.error.message}`);
  }
  const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 15
  });
  await job.updateProgress(15);

  let extractedText = "";
  let parsedQuestions: ParsedQuestion[] = [];

  if (generationJob.sourceType === "pdf_upload") {
    await generationJobRepository.appendLog(generationJobId, "解析 PDF 内容", "info", {
      mimeType: jobInput.mimeType ?? "application/pdf"
    });
    parsedQuestions = await parsePdfToQuestions(fileBuffer);
    extractedText = parsedQuestions.map(item => item.en).join("\n");
  } else {
    await generationJobRepository.appendLog(generationJobId, "请求 OCR 服务识别图片文本", "info");
    const signedUrl = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 10);

    if (signedUrl.error || !signedUrl.data?.signedUrl) {
      throw new Error("获取素材签名链接失败，无法调用 OCR");
    }

    const ocrResponse = await recognizeImageByUrl(signedUrl.data.signedUrl);
    extractedText = extractOcrText(ocrResponse);
  }

  if (!extractedText.trim()) {
    if (generationJob.sourceType === "pdf_upload") {
      const fallback = await pdf(fileBuffer);
      if (fallback.text?.trim()) {
        extractedText = fallback.text;
      }
    }
  }

  if (!extractedText.trim()) {
    throw new Error("未能从素材中提取有效文本，请确认内容质量");
  }

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 30
  });
  await job.updateProgress(30);

  const promptSegments = [
    `Source type: ${generationJob.sourceType ?? "unknown"}`,
    `Original file name: ${originalName}`,
    `Extracted text sample (<=4000 chars):\n${truncate(extractedText, 4000)}`
  ];

  const questionSummary = summarizeParsedQuestions(parsedQuestions);
  if (questionSummary) {
    promptSegments.push(`Parsed question-like sentences:\n${questionSummary}`);
  }

  await generationJobRepository.appendLog(generationJobId, "请求 OpenAI 生成课程草稿", "info", {
    model: OPENAI_MODEL_NAME
  });
  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 55
  });
  await job.updateProgress(55);

  // 使用增强的重试机制调用OpenAI
  const aiResponse = await callOpenAIWithRetry(
    async () => {
      console.log('[Worker] 开始OpenAI API调用');
      return await openai.responses.parse({
        model: OPENAI_MODEL_NAME,
        instructions: buildAiInstructions(),
        input: promptSegments.join("\n\n"),
        response_format: {
          type: "json_schema",
          json_schema: generationJsonSchema
        } as any,
        temperature: 0.4
      });
    },
    {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      retryCondition: (error: any) => {
        // 网络相关错误才重试
        return (
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('Connection error') ||
          error.message?.includes('timeout') ||
          error.message?.includes('network') ||
          error.type === 'network_error' ||
          error.status === 429 || // Rate limit
          (error.status >= 500 && error.status < 600) // Server errors
        );
      }
    }
  );

  // 确保aiResponse已定义
  if (!aiResponse) {
    throw new Error("OpenAI调用失败：未收到响应");
  }

  const plan = (aiResponse.output_parsed ?? null) as GeneratedCoursePlan | null;
  if (!plan) {
    const fallbackText = aiResponse.output_text;
    throw new Error(
      `OpenAI 没有提供可解析的 JSON 结果${fallbackText ? `：${truncate(fallbackText, 200)}` : ""}`
    );
  }

  if (!plan.lessons?.length) {
    throw new Error("生成结果为空，请尝试提供更多上下文或不同素材");
  }

  await generationJobRepository.appendLog(generationJobId, "AI 草稿生成完成，准备落库", "info", {
    lessonCount: plan.lessons.length
  });
  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 70
  });
  await job.updateProgress(70);

  const triggerUserId = generationJob.triggeredById ?? null;
  const packageId = generationJob.packageId;
  const existingDescription = generationJob.package?.description ?? null;

  const persisted = await prisma.$transaction(async transaction => {
    const versionCount = await transaction.coursePackageVersion.count({ where: { packageId } });
    const nextVersionNumber = versionCount + 1;

    const version = await transaction.coursePackageVersion.create({
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

    let sequence = 1;
    const lessonSummaries: Array<{ id: string; versionId: string }> = [];

    for (const lessonPlan of plan.lessons) {
      const lesson = await transaction.lesson.create({
        data: {
          packageId,
          packageVersionId: version.id,
          title: lessonPlan.title,
          sequence,
          createdById: triggerUserId
        }
      });

      const difficulty = clampDifficulty(lessonPlan.difficulty);

      const lessonVersion = await transaction.lessonVersion.create({
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

      await transaction.lesson.update({
        where: { id: lesson.id },
        data: { currentVersionId: lessonVersion.id }
      });

      const validItems = Array.isArray(lessonPlan.items) ? lessonPlan.items : [];
      let orderIndex = 1;

      for (const item of validItems) {
        if (!item || typeof item !== "object") continue;
        if (!LESSON_ITEM_TYPES.includes(item.type as LessonItemType)) continue;

        await transaction.lessonItem.create({
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

      lessonSummaries.push({ id: lesson.id, versionId: lessonVersion.id });
      sequence += 1;
    }

    await transaction.coursePackage.update({
      where: { id: packageId },
      data: {
        currentVersionId: version.id,
        status: "draft",
        description:
          existingDescription == null || existingDescription.trim().length === 0 ? plan.packageSummary : existingDescription
      }
    });

    return {
      versionId: version.id,
      versionNumber: nextVersionNumber,
      lessonCount: lessonSummaries.length
    };
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
