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
  file: Express.Multer.File;
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
   */
  enqueueGenerationFromUpload: async ({ packageId, file, triggeredById = null }: GenerateFromUploadInput) => {
    if (!file || !file.buffer?.length) {
      throw new Error("请上传有效的文件");
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const now = Date.now();
    const originalName = file.originalname || "upload.bin";
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
    const contentType = file.mimetype || "application/octet-stream";

    const uploadResult = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, file.buffer, { contentType, upsert: false });

    if (uploadResult.error) {
      throw new Error(`上传文件到存储失败：${uploadResult.error.message}`);
    }

    const sourceType: SourceType =
      contentType.includes("pdf") || file.originalname.toLowerCase().endsWith(".pdf") ? "pdf_upload" : "image_ocr";

    const asset = await prisma.asset.create({
      data: {
        packageId,
        storagePath,
        originalName: safeFileName,
        mimeType: contentType,
        fileSize: file.size,
        sourceType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalFileName: originalName
        }
      }
    });

    const job = await generationJobRepository.create({
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

    return { job, asset };
  },

  /**
   * 发布当前草稿版本，供前台学员端使用
   */
  publishCurrentDraft: async (packageId: string) => {
    return prisma.$transaction(async transaction => {
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
    });
  }
};
