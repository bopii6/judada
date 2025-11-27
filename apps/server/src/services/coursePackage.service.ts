import type { Express } from "express";
import { Prisma, SourceType } from "@prisma/client";
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
   * 支持单文件或多文件上传（最多10张图片）
   */
  enqueueGenerationFromUpload: async ({ packageId, file, files, triggeredById = null }: GenerateFromUploadInput) => {
    // 支持单文件或多文件上传
    const filesToUpload = files && files.length > 0 ? files : (file ? [file] : []);
    
    if (filesToUpload.length === 0) {
      throw new Error("请上传有效的文件");
    }

    // 限制最多10张图片
    if (filesToUpload.length > 10) {
      throw new Error("最多只能上传10张图片");
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const now = Date.now();
    const assets: Array<{ id: string; storagePath: string; originalName: string; mimeType: string; fileSize: number }> = [];

    // 批量上传文件
    for (let i = 0; i < filesToUpload.length; i++) {
      const currentFile = filesToUpload[i];
      if (!currentFile || !currentFile.buffer?.length) {
        continue;
      }

      const originalName = currentFile.originalname || `upload-${i}.bin`;
      const ext = path.extname(originalName).toLowerCase();
      const baseName = path.basename(originalName, ext);
      const normalizedBase = baseName
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      const safeBaseName = normalizedBase || `upload-${i}`;
      const safeFileName = `${now}-${i}-${safeBaseName}${ext || ".bin"}`;
      const storagePath = `packages/${packageId}/${safeFileName}`;
      const contentType = currentFile.mimetype || "application/octet-stream";

      const uploadResult = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storagePath, currentFile.buffer, { contentType, upsert: false });

      if (uploadResult.error) {
        throw new Error(`上传文件 ${originalName} 到存储失败：${uploadResult.error.message}`);
      }

      const sourceType: SourceType =
        contentType.includes("pdf") || originalName.toLowerCase().endsWith(".pdf") ? "pdf_upload" : "image_ocr";

      const asset = await prisma.asset.create({
        data: {
          packageId,
          storagePath,
          originalName: safeFileName,
          mimeType: contentType,
          fileSize: currentFile.size,
          sourceType,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalFileName: originalName,
            fileIndex: i,
            totalFiles: filesToUpload.length
          }
        }
      });

      assets.push({
        id: asset.id,
        storagePath: asset.storagePath,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize
      });
    }

    if (assets.length === 0) {
      throw new Error("没有成功上传任何文件");
    }

    // 确定sourceType：如果有PDF则优先使用pdf_upload，否则使用image_ocr
    const hasPdf = assets.some(a => a.mimeType.includes("pdf") || a.originalName.toLowerCase().endsWith(".pdf"));
    const sourceType: SourceType = hasPdf ? "pdf_upload" : "image_ocr";

    // 创建生成任务，包含所有文件信息
    const job = await generationJobRepository.create({
      jobType: "package_generation",
      packageId,
      triggeredById,
      sourceType,
      inputInfo: {
        assetIds: assets.map(a => a.id),
        assets: assets.map(a => ({
          assetId: a.id,
          storagePath: a.storagePath,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: a.fileSize
        })),
        totalFiles: assets.length,
        // 保持向后兼容
        assetId: assets[0].id,
        storagePath: assets[0].storagePath,
        originalName: assets[0].originalName,
        mimeType: assets[0].mimeType,
        size: assets[0].fileSize
      }
    });

    await enqueuePackageGenerationJob(job.id);

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

        // 允许删除任何状态的课程包（包括已发布的）

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
  }
};
