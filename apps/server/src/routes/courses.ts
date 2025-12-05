import { CourseStatus, LessonItemType } from "@prisma/client";
import { Router } from "express";

import { callHunyuanChat } from "../lib/hunyuan";
import { getPrisma } from "../lib/prisma";
import { ensureCourseCoverUrl } from "../utils/coverUrl";

const router: Router = Router();
const prisma = getPrisma();

const lessonItemTypeMap: Record<LessonItemType, "type" | "tiles" | "listenTap" | "speak"> = {
  vocabulary: "type",
  phrase: "type",
  sentence: "type",
  dialogue: "speak",
  quiz_single_choice: "type",
  quiz_multiple_choice: "type",
  fill_blank: "type",
  reorder: "tiles",
  listening: "listenTap",
  speaking: "speak",
  writing: "type",
  custom: "type"
};

const translationCache = new Map<string, { value: string; expiresAt: number }>();
const TRANSLATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // cache translations for 24h

router.get("/", async (req, res, next) => {
  try {
    // 从查询参数获取筛选条件
    const { grade, publisher } = req.query;

    // 构建筛选条件 - 只查询有已发布单元的课程包
    const whereCondition: any = {
      deletedAt: null,
      // 必须有至少一个已发布的单元
      units: {
        some: {
          status: CourseStatus.published,
          deletedAt: null
        }
      }
    };

    // 添加年级筛选
    if (grade && typeof grade === "string" && grade.trim()) {
      whereCondition.grade = grade.trim();
    }

    // 添加出版社筛选
    if (publisher && typeof publisher === "string" && publisher.trim()) {
      whereCondition.publisher = publisher.trim();
    }

    const packages = await (prisma as any).coursePackage.findMany({
      where: whereCondition,
      orderBy: { updatedAt: "desc" },
      include: {
        units: {
          where: {
            status: CourseStatus.published,
            deletedAt: null
          },
          orderBy: { sequence: "asc" },
          include: {
            _count: {
              select: {
                lessons: {
                  where: { deletedAt: null }
                }
              }
            }
          }
        }
      }
    });

    // 映射结果
    const items = await Promise.all(packages.map(async (pkg: any) => {
      const publishedUnits = pkg.units;
      const totalLessons = publishedUnits.reduce((sum: number, u: any) => sum + u._count.lessons, 0);

      return {
        id: pkg.id,
        title: pkg.title,
        topic: pkg.topic,
        description: pkg.description,
        coverUrl: await ensureCourseCoverUrl(pkg.coverUrl),
        grade: pkg.grade,
        publisher: pkg.publisher,
        semester: pkg.semester,
        updatedAt: pkg.updatedAt,
        lessonCount: totalLessons,
        unitCount: publishedUnits.length
      };
    }));

    // 获取所有可用的筛选选项（基于有已发布单元的课程包）
    const packagesWithPublishedUnits: Array<{ grade: string | null; publisher: string | null }> = await (prisma as any).coursePackage.findMany({
      where: {
        deletedAt: null,
        units: {
          some: {
            status: CourseStatus.published,
            deletedAt: null
          }
        }
      },
      select: {
        grade: true,
        publisher: true
      }
    });

    const availableGrades = [...new Set(packagesWithPublishedUnits.map(p => p.grade).filter((g): g is string => !!g))].sort();
    const availablePublishers = [...new Set(packagesWithPublishedUnits.map(p => p.publisher).filter((p): p is string => !!p))];

    res.json({
      courses: items,
      filters: {
        grades: availableGrades,
        publishers: availablePublishers
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/questions", async (req, res, next) => {
  try {
    // 获取课程包及其已发布的单元和关卡
    const course = await (prisma as any).coursePackage.findUnique({
      where: { id: req.params.id },
      include: {
        units: {
          where: {
            status: CourseStatus.published,
            deletedAt: null
          },
          orderBy: { sequence: "asc" },
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { sequence: "asc" },
              include: {
                currentVersion: {
                  include: {
                    items: {
                      orderBy: { orderIndex: "asc" },
                      take: 1,
                      select: {
                        id: true,
                        type: true,
                        payload: true,
                        orderIndex: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!course) {
      res.status(404).json({ error: "课程不存在" });
      return;
    }

    // 检查是否有已发布的单元
    if (course.units.length === 0) {
      res.status(404).json({ error: "该课程暂无已发布的单元" });
      return;
    }

    // 将所有已发布单元的关卡合并
    const allLessons = (course as any).units.flatMap((unit: any) =>
      unit.lessons.map((lesson: any) => ({
        ...lesson,
        unitNumber: unit.sequence,
        unitName: unit.title
      }))
    );

    if (allLessons.length === 0) {
      res.status(404).json({ error: "该课程暂无关卡内容" });
      return;
    }

    let stageSequence = 1;

    const cleanTranslationText = (text: string) =>
      text
        .replace(/^["'"“”‘’]/, "")
        .replace(/["'"“”‘’]$/, "")
        .replace(/^翻译[：:\s]*/i, "")
        .replace(/^中文[：:\s]*/i, "")
        .replace(/^以下是.*翻译[：:\s]*/i, "")
        .replace(/^.*翻译结果[：:\s]*/i, "")
        .trim();

    // 翻译函数：确保始终返回英文句子的中文翻译
    // 严格禁止使用课程描述、课程标题等非翻译内容
    const getTranslation = async ({
      en,
      payload,
      lessonItemId
    }: {
      en: string;
      payload: Record<string, any>;
      lessonItemId: string;
    }): Promise<string> => {
      if (!en || !en.trim()) {
        return "";
      }

      const cacheKey = lessonItemId || en;
      const now = Date.now();
      const cached = translationCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }
      
      // 优先使用管理员手动配置的中文翻译 payload.cn，其次才尝试 payload.translation
      let translationCn = payload.cn || (payload.translation as string) || "";
      if (translationCn) {
        translationCn = cleanTranslationText(translationCn);
        translationCache.set(cacheKey, { value: translationCn, expiresAt: now + TRANSLATION_CACHE_TTL_MS });
        return translationCn;
      }
      
      // 如果缺失或空，而英文句子存在，才使用 Hunyuan 生成新的翻译
      try {
        console.log(`[Translation] Generating translation for: ${en.substring(0, 50)}...`);
        const translationResponse = await callHunyuanChat([
          {
            Role: "system",
            Content: "你是一位专业的英语翻译助手。请将英文句子准确翻译成中文。要求：1. 只返回翻译结果，不要包含任何解释、说明或课程相关的内容；2. 需要准确、自然，符合中文表述习惯；3. 绝不要输出课程介绍、学习目标、练习说明等无关内容；4. 如果是句子，返回完整句子的翻译；如果是单词，返回词义。"
          },
          {
            Role: "user",
            Content: `请将以下英文翻译成中文：\n\n${en}`
          }
        ], { temperature: 0.2 });
        
        translationCn = cleanTranslationText(translationResponse);
        
        console.log(`[Translation] Generated: ${translationCn.substring(0, 50)}...`);
      } catch (error) {
        console.error("[Translation] Failed to translate:", error);
        // 如果生成失败，返回一个兜底占位符
        translationCn = "[翻译生成中...]";
      }
      
      // 最后保障：如果还是没有翻译，但英文存在，则返回一个兜底提示
      if (!translationCn && en) {
        translationCn = "[翻译生成中...]";
      }

      translationCache.set(cacheKey, { value: translationCn, expiresAt: now + TRANSLATION_CACHE_TTL_MS });
      return translationCn;
    };

    // 先收集所有需要处理的数据
    const stageData: Array<{
      lesson: typeof allLessons[0];
      firstItem: NonNullable<typeof allLessons[0]['currentVersion']>['items'][0];
      payload: Record<string, any>;
      en: string;
      lessonItemId: string;
    }> = [];

    for (const lesson of allLessons) {
      const firstItem = lesson.currentVersion?.items?.[0];

      if (!firstItem) {
        continue;
      }

      const payload = (firstItem.payload ?? {}) as Record<string, any>;
      // 优先使用英文内容作为主要显示内容
      let en = payload.en ?? payload.target ?? payload.answer ?? payload.enText ?? payload.text ?? payload.sentence ?? "";
      
      // 清理en字段中的换行符和多余空格，合并成一行
      if (en) {
        en = en
          .replace(/\n+/g, ' ')  // 换行符替换为空格
          .replace(/\s+/g, ' ')  // 多个空格合并为一个
          .trim();               // 去除首尾空格
      }

      stageData.push({
        lesson,
        firstItem,
        payload,
        en,
        lessonItemId: firstItem.id
      });
    }

    // 批量获取翻译
    const translations = await Promise.all(
      stageData.map(({ en, payload, lessonItemId }) => getTranslation({ en, payload, lessonItemId }))
    );

    // 构建 stages 数组
    const stages = stageData.map(({ lesson, firstItem, payload, en }, index) => {
      const translationCn = translations[index];
      const payloadPageNumber = typeof payload.pageNumber === "number" ? Number(payload.pageNumber) : null;
      const derivedPageNumber =
        payloadPageNumber ?? (typeof lesson.sourceAssetOrder === "number" ? lesson.sourceAssetOrder + 1 : null);
      
      // promptEn必须只包含英文，不能包含中文
      // 如果en为空，promptEn也应该是空的，让前端fallback到answerEn
      const promptEn = en || ""; // 只使用英文，不fallback到中文
      const promptCn = translationCn; // 英文句子的中文翻译（确保始终有值）
      const answerEn = en || ""; // 答案必须是英文
      
      const variants = Array.isArray(payload.variants)
        ? payload.variants
        : Array.isArray(payload.options)
          ? payload.options
          : [];

      return {
        id: `${lesson.id}-${firstItem.id}`,
        lessonId: lesson.id,
        lessonTitle: lesson.currentVersion?.title ?? lesson.title,
        lessonSequence: lesson.sequence,
        stageSequence: stageSequence++,
        roundIndex: lesson.roundIndex,
        roundOrder: lesson.roundOrder,
        roundTitle: lesson.roundTitle,
        unitNumber: lesson.unitNumber,    // 单元序号
        unitName: lesson.unitName,        // 单元名称
        sourceAssetId: lesson.sourceAssetId,
        sourceAssetName: lesson.sourceAssetName,
        sourceAssetOrder: lesson.sourceAssetOrder,
        pageNumber: derivedPageNumber,
        promptCn: promptCn, // 中文翻译（确保始终有值）
        promptEn: promptEn, // 英文作为主要内容（必须，不能是中文）
        answerEn: answerEn, // 答案（英文）
        variants,
        type: (lessonItemTypeMap[firstItem.type as LessonItemType] ?? "type") as "type" | "tiles" | "listenTap" | "speak",
        audioUrl: typeof payload.audioUrl === "string" ? payload.audioUrl : null,
        hints: Array.isArray(payload.hints) ? payload.hints : undefined,
        estimatedSeconds: 20
      };
    });

    // 单元数量就是已发布单元的数量
    const unitCount = (course as any).units.length;
    const coverUrl = await ensureCourseCoverUrl(course.coverUrl);

    res.json({
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        description: course.description,
        coverUrl,
        grade: course.grade,
        publisher: course.publisher,
        semester: course.semester,
        updatedAt: course.updatedAt,
        stageCount: stages.length,
        unitCount
      },
      stages
    });
  } catch (error) {
    next(error);
  }
});

export default router;
