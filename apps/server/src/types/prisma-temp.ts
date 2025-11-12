// 临时类型定义文件 - 解决 Prisma 客户端生成问题
export enum SourceType {
  pdf_upload = 'pdf_upload',
  image_ocr = 'image_ocr',
  manual_input = 'manual_input',
  ai_generated = 'ai_generated',
  mixed = 'mixed'
}

export enum VersionStatus {
  draft = 'draft',
  pending_review = 'pending_review',
  published = 'published',
  archived = 'archived'
}

export enum CourseStatus {
  draft = 'draft',
  pending_review = 'pending_review',
  published = 'published',
  archived = 'archived'
}

export enum LessonItemType {
  vocabulary = 'vocabulary',
  phrase = 'phrase',
  sentence = 'sentence',
  dialogue = 'dialogue',
  quiz_single_choice = 'quiz_single_choice',
  quiz_multiple_choice = 'quiz_multiple_choice',
  fill_blank = 'fill_blank',
  reorder = 'reorder',
  listening = 'listening',
  speaking = 'speaking',
  writing = 'writing',
  custom = 'custom'
}

export enum JobType {
  package_generation = 'package_generation',
  lesson_generation = 'lesson_generation',
  asset_processing = 'asset_processing',
  content_review = 'content_review'
}

export enum JobStatus {
  queued = 'queued',
  processing = 'processing',
  succeeded = 'succeeded',
  failed = 'failed',
  canceled = 'canceled'
}

export enum JobLogLevel {
  info = 'info',
  warning = 'warning',
  error = 'error'
}

// Prisma 类型别名
export type InputJsonValue = any;
export type JsonObject = Record<string, any>;
export type JsonArray = any[];

// 通用 Payload 类型
export interface CoursePackageVersionGetPayload<T extends { include?: any; select?: any }> {
  id: string;
  packageId: string;
  versionNumber: number;
  label?: string | null;
  status: VersionStatus;
  sourceType: SourceType;
  notes?: string | null;
  payload?: InputJsonValue | null;
  previousVersionId?: string | null;
  createdById?: string | null;
  reviewedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;
  reviewDecidedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface LessonGetPayload<T extends { include?: any; select?: any }> {
  id: string;
  packageId: string;
  packageVersionId?: string | null;
  title: string;
  sequence: number;
  status: CourseStatus;
  currentVersionId?: string | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CoursePackageGetPayload<T extends { include?: any; select?: any; _count?: any }> {
  id: string;
  title: string;
  topic: string;
  description?: string | null;
  coverUrl?: string | null;
  status: CourseStatus;
  createdById?: string | null;
  currentVersionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  // 用于 include 查询的动态属性
  currentVersion?: T extends { include: { currentVersion: infer U } }
    ? U extends { select: infer S }
      ? S extends { id: true; status: true; versionNumber: true; createdAt: true }
        ? { id: string; status: VersionStatus; versionNumber: number; createdAt: Date }
        : any
      : any
    : undefined;

  _count?: T extends { _count: { select: infer C } }
    ? { [K in keyof C]: number }
    : undefined;
}

export interface CoursePackageUpdateInput {
  title?: string;
  topic?: string;
  description?: string | null;
  coverUrl?: string | null;
  status?: CourseStatus;
  currentVersionId?: string | null;
}