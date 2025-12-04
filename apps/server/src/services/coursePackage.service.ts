import path from "node:path";

import { Prisma, SourceType } from "@prisma/client";
import type { Express } from "express";

import { getEnv } from "../config/env";
import { enqueuePackageGenerationJob } from "../jobs/packageGeneration.queue";
import { getPrisma } from "../lib/prisma";
import { getSupabase } from "../lib/supabase";
import {
  coursePackageRepository,
  CreateCoursePackageInput,
  CreateCoursePackageVersionInput,
  generationJobRepository,
  lessonRepository
} from "../repositories";
import { extractPdfRange,splitPdfIntoChunks } from "../utils/pdfSplit";
import { extractTextbookToc } from "../utils/textbookToc";

const prisma = getPrisma();
type UploadableFile = Pick<Express.Multer.File, "originalname" | "mimetype" | "size" | "buffer">;
type IncomingUploadFile = Express.Multer.File | UploadableFile;

const toUploadableFile = (file: IncomingUploadFile): UploadableFile => ({
  originalname: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  buffer: file.buffer
});

const normalizeUploadableFiles = (items?: IncomingUploadFile[]): UploadableFile[] =>
  (items ?? []).map(toUploadableFile);

const toJsonValue = (value: unknown): Prisma.JsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    const result = value
      .map(item => toJsonValue(item))
      .filter((item): item is Prisma.JsonValue => item !== undefined);
    return result as Prisma.JsonArray;
  }
  if (typeof value === "object" && value) {
    return Object.entries(value as Record<string, unknown>).reduce<Prisma.JsonObject>((acc, [key, entry]) => {
      const sanitized = toJsonValue(entry);
      if (sanitized !== undefined) {
        acc[key] = sanitized;
      }
      return acc;
    }, {});
  }
  return undefined;
};

const toJsonObject = (value: Record<string, unknown>): Prisma.JsonObject => {
  const jsonObject: Prisma.JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    const sanitized = toJsonValue(entry);
    if (sanitized !== undefined) {
      jsonObject[key] = sanitized;
    }
  }
  return jsonObject;
};

const ensureLessonTargetMetadata = (metadata: Prisma.JsonObject) => {
  const record = metadata as Record<string, unknown>;
  if (record.lessonTargetCount === undefined) {
    record.lessonTargetCount = DEFAULT_UNIT_LESSON_TARGET;
  }
  return metadata;
};

const COURSE_COVER_FOLDER = "course-covers";
const COURSE_COVER_ROUTE_PREFIX = "/api/course-covers";
const ALLOWED_COVER_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const COVER_PATH_REGEX = /course-covers\/.+$/;
let hasEnsuredCoverBucket = false;
const MAX_UPLOAD_FILES = 10;
const MAX_SPLIT_PDF_PARTS = 200;
const DEFAULT_SPLIT_PAGE_COUNT = 8;
const MIN_SPLIT_PAGE_COUNT = 1;
const MAX_SPLIT_PAGE_COUNT = 16;
const MAX_DIRECT_FILE_SIZE = 15 * 1024 * 1024; // 15MB 图片/小文件限制
const MAX_SPLITTABLE_PDF_SIZE = 80 * 1024 * 1024; // 80MB 单个PDF上限，用于自动切分
const DEFAULT_UNIT_LESSON_TARGET = 5;

const sanitizeCoverFileName = (name: string) => {
  if (!name) return "cover";
  const base = path.basename(name, path.extname(name));
  const normalized = base
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "cover";
};

const inferCoverExtension = (file: Express.Multer.File) => {
  const originalExt = path.extname(file.originalname || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(originalExt)) {
    return originalExt;
  }
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  return ".jpg";
};

const getCoverStoragePath = (coverUrl?: string | null) => {
  if (!coverUrl) return null;
  const match = coverUrl.match(COVER_PATH_REGEX);
  if (!match) return null;
  return match[0];
};

const ensureCoverBucket = async () => {
  if (hasEnsuredCoverBucket) return;
  const { SUPABASE_STORAGE_BUCKET } = getEnv();
  const supabase = getSupabase();

  const { data, error } = await supabase.storage.getBucket(SUPABASE_STORAGE_BUCKET);
  if (error && error.message && !error.message.toLowerCase().includes("not found")) {
    throw new Error(`封面存储空间暂不可用：${error.message}`);
  }

  if (!data) {
    const { error: createError } = await supabase.storage.createBucket(SUPABASE_STORAGE_BUCKET, {
      public: false,
      allowedMimeTypes: Array.from(ALLOWED_COVER_MIME),
      fileSizeLimit: "5242880"
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(`封面存储空间初始化失败：${createError.message}`);
    }
  }

  hasEnsuredCoverBucket = true;
};

export interface PackageOverview {
  packagesTotal: number;
  lessonsTotal: number;
  pendingReviews: number;
  activeJobs: number;
}

export interface CreatePackagePayload extends CreateCoursePackageInput {
  label?: string | null;
  notes?: string | null;
  grade?: string | null;      // 年级
  publisher?: string | null;  // 出版社
  semester?: string | null;   // 学期
}

export interface GenerateFromUploadInput {
  packageId: string;
  file?: IncomingUploadFile;
  files?: IncomingUploadFile[];
  triggeredById?: string | null;
  unitId?: string | null; // 关联的单元ID
  splitPdf?: boolean;
  splitPageCount?: number;
  fileMetadata?: Array<Record<string, unknown>>;
  maxFileCountOverride?: number;
  pageNumberStart?: number;
}

const isPdfFile = (file: UploadableFile | null | undefined) => {
  if (!file) return false;
  const mime = file.mimetype?.toLowerCase() ?? "";
  if (mime.includes("pdf")) return true;
  const ext = path.extname(file.originalname ?? "").toLowerCase();
  return ext === ".pdf";
};

const clampSplitPageCount = (value?: number) => {
  if (typeof value !== "number") return DEFAULT_SPLIT_PAGE_COUNT;
  if (Number.isNaN(value)) return DEFAULT_SPLIT_PAGE_COUNT;
  return Math.min(Math.max(Math.round(value), MIN_SPLIT_PAGE_COUNT), MAX_SPLIT_PAGE_COUNT);
};

export interface UpdatePackagePayload {
  title?: string;
  topic?: string;
  description?: string | null;
  grade?: string | null;      // 年级
  publisher?: string | null;  // 出版社
  semester?: string | null;   // 学期
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
          grade: input.grade ?? null,
          publisher: input.publisher ?? null,
          semester: input.semester ?? null,
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
   * 更新课程包的基础信息（标题、主题、简介、年级、出版社、学期）
   */
  updatePackageMetadata: async (packageId: string, input: UpdatePackagePayload) => {
    const pkg = await prisma.coursePackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      const error = new Error("课程包不存在");
      (error as any).status = 404;
      throw error;
    }

    const data: Prisma.CoursePackageUpdateInput = {};
    if (input.title !== undefined) {
      const trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        const error = new Error("课程包名称不能为空");
        (error as any).status = 400;
        throw error;
      }
      data.title = trimmedTitle;
    }
    if (input.topic !== undefined) {
      const trimmedTopic = input.topic.trim();
      if (!trimmedTopic) {
        const error = new Error("课程主题不能为空");
        (error as any).status = 400;
        throw error;
      }
      data.topic = trimmedTopic;
    }
    if (input.description !== undefined) {
      const trimmedDescription = input.description?.trim();
      data.description = trimmedDescription && trimmedDescription.length > 0 ? trimmedDescription : null;
    }
    if (input.grade !== undefined) {
      const trimmedGrade = input.grade?.trim();
      data.grade = trimmedGrade && trimmedGrade.length > 0 ? trimmedGrade : null;
    }
    if (input.publisher !== undefined) {
      const trimmedPublisher = input.publisher?.trim();
      data.publisher = trimmedPublisher && trimmedPublisher.length > 0 ? trimmedPublisher : null;
    }
    if (input.semester !== undefined) {
      const trimmedSemester = input.semester?.trim();
      data.semester = trimmedSemester && trimmedSemester.length > 0 ? trimmedSemester : null;
    }

    if (Object.keys(data).length > 0) {
      await coursePackageRepository.update(packageId, data);
    }

    const detail = await coursePackageRepository.findDetailById(packageId);
    if (!detail) {
      const error = new Error("课程包不存在");
      (error as any).status = 404;
      throw error;
    }
    return detail;
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
   * 支持单文件或多文件上传，若开启自动切分可将整本 PDF 拆成多个素材。
   */
  enqueueGenerationFromUpload: async ({
    packageId,
    file,
    files,
    triggeredById = null,
    unitId = null,
    splitPdf = false,
    splitPageCount,
    fileMetadata = [],
    maxFileCountOverride,
    pageNumberStart
  }: GenerateFromUploadInput) => {
    let filesToUpload: UploadableFile[] =
      files && files.length > 0 ? normalizeUploadableFiles(files) : file ? [toUploadableFile(file)] : [];

    if (filesToUpload.length === 0) {
      throw new Error("请上传有效的文件");
    }

    const normalizedSplitPages = clampSplitPageCount(splitPageCount);
    const normalizedPageNumberStart =
      typeof pageNumberStart === "number" && Number.isFinite(pageNumberStart) && pageNumberStart > 0
        ? Math.round(pageNumberStart)
        : null;
    const shouldSplitPdf = splitPdf && filesToUpload.length === 1 && isPdfFile(filesToUpload[0]);
    const baseMetadata = fileMetadata.map(entry => ensureLessonTargetMetadata(toJsonObject(entry ?? {})));
    const cloneMetadataList = (length: number, source: Prisma.JsonObject[]) =>
      Array.from({ length }, (_, index) => ({ ...(source[index] ?? {}) }));
    let perFileMetadata = cloneMetadataList(filesToUpload.length, baseMetadata);
    const pageNumberOffset = normalizedPageNumberStart !== null ? normalizedPageNumberStart - 1 : 0;

    if (shouldSplitPdf) {
      const targetFile = filesToUpload[0];
      if (targetFile.size > MAX_SPLITTABLE_PDF_SIZE) {
        throw new Error("PDF 文件过大，暂不支持自动切分（上限 80MB）");
      }

      const originalExt = path.extname(targetFile.originalname || ".pdf") || ".pdf";
      const baseName = path.basename(targetFile.originalname || "material.pdf", originalExt);
      const chunks = await splitPdfIntoChunks(targetFile.buffer, {
        pagesPerChunk: normalizedSplitPages,
        maxChunks: MAX_SPLIT_PDF_PARTS
      });

      if (chunks.length === 0) {
        throw new Error("未能从 PDF 中读取有效页面");
      }

      const metadataForChunks: Prisma.JsonObject[] = chunks.map(chunk =>
        ensureLessonTargetMetadata(
          toJsonObject({
            ...(baseMetadata[0] ?? {}),
            pageRange: {
              start: chunk.pageStart + pageNumberOffset,
              end: chunk.pageEnd + pageNumberOffset,
              total: chunk.totalPages
            },
            splitIndex: chunk.chunkIndex,
            splitCount: chunks.length
          })
        )
      );

      filesToUpload = chunks.map(chunk => {
        const paddedStart = String(chunk.pageStart).padStart(2, "0");
        const paddedEnd = String(chunk.pageEnd).padStart(2, "0");
        const chunkName = `${baseName}-p${paddedStart}-p${paddedEnd}${originalExt}`;
        return {
          originalname: chunkName,
          mimetype: targetFile.mimetype || "application/pdf",
          size: chunk.buffer.byteLength,
          buffer: chunk.buffer
        };
      });
      perFileMetadata = metadataForChunks;
    } else {
      perFileMetadata = cloneMetadataList(filesToUpload.length, baseMetadata);
    }

    const maxAllowed = shouldSplitPdf ? MAX_SPLIT_PDF_PARTS : maxFileCountOverride ?? MAX_UPLOAD_FILES;
    if (filesToUpload.length > maxAllowed) {
      throw new Error(`最多只能上传 ${maxAllowed} 份素材`);
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

       if (!shouldSplitPdf && currentFile.size > MAX_DIRECT_FILE_SIZE) {
         throw new Error("文件大小不能超过15MB");
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

      const extra = perFileMetadata[i] ?? ({} as Prisma.JsonObject);
      const metadata = toJsonObject({
        uploadedAt: new Date().toISOString(),
        originalFileName: originalName,
        fileIndex: i,
        totalFiles: filesToUpload.length,
        ...extra
      });
      if (shouldSplitPdf) {
        const splitData = extra as Record<string, unknown>;
        const splitInfo = toJsonValue({
          chunkIndex: typeof splitData.splitIndex === "number" ? (splitData.splitIndex as number) : i,
          chunkCount: typeof splitData.splitCount === "number" ? (splitData.splitCount as number) : filesToUpload.length,
          splitPageCount: normalizedSplitPages
        });
        if (splitInfo !== undefined) {
          metadata.splitInfo = splitInfo;
        }
      }

      const asset = await prisma.asset.create({
        data: {
          packageId,
          storagePath,
          originalName: safeFileName,
          mimeType: contentType,
          fileSize: currentFile.size,
          sourceType,
          metadata
        }
      });

      const safeMimeType = asset.mimeType ?? contentType ?? "application/octet-stream";
      const safeFileSize = asset.fileSize ?? currentFile.size ?? currentFile.buffer?.length ?? 0;

      assets.push({
        id: asset.id,
        storagePath: asset.storagePath,
        originalName: asset.originalName,
        mimeType: safeMimeType,
        fileSize: safeFileSize
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
      unitId, // 关联单元ID
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
        unitId, // 也存储在 inputInfo 中
        // 保持向后兼容
        assetId: assets[0].id,
        storagePath: assets[0].storagePath,
        originalName: assets[0].originalName,
        mimeType: assets[0].mimeType,
        size: assets[0].fileSize,
        pageNumberStart: normalizedPageNumberStart
      }
    });

    await enqueuePackageGenerationJob(job.id);

    return { job, assets };
  },

  /**
   * 上传或替换课程封面图
   */
  updateCoverImage: async (packageId: string, file: Express.Multer.File) => {
    if (!file) {
      const error = new Error("请上传封面图片");
      (error as any).status = 400;
      throw error;
    }

    if (!file.mimetype || !ALLOWED_COVER_MIME.has(file.mimetype.toLowerCase())) {
      const error = new Error("仅支持 PNG/JPG/WebP 图片作为封面");
      (error as any).status = 400;
      throw error;
    }

    const pkg = await prisma.coursePackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      const error = new Error("课程包不存在");
      (error as any).status = 404;
      throw error;
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const ext = inferCoverExtension(file);
    const baseName = sanitizeCoverFileName(file.originalname ?? "cover").slice(0, 40);
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const safeFileName = `${baseName}-${Date.now()}-${uniqueSuffix}${ext}`;
    const storagePath = `${COURSE_COVER_FOLDER}/${packageId}/${safeFileName}`;
    const contentType = file.mimetype || "image/jpeg";

    await ensureCoverBucket();

    const uploadOnce = () =>
      supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(storagePath, file.buffer, {
        contentType,
        upsert: false
      });

    let uploadResult = await uploadOnce();
    if (uploadResult.error && uploadResult.error.message?.toLowerCase().includes("not found")) {
      hasEnsuredCoverBucket = false;
      await ensureCoverBucket();
      uploadResult = await uploadOnce();
    }

    if (uploadResult.error) {
      throw new Error(`上传封面失败：${uploadResult.error.message}`);
    }

    const previousPath = getCoverStoragePath(pkg.coverUrl);
    if (previousPath && previousPath !== storagePath) {
      await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .remove([previousPath])
        .catch(() => {
          /* ignore cleanup failure */
        });
    }

    const coverUrl = `${COURSE_COVER_ROUTE_PREFIX}/${packageId}/${safeFileName}`;
    await prisma.coursePackage.update({
      where: { id: packageId },
      data: { coverUrl }
    });

    return { coverUrl };
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
        const pkg = await transaction.coursePackage.findUnique({
          where: { id: packageId },
          select: { id: true }
        });

        if (!pkg) {
          const error = new Error("课程包不存在");
          (error as any).status = 404;
          throw error;
        }

        // 使用批量删除，避免嵌套循环导致事务长时间占用连接
        await transaction.lessonVersion.deleteMany({
          where: {
            lesson: {
              is: {
                packageId
              }
            }
          }
        });

        await transaction.lesson.deleteMany({
          where: { packageId }
        });

        await transaction.coursePackageVersion.deleteMany({
          where: { packageId }
        });

        await transaction.generationJob.deleteMany({
          where: { packageId }
        });

        await transaction.asset.deleteMany({
          where: { packageId }
        });

        await transaction.unit.deleteMany({
          where: { packageId }
        });

        await transaction.coursePackage.delete({
          where: { id: packageId }
        });
      },
      {
        timeout: 60000 // 60秒超时，删除链路可能需要更长时间
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

  enqueueGenerationFromAssets: async (params: {
    packageId: string;
    assetIds: string[];
    unitId?: string | null;
    triggeredById?: string | null;
  }) => {
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: params.assetIds },
        packageId: params.packageId,
        deletedAt: null
      }
    });

    if (assets.length === 0) {
      const error = new Error("未找到可用的素材文件");
      (error as any).status = 404;
      throw error;
    }

    const hasPdf = assets.some(
      asset => asset.mimeType?.toLowerCase().includes("pdf") || asset.originalName.toLowerCase().endsWith(".pdf")
    );
    const sourceType: SourceType = hasPdf ? "pdf_upload" : "image_ocr";

    const job = await generationJobRepository.create({
      jobType: "package_generation",
      packageId: params.packageId,
      triggeredById: params.triggeredById,
      sourceType,
      unitId: params.unitId ?? null,
      inputInfo: {
        assetIds: assets.map(asset => asset.id),
        assets: assets.map(asset => ({
          assetId: asset.id,
          storagePath: asset.storagePath,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          size: asset.fileSize ?? 0
        })),
        totalFiles: assets.length,
        unitId: params.unitId ?? null
      }
    });

    await enqueuePackageGenerationJob(job.id);
    return { job, assets };
  },

  /**
   * 上传整本教材 PDF，解析目录并自动创建单元和生成任务
   */
  importTextbookFromPdf: async (
    packageId: string,
    file: Express.Multer.File,
    triggeredById?: string | null,
    pageNumberStart?: number
  ) => {
    if (!file || !file.buffer?.length) {
      const error = new Error("请上传完整的教材 PDF");
      (error as any).status = 400;
      throw error;
    }

    if (!isPdfFile(file)) {
      const error = new Error("仅支持上传 PDF 格式的教材文件");
      (error as any).status = 400;
      throw error;
    }

    const tocResult = await extractTextbookToc(file.buffer);
    if (!tocResult.units.length) {
      throw new Error("未能从教材目录中解析出单元信息，请检查目录排版");
    }
    const autoOffset = tocResult.pageOffset ?? 0;
    const pdfPageOffset =
      typeof pageNumberStart === "number" && Number.isFinite(pageNumberStart) && pageNumberStart > 0
        ? pageNumberStart - 1
        : autoOffset;

    const clampPdfPage = (printedPage: number) => {
      const page = printedPage - pdfPageOffset;
      return Math.max(1, Math.min(tocResult.totalPages, page));
    };

    const allUnits = await prisma.unit.findMany({
      where: { packageId },
      orderBy: { sequence: "asc" }
    });
    const activeUnits = allUnits.filter(unit => unit.deletedAt === null);
    const existingMap = new Map(activeUnits.map(unit => [unit.title.toLowerCase(), unit]));
    const existingSequences = new Set(allUnits.map(unit => unit.sequence));
    let sequenceCursor = activeUnits.reduce((max, unit) => Math.max(max, unit.sequence ?? 0), 0);
    const createdUnits: Array<{
      unitId: string;
      title: string;
      pageStart: number;
      pageEnd: number;
      jobId: string;
    }> = [];

    for (const entry of tocResult.units) {
      const titleFromToc = entry.topic ? `${entry.unitLabel} ${entry.topic}` : entry.unitLabel;
      const normalizedTitle = titleFromToc.trim() || entry.unitLabel;
      const normalizedKey = normalizedTitle.toLowerCase();
      let unit = existingMap.get(normalizedKey);

      if (!unit) {
        sequenceCursor += 1;
        while (existingSequences.has(sequenceCursor)) {
          sequenceCursor += 1;
        }
        unit = await prisma.unit.create({
          data: {
            packageId,
            sequence: sequenceCursor,
            title: normalizedTitle,
            description: entry.topic ?? null,
            status: "draft"
          }
        });
        existingSequences.add(sequenceCursor);
        existingMap.set(normalizedKey, unit);
      }

      const safeName = normalizedTitle.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48) || `unit-${sequenceCursor}`;
      const perPageFiles: UploadableFile[] = [];
      const fileMetadata: Record<string, unknown>[] = [];
      for (let page = entry.startPage; page <= entry.endPage; page++) {
        const pdfPageIndex = clampPdfPage(page);
        const slice = await extractPdfRange(file.buffer, pdfPageIndex, pdfPageIndex);
        const detectedPrintedPage =
          tocResult.printedPageNumbers[pdfPageIndex - 1] ?? pdfPageIndex + pdfPageOffset;
        perPageFiles.push({
          originalname: `${safeName}-page-${detectedPrintedPage}.pdf`,
          mimetype: file.mimetype || "application/pdf",
          size: slice.buffer.byteLength,
          buffer: slice.buffer
        });
        fileMetadata.push({
          source: "textbook_import",
          pageRange: {
            start: detectedPrintedPage,
            end: detectedPrintedPage,
            total: slice.totalPages
          },
          lessonPages: [detectedPrintedPage],
          lessonTargetCount: 5
        });
      }

      const { job } = await coursePackageService.enqueueGenerationFromUpload({
        packageId,
        files: perPageFiles,
        triggeredById: triggeredById ?? null,
        unitId: unit.id,
        fileMetadata,
        maxFileCountOverride: perPageFiles.length
      });

      createdUnits.push({
        unitId: unit.id,
        title: unit.title,
        pageStart: entry.startPage,
        pageEnd: entry.endPage,
        jobId: job.id
      });
    }

    const reorderedUnits = await prisma.unit.findMany({
      where: { packageId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    await prisma.$transaction(
      reorderedUnits.map((unit, index) =>
        prisma.unit.update({
          where: { id: unit.id },
          data: { sequence: index + 1 }
        })
      )
    );

    return { units: createdUnits };
  },
  getMaterialLessonTree: async (packageId: string) => {
    const [assets, lessons] = await Promise.all([
      prisma.asset.findMany({
        where: { packageId, deletedAt: null },
        orderBy: [{ createdAt: "asc" }]
      }),
      prisma.lesson.findMany({
        where: { packageId, deletedAt: null },
        orderBy: [{ sequence: "asc" }],
        include: {
          currentVersion: {
            include: {
              items: {
                orderBy: { orderIndex: "asc" }
              }
            }
          }
        }
      })
    ]);

    const lessonMap = new Map<string, typeof lessons>();
    for (const lesson of lessons) {
      if (!lesson.sourceAssetId) continue;
      if (!lessonMap.has(lesson.sourceAssetId)) {
        lessonMap.set(lesson.sourceAssetId, []);
      }
      lessonMap.get(lesson.sourceAssetId)?.push(lesson);
    }

    const materials = assets.map(asset => ({
      id: asset.id,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      sourceType: asset.sourceType,
      metadata: asset.metadata ?? null,
      createdAt: asset.createdAt,
      lessonCount: lessonMap.get(asset.id)?.length ?? 0,
      lessons: (lessonMap.get(asset.id) ?? []).map(entry => {
        const firstItem = entry.currentVersion?.items?.[0];
        const payload = (firstItem?.payload ?? {}) as Record<string, unknown>;
        
        // 详细日志：追踪数据读取
        const summary = entry.currentVersion?.summary;
        const payloadCn = payload.cn as string | undefined;
        const payloadPrompt = payload.prompt as string | undefined;
        const payloadEn = (payload.en as string) ?? (payload.target as string) ?? (payload.answer as string) ?? null;
        
        // 详细日志：打印每个关卡的数据结构
        console.log(`[DEBUG MaterialLessonTree] Lesson #${entry.sequence} "${entry.title}":`, {
          lessonId: entry.id,
          summary: summary || '(null)',
          payloadKeys: Object.keys(payload),
          payloadCn: payloadCn || '(null)',
          payloadPrompt: payloadPrompt || '(null)',
          payloadEn: payloadEn || '(null)',
          // 检查是否有问题：如果 cn 等于 summary，说明数据有问题
          isCnSameAsSummary: payloadCn === summary ? '⚠️ 警告：cn 等于 summary!' : '✓ 正常'
        });
        
        return {
          id: entry.id,
          title: entry.title,
          sequence: entry.sequence,
          unitNumber: entry.unitNumber,
          unitName: entry.unitName,
          unitId: entry.unitId,
          status: entry.status,
          sourceAssetOrder: entry.sourceAssetOrder,
          itemType: firstItem?.type ?? "sentence",
          roundIndex: entry.roundIndex,
          roundOrder: entry.roundOrder,
          pageNumber:
            typeof (payload.pageNumber as number | undefined) === "number"
              ? Number(payload.pageNumber)
              : typeof entry.sourceAssetOrder === "number"
                ? entry.sourceAssetOrder + 1
                : null,
          contentEn:
            (payload.en as string) ??
            (payload.target as string) ??
            (payload.answer as string) ??
            null,
          contentCn: (() => {
            const cn = (payload.cn as string) ?? (payload.prompt as string) ?? null;
            const en = (payload.en as string) ?? (payload.target as string) ?? (payload.answer as string) ?? null;
            // 如果 cn 等于 en，说明存储的是英文而不是翻译，返回 null
            if (cn && en && cn.trim() === en.trim()) {
              return null;
            }
            // 如果 cn 等于 summary，说明存储的是摘要而不是翻译，返回 null
            if (cn && summary && cn.trim() === summary.trim()) {
              return null;
            }
            return cn;
          })()
        };
      })
    }));

    const unassignedLessons = lessons
      .filter(item => !item.sourceAssetId)
      .map(item => ({
        id: item.id,
        title: item.title,
        sequence: item.sequence,
        unitNumber: item.unitNumber,
        unitName: item.unitName,
        unitId: item.unitId,
        status: item.status
      }));

    return { materials, unassignedLessons };
  },

  deleteMaterial: async (packageId: string, assetId: string) => {
    await prisma.$transaction(async tx => {
      const asset = await tx.asset.findFirst({
        where: { id: assetId, packageId, deletedAt: null }
      });
      if (!asset) {
        const error = new Error("素材不存在或已被删除");
        (error as any).status = 404;
        throw error;
      }
      await tx.asset.update({
        where: { id: assetId },
        data: { deletedAt: new Date() }
      });

      await tx.lesson.updateMany({
        where: { packageId, sourceAssetId: assetId },
        data: {
          sourceAssetId: null,
          sourceAssetName: null,
          sourceAssetOrder: null
        }
      });
    });

    return { success: true };
  },

  getMaterialPreviewUrl: async (packageId: string, assetId: string) => {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, packageId, deletedAt: null }
    });
    if (!asset) {
      const error = new Error("素材不存在或已被删除");
      (error as any).status = 404;
      throw error;
    }

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const result = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(asset.storagePath, 60 * 10);

    if (result.error || !result.data?.signedUrl) {
      throw new Error(`素材签名链接生成失败：${result.error?.message || "未知错误"}`);
    }

    return { url: result.data.signedUrl };
  }
};
