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
