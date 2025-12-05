import type { Express } from "express";
import { LessonItemType, Prisma, SourceType, VersionStatus } from "@prisma/client";
import path from "node:path";
import { getPrisma } from "../lib/prisma";
import { getSupabase } from "../lib/supabase";
import { getEnv } from "../config/env";
import {
  coursePackageRepository,
  generationJobRepository,
  lessonRepository,
  CreateCoursePackageInput,
  CreateCoursePackageVersionInput
} from "../repositories";
import { enqueuePackageGenerationJob } from "../jobs/packageGeneration.queue";
import { jsonCourseImportSchema, type JsonCourseImportPayload } from "../types/jsonCourseImport";
import { parseCsvToJsonPayload } from "../utils/csvParser";

const prisma = getPrisma();

export interface PackageOverview {
  packagesTotal: number;
  lessonsTotal: number;
  pendingReviews: number;
  activeJobs: number;
}

export interface CreatePackagePayload extends CreateCoursePackageInput {
  label?: string | null;
  notes?: string | null;
}

export interface GenerateFromUploadInput {
  packageId: string;
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
  triggeredById?: string | null;
  splitPdf?: boolean;
  splitPageCount?: number;
  pageNumberStart?: number;
  unitId?: string | null;
}

export const coursePackageService = {
  /**
   * 获取仪表盘统计信息。
   */
  getOverview: async (): Promise<PackageOverview> => {
    const [packagesTotal, lessonsTotal, pendingReviews, activeJobs] = await Promise.all([
      prisma.coursePackage.count(),
      prisma.lesson.count({ where: { deletedAt: null } }),
      prisma.review.count({ where: { status: "pending" } }),
      prisma.generationJob.count({
        where: {
          status: {
            in: ["queued", "processing"]
          }
        }
      })
    ]);

    return {
      packagesTotal,
      lessonsTotal,
      pendingReviews,
      activeJobs
    };
  },

  /**
   * 课程包列表（含关卡数量、版本数量）。
   */
  listPackages: () => coursePackageRepository.listWithStats(),

  /**
   * 获取课程包详情。
   */
  getPackageDetail: async (id: string) => {
    const detail = await coursePackageRepository.findDetailById(id);
    if (!detail) {
      const error = new Error("课程包不存在");
      (error as any).status = 404;
      throw error;
    }
    return detail;
  },

  /**
   * 创建课程包草稿，并生成初始版本。
   */
  createDraftPackage: async (input: CreatePackagePayload) => {
    return prisma.$transaction(async transaction => {
      const pkg = await transaction.coursePackage.create({
        data: {
          title: input.title,
          topic: input.topic,
          description: input.description ?? null,
          coverUrl: input.coverUrl ?? null,
          createdById: input.createdById ?? null
        }
      });

      const version = await transaction.coursePackageVersion.create({
        data: {
          packageId: pkg.id,
          versionNumber: 1,
          label: input.label ?? "初始草稿",
          notes: input.notes ?? null,
          status: "draft",
          sourceType: "manual_input",
          createdById: input.createdById ?? null
        }
      });

      await transaction.coursePackage.update({
        where: { id: pkg.id },
        data: { currentVersionId: version.id }
      });

      return { pkg, version };
    });
  },

  /**
   * 记录生成任务（后续接入自动生成时会真正执行）。
   */
  createGenerationJob: (packageId: string, payload?: Prisma.InputJsonValue) =>
    generationJobRepository.create({
      jobType: "package_generation",
      packageId,
      sourceType: "manual_input",
      inputInfo: payload ?? undefined
    }),

  /**
   * 获取最近的生成任务列表。
   */
  listRecentJobs: (limit = 20) => generationJobRepository.listRecent(limit),

  /**
   * 创建关卡草稿（用于手动新增关卡）。
   */
  createLessonDraft: async (packageId: string, title: string, sequence: number, createdById?: string | null) => {
    const { lesson, version } = await lessonRepository.createLessonWithVersion(
      {
        packageId,
        title,
        sequence,
        createdById: createdById ?? null
      },
      {
        title,
        summary: null,
        difficulty: null,
        createdById: createdById ?? null
      }
    );

    return { lesson, version };
  },

  /**
   * 工具方法：创建课程包版本。
   */
  createPackageVersion: (input: CreateCoursePackageVersionInput) => coursePackageRepository.createVersion(input),

  /**
   * 上传 PDF/图片并创建生成任务。
   */
  enqueueGenerationFromUpload: async ({ packageId, file, files, triggeredById = null }: GenerateFromUploadInput) => {
    const fileList = files && files.length > 0 ? files : (file ? [file] : []);
    if (fileList.length === 0) {
      throw new Error("请上传有效的文件");
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const assets = [];
    let job = null;

    for (const uploadFile of fileList) {
      if (!uploadFile.buffer?.length) continue;

      const now = Date.now();
      const originalName = uploadFile.originalname || "upload.bin";
      const ext = path.extname(originalName).toLowerCase();
      const baseName = path.basename(originalName, ext);
      const normalizedBase = baseName
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      const safeBaseName = normalizedBase || "upload";
      const safeFileName = `${now}-${safeBaseName}${ext || ".bin"}`;
      const storagePath = `packages/${packageId}/${safeFileName}`;
      const contentType = uploadFile.mimetype || "application/octet-stream";

      const uploadResult = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storagePath, uploadFile.buffer, { contentType, upsert: false });

      if (uploadResult.error) {
        throw new Error(`上传文件到存储失败：${uploadResult.error.message}`);
      }

      const sourceType: SourceType =
        contentType.includes("pdf") || uploadFile.originalname.toLowerCase().endsWith(".pdf") ? "pdf_upload" : "image_ocr";

      const asset = await prisma.asset.create({
        data: {
          packageId,
          storagePath,
          originalName: safeFileName,
          mimeType: contentType,
          fileSize: uploadFile.size,
          sourceType,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalFileName: originalName
          }
        }
      });

      assets.push(asset);

      // 为第一个文件创建任务
      if (!job) {
        job = await generationJobRepository.create({
          jobType: "package_generation",
          packageId,
          triggeredById,
          sourceType,
          inputInfo: {
            assetId: asset.id,
            storagePath: asset.storagePath,
            originalName: asset.originalName,
            mimeType: asset.mimeType,
            size: asset.fileSize
          }
        });

        await enqueuePackageGenerationJob(job.id);
      }
    }

    if (!job) {
      throw new Error("未能创建生成任务");
    }

    return { job, assets };
  },

  /**
   * 发布当前草稿版本，供前台学员端使用
   */
  publishCurrentDraft: async (packageId: string) => {
    return prisma.$transaction(
      async transaction => {
        const pkg = await transaction.coursePackage.findUnique({
        where: { id: packageId },
        include: {
          currentVersion: {
            include: {
              lessons: {
                include: {
                  currentVersion: {
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!pkg) {
        const error = new Error("课程包不存在");
        (error as any).status = 404;
        throw error;
      }

      if (!pkg.currentVersion) {
        throw new Error("当前课程包没有可发布的版本");
      }

      // 验证课程包至少包含15个关卡
      const lessonCount = pkg.currentVersion.lessons.length;
      if (lessonCount < 15) {
        const error = new Error(`课程包必须包含至少15个关卡，当前只有${lessonCount}个关卡`);
        (error as any).status = 400;
        throw error;
      }

      const lessonIds = pkg.currentVersion.lessons.map(lesson => lesson.id);
      const lessonVersionIds = pkg.currentVersion.lessons
        .map(lesson => lesson.currentVersion?.id)
        .filter((id): id is string => Boolean(id));

      if (lessonIds.length) {
        await transaction.lesson.updateMany({
          where: { id: { in: lessonIds } },
          data: { status: "published" }
        });
      }

      if (lessonVersionIds.length) {
        await transaction.lessonVersion.updateMany({
          where: { id: { in: lessonVersionIds } },
          data: { status: "published" }
        });
      }

      await transaction.coursePackageVersion.update({
        where: { id: pkg.currentVersion.id },
        data: {
          status: "published",
          publishedAt: new Date()
        }
      });

      await transaction.coursePackage.update({
        where: { id: packageId },
        data: {
          status: "published",
          currentVersionId: pkg.currentVersion.id,
          updatedAt: new Date()
        }
      });

      return {
          packageId,
          versionId: pkg.currentVersion.id,
          lessonCount: pkg.currentVersion.lessons.length
        };
      },
      {
        timeout: 30000 // 30秒超时
      }
    );
  },

  /**
   * 删除课程包
   */
  deletePackage: async (packageId: string) => {
    return prisma.$transaction(
      async transaction => {
        // 检查课程包是否存在
        const pkg = await transaction.coursePackage.findUnique({
          where: { id: packageId },
          include: {
            versions: {
              include: {
                lessons: {
                  include: {
                    versions: true
                  }
                }
              }
            }
          }
        });

        if (!pkg) {
          const error = new Error("课程包不存在");
          (error as any).status = 404;
          throw error;
        }

        // 检查是否已发布，已发布的课程包不能删除
        if (pkg.status === 'published') {
          const error = new Error("已发布的课程包不能删除");
          (error as any).status = 400;
          throw error;
        }

        // 递归删除所有相关数据
        // 1. 删除所有课程版本
        for (const version of pkg.versions) {
          for (const lesson of version.lessons) {
            // 删除课程版本
            await transaction.lessonVersion.deleteMany({
              where: { lessonId: lesson.id }
            });
          }
          // 删除课程
          await transaction.lesson.deleteMany({
            where: { packageVersionId: version.id }
          });
        }

        // 2. 删除课程包版本
        await transaction.coursePackageVersion.deleteMany({
          where: { packageId }
        });

        // 3. 删除相关的生成任务
        await transaction.generationJob.deleteMany({
          where: { packageId }
        });

        // 4. 删除相关的资源
        await transaction.asset.deleteMany({
          where: { packageId }
        });

        // 5. 最后删除课程包
        await transaction.coursePackage.delete({
          where: { id: packageId }
        });
      },
      {
        timeout: 60000 // 60秒超时，删除操作可能需要更长时间
      }
    );
  },

  /**
   * 批量删除课程包
   */
  deletePackages: async (packageIds: string[]) => {
    const results = {
      deletedCount: 0,
      failedPackages: [] as Array<{ id: string; title: string; error: string }>
    };

    // 逐个处理，避免复杂事务
    for (const packageId of packageIds) {
      try {
        // 检查课程包是否存在
        const pkg = await prisma.coursePackage.findUnique({
          where: { id: packageId }
        });

        if (!pkg) {
          results.failedPackages.push({
            id: packageId,
            title: '未知',
            error: "课程包不存在"
          });
          continue;
        }

        // 检查是否已发布
        if (pkg.status === 'published') {
          results.failedPackages.push({
            id: packageId,
            title: pkg.title,
            error: "已发布的课程包不能删除"
          });
          continue;
        }

        // 使用单个删除方法来删除课程包
        await coursePackageService.deletePackage(packageId);
        results.deletedCount++;
      } catch (error) {
        // 获取课程包标题用于错误报告
        try {
          const pkg = await prisma.coursePackage.findUnique({
            where: { id: packageId },
            select: { title: true }
          });
          results.failedPackages.push({
            id: packageId,
            title: pkg?.title || '未知',
            error: (error as Error).message
          });
        } catch {
          results.failedPackages.push({
            id: packageId,
            title: '未知',
            error: (error as Error).message
          });
        }
      }
    }

    return results;
  },

  /**
   * 从 JSON 导入课程数据
   * 支持批量创建单元和关卡
   */
  importCourseDataFromJson: async ({
    packageId,
    payload,
    triggeredById
  }: {
    packageId: string;
    payload: unknown;
    triggeredById?: string | null;
  }) => {
    // 验证 payload 格式
    const parseResult = jsonCourseImportSchema.safeParse(payload);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      throw new Error(`JSON 格式错误: ${firstError?.path.join(".")} - ${firstError?.message}`);
    }

    const validatedPayload = parseResult.data;

    return prisma.$transaction(
      async (tx) => {
        // 验证课程包存在
        const pkg = await tx.coursePackage.findUnique({
          where: { id: packageId },
          include: { currentVersion: true }
        });

        if (!pkg) {
          throw new Error("课程包不存在");
        }

        const packageVersionId = pkg.currentVersionId;
        if (!packageVersionId) {
          throw new Error("课程包没有当前版本");
        }

        // 获取当前最大单元序号
        const maxUnitSeq = await tx.unit.aggregate({
          where: { packageId },
          _max: { sequence: true }
        });
        let unitSequenceBase = maxUnitSeq._max.sequence ?? 0;

        // 获取当前最大关卡序号
        const maxLessonSeq = await tx.lesson.aggregate({
          where: { packageVersionId },
          _max: { sequence: true }
        });
        let lessonSequence = (maxLessonSeq._max.sequence ?? 0) + 1;

        const createdUnits: Array<{
          unitId: string;
          unitTitle: string;
          createdLessons: number;
        }> = [];

        const totalSentences = validatedPayload.units.reduce(
          (sum, u) => sum + u.rounds.reduce((s, r) => s + r.sentences.length, 0),
          0
        );
        console.log(`[CSV Import] 开始导入 ${validatedPayload.units.length} 个单元，共 ${totalSentences} 个句子`);

        // 遍历每个单元
        for (const unitData of validatedPayload.units) {
          // 创建或获取单元
          let unit;
          if (unitData.unitId) {
            // 如果提供了 unitId，尝试查找现有单元
            unit = await tx.unit.findUnique({
              where: { id: unitData.unitId }
            });
            if (!unit) {
              throw new Error(`单元 ${unitData.unitId} 不存在`);
            }
          } else {
            // 创建新单元
            const unitSequence = unitData.sequence ?? ++unitSequenceBase;
            unit = await tx.unit.create({
              data: {
                packageId,
                sequence: unitSequence,
                title: unitData.title,
                description: unitData.description ?? null,
                status: "draft"
              }
            });
          }

          let unitLessonCount = 0;

          // 遍历每一轮
          for (const roundData of unitData.rounds) {
            // roundNumber 从 1 开始，roundIndex 也应该从 1 开始
            // 这样前端可以正确显示 "第 1 轮", "第 2 轮" 等
            const roundIndex = roundData.roundNumber ?? (unitData.rounds.indexOf(roundData) + 1);

            // 遍历每个句子
            for (let sentenceIdx = 0; sentenceIdx < roundData.sentences.length; sentenceIdx++) {
              const sentence = roundData.sentences[sentenceIdx];

              // 创建关卡（pageNumber 存储在 LessonItem 的 payload 中）
              const lesson = await tx.lesson.create({
                data: {
                  packageId, // 必需字段：关联到课程包
                  packageVersionId,
                  unitId: unit.id,
                  title: sentence.title || sentence.en,
                  sequence: lessonSequence++,
                  status: "draft",
                  unitNumber: unit.sequence,
                  unitName: unit.title,
                  roundIndex, // 从 1 开始
                  roundOrder: sentenceIdx + 1, // 轮内序号，从 1 开始
                  createdById: triggeredById ?? null
                }
              });

              // 创建关卡版本
              const lessonVersion = await tx.lessonVersion.create({
                data: {
                  lessonId: lesson.id,
                  versionNumber: 1,
                  title: sentence.title || sentence.en,
                  summary: sentence.summary ?? null,
                  difficulty: sentence.difficulty ?? null,
                  status: VersionStatus.draft,
                  createdById: triggeredById ?? null
                }
              });

              // 创建关卡内容项
              await tx.lessonItem.create({
                data: {
                  lessonVersionId: lessonVersion.id,
                  type: (sentence.type as LessonItemType) || "sentence",
                  title: sentence.title || sentence.en,
                  orderIndex: 0,
                  payload: {
                    en: sentence.en,
                    cn: sentence.cn || null,
                    answer: sentence.en,
                    pageNumber: sentence.pageNumber ?? null
                  }
                }
              });

              // 更新关卡的当前版本
              await tx.lesson.update({
                where: { id: lesson.id },
                data: { currentVersionId: lessonVersion.id }
              });

              unitLessonCount++;
            }
          }

          createdUnits.push({
            unitId: unit.id,
            unitTitle: unit.title,
            createdLessons: unitLessonCount
          });
        }

        // 更新课程包版本的 sourceType（使用 manual_input 表示 CSV/JSON 导入）
        await tx.coursePackageVersion.update({
          where: { id: packageVersionId },
          data: { sourceType: "manual_input" }
        });

        const totalLessons = createdUnits.reduce((sum, u) => sum + u.createdLessons, 0);
        console.log(`[CSV Import] 导入完成：${createdUnits.length} 个单元，${totalLessons} 个关卡`);

        return {
          versionId: packageVersionId,
          versionNumber: pkg.currentVersion?.versionNumber ?? 1,
          totalLessons,
          units: createdUnits
        };
      },
      {
        timeout: 300000, // 5分钟超时，处理大量数据
        maxWait: 60000 // 最长等待获取连接时间
      }
    );
  },

  /**
   * 从 CSV 导入课程数据
   * 先将 CSV 转换为 JSON 格式，然后调用 importCourseDataFromJson
   */
  importCourseDataFromCsv: async ({
    packageId,
    csvText,
    triggeredById
  }: {
    packageId: string;
    csvText: string;
    triggeredById?: string | null;
  }) => {
    // 解析 CSV 为 JSON 格式
    const parsedPayload = parseCsvToJsonPayload(csvText);
    
    // 调用 JSON 导入方法
    return coursePackageService.importCourseDataFromJson({
      packageId,
      payload: parsedPayload,
      triggeredById
    });
  },

  /**
   * 获取课程包的素材-关卡树结构
   * 用于前端展示素材和关联的关卡
   */
  getMaterialLessonTree: async (packageId: string) => {
    // 获取课程包的所有素材
    const assets = await prisma.asset.findMany({
      where: {
        packageId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    // 获取课程包当前版本
    const pkg = await prisma.coursePackage.findUnique({
      where: { id: packageId },
      select: { currentVersionId: true }
    });

    if (!pkg?.currentVersionId) {
      return {
        materials: [],
        unassignedLessons: []
      };
    }

    // 获取所有关卡
    const lessons = await prisma.lesson.findMany({
      where: {
        packageVersionId: pkg.currentVersionId,
        deletedAt: null
      },
      include: {
        currentVersion: {
          include: {
            items: {
              orderBy: { orderIndex: "asc" },
              take: 1
            }
          }
        }
      },
      orderBy: [
        { roundIndex: "asc" },
        { roundOrder: "asc" },
        { sequence: "asc" }
      ]
    });

    // 按素材ID分组关卡
    const lessonsByAsset = new Map<string, typeof lessons>();
    const unassignedLessons: typeof lessons = [];

    for (const lesson of lessons) {
      const assetId = lesson.sourceAssetId;
      if (assetId) {
        const existing = lessonsByAsset.get(assetId) ?? [];
        existing.push(lesson);
        lessonsByAsset.set(assetId, existing);
      } else {
        unassignedLessons.push(lesson);
      }
    }

    // 构建素材树
    const materials = assets.map(asset => {
      const assetLessons = lessonsByAsset.get(asset.id) ?? [];
      return {
        id: asset.id,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        sourceType: asset.sourceType,
        metadata: asset.metadata as Record<string, unknown> | null,
        createdAt: asset.createdAt.toISOString(),
        lessonCount: assetLessons.length,
        lessons: assetLessons.map(lesson => {
          const item = lesson.currentVersion?.items?.[0];
          const payload = item?.payload as Record<string, unknown> | null;
          return {
            id: lesson.id,
            title: lesson.title,
            sequence: lesson.sequence,
            unitNumber: lesson.unitNumber,
            unitName: lesson.unitName,
            unitId: lesson.unitId,
            status: lesson.status,
            sourceAssetOrder: lesson.sourceAssetOrder,
            roundIndex: lesson.roundIndex,
            roundOrder: lesson.roundOrder,
            pageNumber: (payload?.pageNumber as number) ?? null,
            itemType: item?.type ?? null,
            contentEn: (payload?.en as string) ?? (payload?.answer as string) ?? null,
            contentCn: (payload?.cn as string) ?? null
          };
        })
      };
    });

    // 转换未分配的关卡
    const unassignedLessonsList = unassignedLessons.map(lesson => {
      const item = lesson.currentVersion?.items?.[0];
      const payload = item?.payload as Record<string, unknown> | null;
      return {
        id: lesson.id,
        title: lesson.title,
        sequence: lesson.sequence,
        unitNumber: lesson.unitNumber,
        unitName: lesson.unitName,
        unitId: lesson.unitId,
        status: lesson.status,
        sourceAssetOrder: lesson.sourceAssetOrder,
        roundIndex: lesson.roundIndex,
        roundOrder: lesson.roundOrder,
        pageNumber: (payload?.pageNumber as number) ?? null,
        itemType: item?.type ?? null,
        contentEn: (payload?.en as string) ?? (payload?.answer as string) ?? null,
        contentCn: (payload?.cn as string) ?? null
      };
    });

    return {
      materials,
      unassignedLessons: unassignedLessonsList
    };
  },

  /**
   * 启动整本教材导入任务
   */
  startTextbookImportJob: async ({
    packageId,
    file,
    triggeredById,
    pageNumberStart
  }: {
    packageId: string;
    file: Express.Multer.File;
    triggeredById?: string | null;
    pageNumberStart?: number;
  }) => {
    // 使用 enqueueGenerationFromUpload 来处理
    const result = await coursePackageService.enqueueGenerationFromUpload({
      packageId,
      file,
      triggeredById
    });
    return { job: result.job };
  },

  /**
   * 更新课程包封面图片
   */
  updateCoverImage: async (packageId: string, file: Express.Multer.File) => {
    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const now = Date.now();
    const originalName = file.originalname || "cover.jpg";
    const ext = path.extname(originalName).toLowerCase() || ".jpg";
    const safeFileName = `cover-${now}${ext}`;
    const storagePath = `packages/${packageId}/covers/${safeFileName}`;
    const contentType = file.mimetype || "image/jpeg";

    const uploadResult = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, file.buffer, { contentType, upsert: true });

    if (uploadResult.error) {
      throw new Error(`上传封面失败：${uploadResult.error.message}`);
    }

    const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(storagePath);
    const coverUrl = urlData.publicUrl;

    await prisma.coursePackage.update({
      where: { id: packageId },
      data: { coverUrl }
    });

    return { coverUrl };
  },

  /**
   * 更新课程包元数据
   */
  updatePackageMetadata: async (packageId: string, payload: { title?: string; topic?: string; description?: string | null; grade?: string | null; publisher?: string | null; semester?: string | null }) => {
    const updateData: Prisma.CoursePackageUpdateInput = {};
    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.topic !== undefined) updateData.topic = payload.topic;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.grade !== undefined) updateData.grade = payload.grade;
    if (payload.publisher !== undefined) updateData.publisher = payload.publisher;
    if (payload.semester !== undefined) updateData.semester = payload.semester;

    await prisma.coursePackage.update({
      where: { id: packageId },
      data: updateData
    });

    return coursePackageService.getPackageDetail(packageId);
  },

  /**
   * 从已有素材创建生成任务
   */
  enqueueGenerationFromAssets: async (params: {
    packageId: string;
    assetIds?: string[];
    unitId?: string | null;
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
    triggeredById?: string | null;
  }) => {
    // 如果提供了 assetIds，从已有素材创建任务
    if (params.assetIds && params.assetIds.length > 0) {
      const assets = await prisma.asset.findMany({
        where: {
          id: { in: params.assetIds },
          packageId: params.packageId,
          deletedAt: null
        }
      });

      if (assets.length === 0) {
        throw new Error("未找到指定的素材");
      }

      // 使用第一个素材创建任务
      const asset = assets[0];
      const sourceType = asset.sourceType || "pdf_upload";

      const job = await generationJobRepository.create({
        jobType: "package_generation",
        packageId: params.packageId,
        triggeredById: params.triggeredById ?? null,
        sourceType,
        inputInfo: {
          assetIds: params.assetIds,
          unitId: params.unitId,
          assetId: asset.id,
          storagePath: asset.storagePath,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          size: asset.fileSize
        }
      });

      await enqueuePackageGenerationJob(job.id);

      return { job, assets };
    }

    // 否则，使用上传的文件
    return coursePackageService.enqueueGenerationFromUpload({
      packageId: params.packageId,
      file: params.file,
      files: params.files,
      triggeredById: params.triggeredById
    });
  },

  /**
   * 删除素材
   */
  deleteMaterial: async (packageId: string, assetId: string) => {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, packageId, deletedAt: null }
    });

    if (!asset) {
      throw new Error("素材不存在");
    }

    // 软删除
    await prisma.asset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  },

  /**
   * 获取素材预览 URL
   */
  getMaterialPreviewUrl: async (packageId: string, assetId: string) => {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, packageId, deletedAt: null }
    });

    if (!asset) {
      throw new Error("素材不存在");
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(asset.storagePath);

    return { url: urlData.publicUrl };
  },

  /**
   * 获取生成任务详情
   */
  getGenerationJob: async (jobId: string) => {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error("任务不存在");
    }

    return job;
  }
};
