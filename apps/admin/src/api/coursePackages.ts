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
  status: CourseStatus;
  unitNumber?: number | null;
  unitName?: string | null;
  unitId?: string | null;
  roundIndex?: number | null;
  roundOrder?: number | null;
  pageNumber?: number | null;
  currentVersion: {
    id: string;
    title: string;
    summary: string | null;
    difficulty: number | null;
    items?: Array<{
      id: string;
      type: string;
      title: string;
      payload: Record<string, unknown> | null;
    }>;
  } | null;
}

export interface MaterialLessonSummary {
  id: string;
  title: string;
  sequence: number;
  unitNumber: number | null;
  unitName: string | null;
  unitId?: string | null;
  status: CourseStatus;
  sourceAssetOrder?: number | null;
  roundIndex?: number | null;
  roundOrder?: number | null;
  pageNumber?: number | null;
  itemType?: string;
  contentEn?: string | null;
  contentCn?: string | null;
}

export interface PackageMaterialSummary {
  id: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  sourceType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  lessonCount: number;
  lessons: MaterialLessonSummary[];
}

export interface PackageMaterialTreeResponse {
  materials: PackageMaterialSummary[];
  unassignedLessons: MaterialLessonSummary[];
}

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
}

export const createCoursePackage = (payload: CreateCoursePackagePayload) =>
  apiFetch<{ package: CoursePackageDetail }>(`/admin/course-packages`, {
    method: "POST",
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
  file: File,
  options?: { triggeredById?: string }
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.triggeredById) {
    formData.append("triggeredById", options.triggeredById);
  }

  return apiFetch<{ job: GenerationJob; asset: PackageAssetSummary }>(
    `/admin/course-packages/${packageId}/generate`,
    {
      method: "POST",
      body: formData
    }
  );
};

export interface JsonImportResult {
  versionId: string;
  versionNumber: number;
  totalLessons: number;
  units: Array<{
    unitId: string;
    unitTitle: string;
    createdLessons: number;
  }>;
}

export interface CsvImportResponse {
  success: boolean;
  message: string;
  result?: JsonImportResult | null;
}

export const uploadCoursePackageCsv = (packageId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<CsvImportResponse>(
    `/admin/course-packages/${packageId}/import-csv`,
    {
      method: "POST",
      body: formData
    }
  );
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

export interface UpdateCoursePackagePayload {
  title?: string;
  topic?: string;
  description?: string | null;
  grade?: string | null;
  publisher?: string | null;
  semester?: string | null;
}

export const updateCoursePackage = (id: string, payload: UpdateCoursePackagePayload) =>
  apiFetch<{ package: CoursePackageDetail }>(`/admin/course-packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const uploadCoursePackageCover = (packageId: string, file: File) => {
  const formData = new FormData();
  formData.append("cover", file);
  return apiFetch<{ coverUrl: string }>(`/admin/course-packages/${packageId}/cover`, {
    method: "POST",
    body: formData
  });
};

export const fetchPackageMaterials = (packageId: string) =>
  apiFetch<PackageMaterialTreeResponse>(`/admin/course-packages/${packageId}/materials`);

export const regeneratePackageMaterial = (packageId: string, assetId: string, payload?: { unitId?: string }) =>
  apiFetch<{ job: GenerationJob }>(
    `/admin/course-packages/${packageId}/materials/${assetId}/regenerate`,
    {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }
  );

export const regenerateUnit = (unitId: string) =>
  apiFetch<{ job: GenerationJob }>(`/admin/units/${unitId}/regenerate`, {
    method: "POST"
  });

export const deletePackageMaterial = (packageId: string, assetId: string) =>
  apiFetch<{ success: boolean }>(`/admin/course-packages/${packageId}/materials/${assetId}`, {
    method: "DELETE"
  });

export const getMaterialPreviewUrl = (packageId: string, assetId: string) =>
  apiFetch<{ url: string }>(`/admin/course-packages/${packageId}/materials/${assetId}/preview`);

export interface UpdateMaterialMetadataPayload {
  label?: string;
  lessonTargetCount?: number | null;
}

export const updateMaterialMetadata = (
  packageId: string,
  assetId: string,
  payload: UpdateMaterialMetadataPayload
) =>
  apiFetch<{ success: boolean }>(`/admin/course-packages/${packageId}/materials/${assetId}/label`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export interface LessonContentPayload {
  title: string;
  en: string;
  cn?: string | null;
  type?: string;
  pageNumber?: number | null;
}

export const updateLessonContent = (lessonId: string, payload: LessonContentPayload) =>
  apiFetch<{ success: boolean }>(`/admin/lessons/${lessonId}/content`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const deleteLessonById = (lessonId: string) =>
  apiFetch<{ success: boolean }>(`/admin/lessons/${lessonId}`, {
    method: "DELETE"
  });

export const createManualLesson = (
  packageId: string,
  assetId: string | null,
  payload: LessonContentPayload
) =>
  apiFetch<{ lessonId: string }>(`/admin/course-packages/${packageId}/materials/${assetId ?? "none"}/lessons`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

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

export const fetchUnits = (packageId: string) =>
  apiFetch<{ units: UnitSummary[] }>(`/admin/course-packages/${packageId}/units`);

export const fetchUnitDetail = (unitId: string) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/units/${unitId}`);

export const createUnit = (packageId: string, payload: CreateUnitPayload) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/course-packages/${packageId}/units`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateUnit = (unitId: string, payload: UpdateUnitPayload) =>
  apiFetch<{ unit: UnitSummary }>(`/admin/units/${unitId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const publishUnit = (unitId: string) =>
  apiFetch<{ success: boolean; unitId: string; lessonCount: number }>(
    `/admin/units/${unitId}/publish`,
    { method: "POST" }
  );

export const unpublishUnit = (unitId: string) =>
  apiFetch<{ success: boolean; unitId: string; lessonCount: number }>(
    `/admin/units/${unitId}/unpublish`,
    { method: "POST" }
  );

export const deleteUnit = (unitId: string) =>
  apiFetch<{ success: boolean; message: string }>(
    `/admin/units/${unitId}`,
    { method: "DELETE" }
  );

export interface UploadUnitMaterialOptions {
  splitPdf?: boolean;
  splitPageCount?: number;
  pageNumberStart?: number;
}

export const uploadUnitMaterial = (unitId: string, files: File[], options?: UploadUnitMaterialOptions) => {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append("files", f);
  });
  if (options?.splitPdf) {
    formData.append("splitPdf", "true");
    if (options.splitPageCount) {
      formData.append("splitPageCount", String(options.splitPageCount));
    }
  }
  if (typeof options?.pageNumberStart === "number") {
    formData.append("pageNumberStart", String(options.pageNumberStart));
  }
  return apiFetch<{ success: boolean; job: GenerationJob; assets: PackageAssetSummary[]; message: string }>(
    `/admin/units/${unitId}/generate`,
    {
      method: "POST",
      body: formData
    }
  );
};

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

export const importTextbookPdf = (packageId: string, file: File, pageNumberStart?: number) => {
  const formData = new FormData();
  formData.append("file", file);
  if (typeof pageNumberStart === "number") {
    formData.append("pageNumberStart", String(pageNumberStart));
  }
  return apiFetch<{ success: boolean; job: GenerationJob }>(
    `/admin/course-packages/${packageId}/textbook-import`,
    {
      method: "POST",
      body: formData
    }
  );
};

export const fetchGenerationJob = (jobId: string) =>
  apiFetch<{ job: GenerationJob }>(`/jobs/${jobId}`);
