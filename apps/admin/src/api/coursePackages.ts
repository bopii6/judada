import { apiFetch } from "./http";

export type CourseStatus = "draft" | "pending_review" | "published" | "archived";
export type VersionStatus = "draft" | "pending_review" | "published" | "archived";
export type JobStatus = "queued" | "processing" | "succeeded" | "failed" | "canceled";

export interface OverviewStats {
  packagesTotal: number;
  lessonsTotal: number;
  pendingReviews: number;
  activeJobs: number;
}

export interface CoursePackageListItem {
  id: string;
  title: string;
  topic: string;
  status: CourseStatus;
  coverUrl: string | null;
  grade: string | null;      // 年级
  publisher: string | null;  // 出版社
  semester: string | null;   // 学期
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  lessonCount: number;
  currentVersion: {
    id: string;
    status: VersionStatus;
    versionNumber: number;
    createdAt: string;
  } | null;
}

export interface LessonSummary {
  id: string;
  title: string;
  sequence: number;
  unitNumber: number | null;  // 单元序号
  unitName: string | null;    // 单元名称
  status: CourseStatus;
  currentVersion: {
    id: string;
    title: string;
    summary: string | null;
    difficulty: number | null;
  } | null;
}

export interface CoursePackageVersionSummary {
  id: string;
  label: string | null;
  status: VersionStatus;
  versionNumber: number;
  createdAt: string;
  _count: {
    lessons: number;
  };
}

export interface CoursePackageDetail {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  status: CourseStatus;
  coverUrl: string | null;
  grade: string | null;      // 年级
  publisher: string | null;  // 出版社
  semester: string | null;   // 学期
  createdAt: string;
  updatedAt: string;
  currentVersion: {
    id: string;
    label: string | null;
    status: VersionStatus;
    versionNumber: number;
    createdAt: string;
    lessons: Array<{
      id: string;
      title: string;
      sequence: number;
      unitNumber: number | null;  // 单元序号
      unitName: string | null;    // 单元名称
      currentVersion: {
        id: string;
        title: string;
        summary: string | null;
        difficulty: number | null;
        items: Array<{
          id: string;
          type: string;
          orderIndex: number;
          payload: unknown;
        }>;
      } | null;
    }>;
  } | null;
  versions: CoursePackageVersionSummary[];
  lessons: LessonSummary[];
}

export interface GenerationJob {
  id: string;
  jobType: string;
  status: JobStatus;
  progress: number | null;
  sourceType: string | null;
  inputInfo: unknown;
  result: unknown;
  errorMessage: string | null;
  packageId: string | null;
  packageVersionId: string | null;
  triggeredById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  package: {
    id: string;
    title: string;
  } | null;
  packageVersion: {
    id: string;
    versionNumber: number;
    status: VersionStatus;
  } | null;
}

export const fetchOverview = () => apiFetch<{ stats: OverviewStats }>("/admin/overview");

export const fetchCoursePackages = () => apiFetch<{ items: CoursePackageListItem[] }>("/admin/course-packages");

export const fetchCoursePackageDetail = (id: string) =>
  apiFetch<{ package: CoursePackageDetail }>(`/admin/course-packages/${id}`);

export const fetchGenerationJobs = () => apiFetch<{ jobs: GenerationJob[] }>("/jobs");

export interface CreateCoursePackagePayload {
  title: string;
  topic: string;
  description?: string;
  coverUrl?: string;
  label?: string;
  notes?: string;
  grade?: string;      // 年级
  publisher?: string;  // 出版社
  semester?: string;   // 学期
}

export const createCoursePackage = (payload: CreateCoursePackagePayload) =>
  apiFetch<{ package: CoursePackageDetail }>(`/admin/course-packages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export interface UpdateCoursePackagePayload {
  title?: string;
  topic?: string;
  description?: string | null;
  grade?: string | null;      // 年级
  publisher?: string | null;  // 出版社
  semester?: string | null;   // 学期
}

export const updateCoursePackage = (id: string, payload: UpdateCoursePackagePayload) =>
  apiFetch<{ package: CoursePackageDetail }>(`/admin/course-packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export interface PackageAssetSummary {
  id: string;
  packageId: string | null;
  packageVersionId: string | null;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export const uploadCoursePackageMaterial = (
  packageId: string,
  file: File | File[],
  options?: { triggeredById?: string }
) => {
  const formData = new FormData();
  
  // 支持单文件或多文件上传
  const files = Array.isArray(file) ? file : [file];
  files.forEach((f) => {
    formData.append("files", f);
  });
  
  if (options?.triggeredById) {
    formData.append("triggeredById", options.triggeredById);
  }

  return apiFetch<{ job: GenerationJob; assets: PackageAssetSummary[] }>(
    `/admin/course-packages/${packageId}/generate`,
    {
      method: "POST",
      body: formData
    }
  );
};

export const uploadCoursePackageCover = (packageId: string, file: File) => {
  const formData = new FormData();
  formData.append("cover", file);
  return apiFetch<{ coverUrl: string }>(`/admin/course-packages/${packageId}/cover`, {
    method: "POST",
    body: formData
  });
};

export const publishCoursePackage = (packageId: string) =>
  apiFetch<{ success: boolean; result: { packageId: string; versionId: string; lessonCount: number } }>(
    `/admin/course-packages/${packageId}/publish`,
    {
      method: "POST"
    }
  );

export const deleteCoursePackage = (packageId: string) =>
  apiFetch<{ success: boolean; message: string }>(
    `/admin/course-packages/${packageId}`,
    {
      method: "DELETE"
    }
  );

export const deleteCoursePackages = (packageIds: string[]) =>
  apiFetch<{
    success: boolean;
    message: string;
    failedPackages: Array<{ id: string; title: string; error: string }>
  }>(
    `/admin/course-packages`,
    {
      method: "DELETE",
      body: JSON.stringify({ packageIds })
    }
  );

// 更新关卡单元信息
export interface UpdateLessonPayload {
  unitNumber?: number | null;
  unitName?: string | null;
}

export const updateLesson = (packageId: string, lessonId: string, payload: UpdateLessonPayload) =>
  apiFetch<{ lesson: LessonSummary }>(
    `/admin/course-packages/${packageId}/lessons/${lessonId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );

// 批量更新关卡单元信息
export interface BatchUpdateLessonsPayload {
  lessonIds: string[];
  unitNumber?: number | null;
  unitName?: string | null;
}

export const batchUpdateLessons = (packageId: string, payload: BatchUpdateLessonsPayload) =>
  apiFetch<{ success: boolean; updatedCount: number }>(
    `/admin/course-packages/${packageId}/lessons`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );

// ==================== 单元管理 API ====================

export interface UnitSummary {
  id: string;
  packageId: string;
  sequence: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  lessons: LessonSummary[];
  _count: {
    lessons: number;
  };
}

export interface CreateUnitPayload {
  title: string;
  description?: string;
  sequence?: number;
}

export interface UpdateUnitPayload {
  title?: string;
  description?: string | null;
  coverUrl?: string | null;
  status?: CourseStatus;
}

// 获取课程包下的所有单元
export const fetchUnits = (packageId: string) =>
  apiFetch<{ units: UnitSummary[] }>(`/admin/course-packages/${packageId}/units`);

// 获取单个单元详情
export const fetchUnitDetail = (unitId: string) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/units/${unitId}`);

// 创建新单元
export const createUnit = (packageId: string, payload: CreateUnitPayload) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/course-packages/${packageId}/units`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

// 更新单元信息
export const updateUnit = (unitId: string, payload: UpdateUnitPayload) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/units/${unitId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

// 发布单元
export const publishUnit = (unitId: string) =>
  apiFetch<{ success: boolean; unitId: string; lessonCount: number }>(
    `/admin/units/${unitId}/publish`,
    { method: "POST" }
  );

// 下架单元
export const unpublishUnit = (unitId: string) =>
  apiFetch<{ success: boolean; unitId: string; lessonCount: number }>(
    `/admin/units/${unitId}/unpublish`,
    { method: "POST" }
  );

// 删除单元
export const deleteUnit = (unitId: string) =>
  apiFetch<{ success: boolean; message: string }>(
    `/admin/units/${unitId}`,
    { method: "DELETE" }
  );

// 为单元上传素材并生成关卡
export const uploadUnitMaterial = (unitId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append("files", f);
  });
  return apiFetch<{ success: boolean; job: GenerationJob; assets: PackageAssetSummary[]; message: string }>(
    `/admin/units/${unitId}/generate`,
    {
      method: "POST",
      body: formData
    }
  );
};

// 上传单元封面
export const uploadUnitCover = (unitId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ unit: UnitSummary; coverUrl: string }>(
    `/admin/units/${unitId}/cover`,
    {
      method: "POST",
      body: formData
    }
  );
};
