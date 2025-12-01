import { CourseStatus, Prisma } from "@prisma/client";

import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

export interface CreateUnitInput {
  packageId: string;
  sequence: number;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
}

export interface UpdateUnitInput {
  title?: string;
  description?: string | null;
  coverUrl?: string | null;
  status?: CourseStatus;
}

export const unitService = {
  /**
   * 获取课程包下的所有单元
   */
  listByPackageId: async (packageId: string) => {
    return prisma.unit.findMany({
      where: {
        packageId,
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
                  orderBy: { orderIndex: "asc" }
                }
              }
            }
          }
        },
        _count: {
          select: {
            lessons: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });
  },

  /**
   * 获取单个单元详情
   */
  getById: async (unitId: string) => {
    return prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { sequence: "asc" },
          include: {
            currentVersion: {
              include: {
                items: {
                  orderBy: { orderIndex: "asc" }
                }
              }
            }
          }
        },
        package: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });
  },

  /**
   * 创建新单元
   */
  create: async (input: CreateUnitInput) => {
    // 获取当前最大序号（包括软删除的记录，因为sequence有唯一约束）
    const maxSequence = await prisma.unit.aggregate({
      where: {
        packageId: input.packageId
        // 不要过滤 deletedAt，因为sequence 的唯一约束包含所有记录
      },
      _max: { sequence: true }
    });

    const sequence = input.sequence ?? (maxSequence._max.sequence ?? 0) + 1;

    // 如果存在被软删除的同序号单元，先将其序号挪到末尾，释放这个编号
    const conflictUnit = await prisma.unit.findFirst({
      where: {
        packageId: input.packageId,
        sequence
      },
      select: {
        id: true,
        deletedAt: true
      }
    });

    if (conflictUnit) {
      if (!conflictUnit.deletedAt) {
        throw new Error("该单元编号已存在，请选择其他编号");
      }

      const bumpedSequence = Math.max(maxSequence._max.sequence ?? 0, sequence) + 1;
      await prisma.unit.update({
        where: { id: conflictUnit.id },
        data: { sequence: bumpedSequence }
      });
    }

    return prisma.unit.create({
      data: {
        packageId: input.packageId,
        sequence,
        title: input.title,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        status: "draft"
      }
    });
  },

  /**
   * 更新单元信息
   */
  update: async (unitId: string, input: UpdateUnitInput) => {
    const data: Prisma.UnitUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.coverUrl !== undefined) {
      data.coverUrl = input.coverUrl;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    return prisma.unit.update({
      where: { id: unitId },
      data
    });
  },

  /**
   * 发布单元（同时发布单元下的所有关卡）
   */
  publish: async (unitId: string) => {
    return prisma.$transaction(async (tx) => {
      // 获取单元及其关卡
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          lessons: {
            where: { deletedAt: null },
            include: {
              currentVersion: true
            }
          }
        }
      });

      if (!unit) {
        throw new Error("单元不存在");
      }

      if (unit.lessons.length === 0) {
        throw new Error("该单元没有关卡，无法发布");
      }

      // 更新单元状态
      await tx.unit.update({
        where: { id: unitId },
        data: { status: "published" }
      });

      // 更新所有关卡状态
      const lessonIds = unit.lessons.map(l => l.id);
      const lessonVersionIds = unit.lessons
        .map(l => l.currentVersion?.id)
        .filter((id): id is string => Boolean(id));

      if (lessonIds.length > 0) {
        await tx.lesson.updateMany({
          where: { id: { in: lessonIds } },
          data: { status: "published" }
        });
      }

      if (lessonVersionIds.length > 0) {
        await tx.lessonVersion.updateMany({
          where: { id: { in: lessonVersionIds } },
          data: { status: "published", publishedAt: new Date() }
        });
      }

      return {
        unitId,
        lessonCount: lessonIds.length
      };
    });
  },

  /**
   * 下架单元（同时下架单元下的所有关卡）
   */
  unpublish: async (unitId: string) => {
    return prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          lessons: {
            where: { deletedAt: null }
          }
        }
      });

      if (!unit) {
        throw new Error("单元不存在");
      }

      // 更新单元状态为草稿
      await tx.unit.update({
        where: { id: unitId },
        data: { status: "draft" }
      });

      // 更新所有关卡状态为草稿
      const lessonIds = unit.lessons.map(l => l.id);
      if (lessonIds.length > 0) {
        await tx.lesson.updateMany({
          where: { id: { in: lessonIds } },
          data: { status: "draft" }
        });
      }

      return {
        unitId,
        lessonCount: lessonIds.length
      };
    });
  },

  /**
   * 软删除单元
   */
  softDelete: async (unitId: string) => {
    return prisma.$transaction(async (tx) => {
      // 软删除单元下的所有关卡
      await tx.lesson.updateMany({
        where: { unitId },
        data: { deletedAt: new Date() }
      });

      // 软删除单元
      return tx.unit.update({
        where: { id: unitId },
        data: { deletedAt: new Date() }
      });
    });
  },

  /**
   * 调整单元顺序
   */
  reorder: async (packageId: string, unitIds: string[]) => {
    return prisma.$transaction(
      unitIds.map((id, index) =>
        prisma.unit.update({
          where: { id },
          data: { sequence: index + 1 }
        })
      )
    );
  }
};






