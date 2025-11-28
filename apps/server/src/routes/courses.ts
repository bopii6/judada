import { Router } from "express";
import { CourseStatus, LessonItemType } from "@prisma/client";
import { getPrisma } from "../lib/prisma";
import { callHunyuanChat } from "../lib/hunyuan";

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
    const items = packages.map((pkg: any) => {
      // 计算已发布单元数量和总关卡数
      const publishedUnits = pkg.units;
      const totalLessons = publishedUnits.reduce((sum: number, u: any) => sum + u._count.lessons, 0);

      return {
        id: pkg.id,
        title: pkg.title,
        topic: pkg.topic,
        description: pkg.description,
        coverUrl: pkg.coverUrl,
        grade: pkg.grade,
        publisher: pkg.publisher,
        semester: pkg.semester,
        updatedAt: pkg.updatedAt,
        lessonCount: totalLessons,
        unitCount: publishedUnits.length
      };
    });

    // 获取所有可用的筛选选项（用于前端显示筛选器）
    const allPackages = await prisma.coursePackage.findMany({
      where: {
        status: CourseStatus.published,
        deletedAt: null
      },
      select: {
        grade: true,
        publisher: true
      }
    });

    const availableGrades = [...new Set(allPackages.map(p => p.grade).filter((g): g is string => !!g))].sort();
    const availablePublishers = [...new Set(allPackages.map(p => p.publisher).filter((p): p is string => !!p))];

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
                  include: { items: true }
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

    // 判断文本是否主要是中文
    const isMainlyChinese = (text: string): boolean => {
      if (!text) return false;
      const chineseChars = text.match(/[\u4e00-\u9fff]/g);
      const totalChars = text.replace(/\s/g, '').length;
      if (totalChars === 0) return false;
      return chineseChars ? chineseChars.length / totalChars > 0.5 : false;
    };

    // 翻译函数：确保始终返回英文句子的中文翻译
    // 严格禁止使用课程描述、课程标题等非翻译内容
    const getTranslation = async (en: string, payload: Record<string, any>): Promise<string> => {
      if (!en || !en.trim()) {
        return "";
      }
      
      // 只使用 payload.cn 作为翻译来源（这是专门存储英文句子翻译的字段）
      let translationCn = payload.cn || "";
      
      // 验证 payload.cn 是否是真正的翻译（不是课程描述）
      // 课程描述通常包含特定模式，如"通过...提升..."、"进行...训练"等
      if (translationCn) {
        const descriptionPatterns = [
          /通过.*提升/i,
          /进行.*训练/i,
          /进行.*练习/i,
          /学习.*掌握/i,
          /培养.*能力/i,
          /提升.*理解/i
        ];
        
        const isLikelyDescription = descriptionPatterns.some(pattern => pattern.test(translationCn));
        
        // 如果看起来像课程描述，清空它，强制生成真正的翻译
        if (isLikelyDescription) {
          console.warn(`[Translation] Detected course description instead of translation, will generate. Original: ${translationCn.substring(0, 50)}...`);
          translationCn = "";
        }
      }
      
      // 如果翻译不存在或无效，且英文句子存在，必须使用 Hunyuan 生成真正的翻译
      if (!translationCn && en) {
        try {
          console.log(`[Translation] Generating translation for: ${en.substring(0, 50)}...`);
          const translationResponse = await callHunyuanChat([
            {
              Role: "system",
              Content: "你是一位专业的英语翻译助手。请将英文句子准确翻译成中文。重要要求：1. 只返回翻译结果，不要添加任何解释、说明、课程描述或额外内容；2. 翻译要准确、自然、符合中文表达习惯；3. 绝对不要返回课程描述、学习目标、练习说明等非翻译内容；4. 如果输入是句子，返回句子的中文翻译；如果输入是单词，返回单词的中文意思。"
            },
            {
              Role: "user",
              Content: `请将以下英文句子翻译成中文，只返回翻译结果，不要添加任何其他内容：\n\n${en}`
            }
          ], { temperature: 0.2 });
          
          translationCn = translationResponse.trim();
          
          // 清理可能的额外内容（如引号、说明等）
          translationCn = translationCn
            .replace(/^["'""]|["'""]$/g, '') // 移除首尾引号
            .replace(/^翻译[：:]\s*/i, '') // 移除"翻译："前缀
            .replace(/^中文[：:]\s*/i, '') // 移除"中文："前缀
            .replace(/^以下是.*翻译[：:]\s*/i, '') // 移除"以下是...翻译："前缀
            .replace(/^.*翻译结果[：:]\s*/i, '') // 移除"翻译结果："前缀
            .trim();
          
          // 再次验证生成的内容不是课程描述
          const descriptionPatterns = [
            /通过.*提升/i,
            /进行.*训练/i,
            /进行.*练习/i
          ];
          if (descriptionPatterns.some(pattern => pattern.test(translationCn))) {
            console.warn(`[Translation] Generated content looks like description, retrying...`);
            // 如果生成的内容还是像课程描述，返回一个占位符
            translationCn = "[翻译生成中...]";
          } else {
            console.log(`[Translation] Generated: ${translationCn.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error("[Translation] Failed to translate:", error);
          // 如果翻译失败，返回一个明确的占位符
          translationCn = "[翻译生成中...]";
        }
      }
      
      // 最终验证：如果还是没有翻译，且英文句子存在，返回一个明确的提示
      if (!translationCn && en) {
        translationCn = "[翻译生成中...]";
      }
      
      return translationCn;
    };

    // 先收集所有需要处理的数据
    const stageData: Array<{
      lesson: typeof allLessons[0];
      firstItem: NonNullable<typeof allLessons[0]['currentVersion']>['items'][0];
      payload: Record<string, any>;
      en: string;
    }> = [];

    for (const lesson of allLessons) {
      const lessonItems = [...(lesson.currentVersion?.items ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
      const firstItem = lessonItems[0];

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
        en
      });
    }

    // 批量获取翻译
    const translations = await Promise.all(
      stageData.map(({ en, payload }) => getTranslation(en, payload))
    );

    // 构建 stages 数组
    const stages = stageData.map(({ lesson, firstItem, payload, en }, index) => {
      const translationCn = translations[index];
      
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
        unitNumber: lesson.unitNumber,    // 单元序号
        unitName: lesson.unitName,        // 单元名称
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

    res.json({
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        description: course.description,
        coverUrl: course.coverUrl,
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
