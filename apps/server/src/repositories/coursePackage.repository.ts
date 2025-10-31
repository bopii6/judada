import { Prisma, SourceType, VersionStatus } from "@prisma/client";
import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

export interface CoursePackageListItem {
  id: string;
  title: string;
  topic: string;
  status: string;
  coverUrl: string | null;
  updatedAt: Date;
  createdAt: Date;
  versionCount: number;
  lessonCount: number;
  currentVersion: {
    id: string;
    status: string;
    versionNumber: number;
    createdAt: Date;
  } | null;
}

export interface CoursePackageDetail {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  status: string;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: Prisma.CoursePackageVersionGetPayload<{
    include: {
      lessons: {
        orderBy: {
          sequence: "asc";
        };
        include: {
          currentVersion: {
            include: {
              items: {
                orderBy: {
                  orderIndex: "asc";
                };
              };
            };
          };
        };
      };
    };
  }> | null;
  versions: Prisma.CoursePackageVersionGetPayload<{
    include: {
      lessons: {
        select: {
          id: true;
        };
      };
      _count: {
        select: {
          lessons: true;
        };
      };
    };
    orderBy: {
      createdAt: "desc";
    };
  }>[];
  lessons: Prisma.LessonGetPayload<{
    orderBy: {
      sequence: "asc";
    };
    include: {
      currentVersion: true;
    };
  }>[];
}

export interface CreateCoursePackageInput {
  title: string;
  topic: string;
  description?: string | null;
  coverUrl?: string | null;
  createdById?: string | null;
}

export interface CreateCoursePackageVersionInput {
  packageId: string;
  label?: string | null;
  notes?: string | null;
  status?: VersionStatus;
  sourceType?: SourceType;
  payload?: Prisma.InputJsonValue | null;
  createdById?: string | null;
  previousVersionId?: string | null;
  versionNumber?: number;
}

const mapToListItem = (
  pkg: Prisma.CoursePackageGetPayload<{
    include: {
      currentVersion: {
        select: {
          id: true;
          status: true;
          versionNumber: true;
          createdAt: true;
        };
      };
      _count: {
        select: {
          versions: true;
          lessons: true;
        };
      };
    };
  }>
): CoursePackageListItem => ({
  id: pkg.id,
  title: pkg.title,
  topic: pkg.topic,
  status: pkg.status,
  coverUrl: pkg.coverUrl,
  createdAt: pkg.createdAt,
  updatedAt: pkg.updatedAt,
  versionCount: pkg._count.versions,
  lessonCount: pkg._count.lessons,
  currentVersion: pkg.currentVersion
    ? {
        id: pkg.currentVersion.id,
        status: pkg.currentVersion.status,
        versionNumber: pkg.currentVersion.versionNumber,
        createdAt: pkg.currentVersion.createdAt
      }
    : null
});

export const coursePackageRepository = {
  /**
   * 获取课程包列表及其统计信息。
   */
  listWithStats: async (): Promise<CoursePackageListItem[]> => {
    const packages = await prisma.coursePackage.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        currentVersion: {
          select: {
            id: true,
            status: true,
            versionNumber: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            versions: true,
            lessons: true
          }
        }
      }
    });

    return packages.map(mapToListItem);
  },

  /**
   * 根据 ID 获取课程包详情（包含版本、关卡等）。
   */
  findDetailById: async (id: string): Promise<CoursePackageDetail | null> => {
    const coursePackage = await prisma.coursePackage.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            lessons: {
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
            }
          }
        },
        versions: {
          orderBy: { createdAt: "desc" },
          include: {
            lessons: {
              select: { id: true }
            },
            _count: {
              select: { lessons: true }
            }
          }
        },
        lessons: {
          orderBy: { sequence: "asc" },
          include: {
            currentVersion: true
          }
        }
      }
    });

    return coursePackage as CoursePackageDetail | null;
  },

  /**
   * 创建课程包草稿。
   */
  create: (input: CreateCoursePackageInput) =>
    prisma.coursePackage.create({
      data: {
        title: input.title,
        topic: input.topic,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        createdById: input.createdById ?? null
      }
    }),

  /**
   * 创建课程包版本。
   */
  createVersion: async (input: CreateCoursePackageVersionInput) => {
    const nextVersionNumber =
      input.versionNumber ?? (await prisma.coursePackageVersion.count({ where: { packageId: input.packageId } })) + 1;

    return prisma.coursePackageVersion.create({
      data: {
        packageId: input.packageId,
        versionNumber: nextVersionNumber,
        label: input.label ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "draft",
        sourceType: input.sourceType ?? "manual_input",
        payload: input.payload ?? undefined,
        createdById: input.createdById ?? null,
        previousVersionId: input.previousVersionId ?? null
      }
    });
  },

  /**
   * 更新课程包的当前版本。
   */
  linkCurrentVersion: (packageId: string, versionId: string) =>
    prisma.coursePackage.update({
      where: { id: packageId },
      data: { currentVersionId: versionId }
    }),

  /**
   * 更新课程包基本信息。
   */
  update: (id: string, data: Prisma.CoursePackageUpdateInput) =>
    prisma.coursePackage.update({
      where: { id },
      data
    })
};

