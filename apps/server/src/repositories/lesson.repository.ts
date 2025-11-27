import { Prisma, VersionStatus } from "@prisma/client";
import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

export interface CreateLessonInput {
  packageId: string;
  packageVersionId?: string | null;
  title: string;
  sequence: number;
  createdById?: string | null;
}

export interface CreateLessonVersionInput {
  lessonId: string;
  title: string;
  summary?: string | null;
  difficulty?: number | null;
  status?: VersionStatus;
  previousVersionId?: string | null;
  createdById?: string | null;
  versionNumber?: number;
}

export const lessonRepository = {
  /**
   * 查询课程包下的关卡列表。
   */
  listByPackageId: (packageId: string) =>
    prisma.lesson.findMany({
      where: { packageId },
      orderBy: { sequence: "asc" },
      include: {
        currentVersion: {
          include: {
            items: {
              orderBy: { orderIndex: "asc" }
            }
          }
        },
        versions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            versionNumber: true,
            createdAt: true
          }
        }
      }
    }),

  /**
   * 创建关卡及其初始版本。
   */
  createLessonWithVersion: async (
    lessonInput: CreateLessonInput,
    versionInput: Omit<CreateLessonVersionInput, "lessonId">
  ) => {
    return prisma.$transaction(async transaction => {
      const lesson = await transaction.lesson.create({
        data: {
          packageId: lessonInput.packageId,
          packageVersionId: lessonInput.packageVersionId ?? null,
          title: lessonInput.title,
          sequence: lessonInput.sequence,
          createdById: lessonInput.createdById ?? null
        }
      });

      const version = await transaction.lessonVersion.create({
        data: {
          lessonId: lesson.id,
          versionNumber: 1,
          title: versionInput.title,
          summary: versionInput.summary ?? null,
          difficulty: versionInput.difficulty ?? null,
          status: versionInput.status ?? "draft",
          previousVersionId: versionInput.previousVersionId ?? null,
          createdById: versionInput.createdById ?? null
        }
      });

      await transaction.lesson.update({
        where: { id: lesson.id },
        data: { currentVersionId: version.id }
      });

      return {
        lesson,
        version
      };
    });
  },

  /**
   * 新建或保存关卡版本。
   */
  createVersion: async (input: CreateLessonVersionInput) => {
    const nextVersionNumber =
      input.versionNumber ?? (await prisma.lessonVersion.count({ where: { lessonId: input.lessonId } })) + 1;

    return prisma.lessonVersion.create({
      data: {
        lessonId: input.lessonId,
        versionNumber: nextVersionNumber,
        title: input.title,
        summary: input.summary ?? null,
        difficulty: input.difficulty ?? null,
        status: input.status ?? "draft",
        previousVersionId: input.previousVersionId ?? null,
        createdById: input.createdById ?? null
      }
    });
  },

  /**
   * 更新当前版本指向。
   */
  linkCurrentVersion: (lessonId: string, versionId: string) =>
    prisma.lesson.update({
      where: { id: lessonId },
      data: { currentVersionId: versionId }
    }),

  /**
   * 软删除关卡（保留记录，标记删除时间）。
   */
  softDelete: (id: string) =>
    prisma.lesson.update({
      where: { id },
      data: { deletedAt: new Date() }
    }),

  /**
   * 更新关卡信息（包括单元信息）。
   */
  update: (id: string, data: Prisma.LessonUpdateInput) =>
    prisma.lesson.update({
      where: { id },
      data
    }),

  /**
   * 批量更新关卡。
   */
  updateMany: (where: Prisma.LessonWhereInput, data: Prisma.LessonUpdateInput) =>
    prisma.lesson.updateMany({
      where,
      data
    })
};

