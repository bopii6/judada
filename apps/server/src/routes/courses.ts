import { Router } from "express";
import { CourseStatus, LessonItemType } from "@prisma/client";
import { getPrisma } from "../lib/prisma";

const router = Router();
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

router.get("/", async (_req, res, next) => {
  try {
    const packages = await prisma.coursePackage.findMany({
      where: {
        status: CourseStatus.published,
        deletedAt: null,
        currentVersion: {
          isNot: null
        }
      },
      orderBy: { updatedAt: "desc" },
      include: {
        currentVersion: {
          select: {
            id: true,
            lessons: {
              select: { id: true },
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    // 过滤出至少包含15个关卡的课程包
    const items = packages
      .filter(pkg => {
        const lessonCount = pkg.currentVersion?.lessons.length ?? 0;
        return lessonCount >= 15;
      })
      .map(pkg => ({
        id: pkg.id,
        title: pkg.title,
        topic: pkg.topic,
        description: pkg.description,
        coverUrl: pkg.coverUrl,
        updatedAt: pkg.updatedAt,
        lessonCount: pkg.currentVersion?.lessons.length ?? 0
      }));

    res.json({ courses: items });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/questions", async (req, res, next) => {
  try {
    const course = await prisma.coursePackage.findUnique({
      where: { id: req.params.id },
      include: {
        currentVersion: {
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

    if (!course || course.status !== CourseStatus.published || !course.currentVersion) {
      res.status(404).json({ error: "课程不存在或未发布" });
      return;
    }

    // 验证课程包是否包含至少15个关卡
    const lessonCount = course.currentVersion.lessons.length;
    if (lessonCount < 15) {
      res.status(404).json({ error: `课程不符合要求：必须包含至少15个关卡，当前只有${lessonCount}个关卡` });
      return;
    }

    let stageSequence = 1;

    const stages = course.currentVersion.lessons.flatMap(lesson => {
      const lessonItems = [...(lesson.currentVersion?.items ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
      const firstItem = lessonItems[0];

      if (!firstItem) {
        return [];
      }

      const payload = (firstItem.payload ?? {}) as Record<string, any>;
      const cn = payload.cn ?? payload.prompt ?? lesson.currentVersion?.summary ?? lesson.title ?? "";
      const en = payload.en ?? payload.target ?? payload.answer ?? payload.enText ?? payload.text ?? cn;
      const variants = Array.isArray(payload.variants)
        ? payload.variants
        : Array.isArray(payload.options)
          ? payload.options
          : [];

      const stage = {
        id: `${lesson.id}-${firstItem.id}`,
        lessonId: lesson.id,
        lessonTitle: lesson.currentVersion?.title ?? lesson.title,
        lessonSequence: lesson.sequence,
        stageSequence: stageSequence++,
        promptCn: cn || "学习提示",
        answerEn: en || cn || "",
        variants,
        type: lessonItemTypeMap[firstItem.type] ?? "type",
        audioUrl: typeof payload.audioUrl === "string" ? payload.audioUrl : null,
        hints: Array.isArray(payload.hints) ? payload.hints : undefined,
        estimatedSeconds: 20
      };

      return [stage];
    });

    res.json({
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        description: course.description,
        coverUrl: course.coverUrl,
        updatedAt: course.updatedAt,
        stageCount: stages.length
      },
      stages
    });
  } catch (error) {
    next(error);
  }
});

export default router;
