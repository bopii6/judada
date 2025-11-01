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

    const items = packages.map(pkg => ({
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

    const questions = course.currentVersion.lessons.flatMap(lesson => {
      const difficulty = lesson.currentVersion?.difficulty ?? 3;
      const tier = Math.min(Math.max(typeof difficulty === "number" ? difficulty : 3, 1), 6);

      return (lesson.currentVersion?.items ?? []).map(item => {
        const payload = (item.payload ?? {}) as Record<string, any>;
        const baseCn = payload.cn ?? payload.prompt ?? lesson.currentVersion?.summary ?? lesson.title ?? "";
        const baseEn = payload.en ?? payload.target ?? payload.answer ?? payload.enText ?? payload.text ?? baseCn;
        const variants = Array.isArray(payload.variants)
          ? payload.variants
          : Array.isArray(payload.options)
            ? payload.options
            : [];

        return {
          id: item.id,
          tier,
          type: lessonItemTypeMap[item.type] ?? "type",
          cn: baseCn || "学习提示",
          en: baseEn || baseCn || "",
          variants,
          tags: [lesson.title]
        };
      });
    });

    res.json({
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        description: course.description,
        coverUrl: course.coverUrl,
        lessonCount: course.currentVersion.lessons.length
      },
      questions
    });
  } catch (error) {
    next(error);
  }
});

export default router;
