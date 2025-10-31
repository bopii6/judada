import { useMemo, useRef, useState, type ChangeEventHandler } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CoursePackageDetail,
  fetchCoursePackageDetail,
  uploadCoursePackageMaterial
} from "../api/coursePackages";
import "./CourseDetailPage.css";

const statusTextMap: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  archived: "已归档"
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

export const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
    refetch: refetchDetail
  } = useQuery({
    queryKey: ["course-packages", id],
    queryFn: () => fetchCoursePackageDetail(id!),
    enabled: Boolean(id)
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) {
        throw new Error("当前页面缺少课程包标识，请刷新后重试。");
      }
      return uploadCoursePackageMaterial(id, file);
    },
    onMutate: () => {
      setUploadError(null);
      setUploadSuccess(null);
    },
    onSuccess: ({ job, asset }) => {
      setUploadSuccess(`已创建生成任务（${job.id}），正在分析 “${asset.originalName}”。`);
      void refetchDetail();
      void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
    },
    onError: failure => {
      setUploadError((failure as Error).message);
    },
    onSettled: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  });

  const detail = useMemo<CoursePackageDetail | null>(() => data?.package ?? null, [data]);

  if (!id) {
    return <div className="course-detail">未提供课程包 ID。</div>;
  }

  if (isLoading) {
    return <div className="course-detail">正在加载课程包详情...</div>;
  }

  if (error) {
    return <div className="course-detail error">加载失败：{(error as Error).message}</div>;
  }

  if (!detail) {
    return <div className="course-detail">没有找到这个课程包，可能已被删除。</div>;
  }

  const latestVersion = detail.currentVersion;

  const handleUploadButtonClick = () => {
    setUploadError(null);
    setUploadSuccess(null);
    fileInputRef.current?.click();
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadError("文件大小不能超过 15MB，请重新选择。");
      event.target.value = "";
      return;
    }

    uploadMutation.mutate(file);
  };

  return (
    <div className="course-detail">
      <header className="course-detail-header">
        <div>
          <h1>{detail.title}</h1>
          <p>{detail.description || "暂时没有填写描述。"}</p>
          <p className="course-detail-meta-info">
            创建于 {formatDateTime(detail.createdAt)} · 最近更新 {formatDateTime(detail.updatedAt)}
          </p>
        </div>
        <div className="course-detail-actions">
          <button type="button" onClick={handleUploadButtonClick} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "正在上传..." : "上传素材并重新生成"}
          </button>
          <button type="button" className="primary" disabled={detail.status !== "draft"}>
            发布当前草稿
          </button>
        </div>
      </header>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        hidden
        onChange={handleFileChange}
      />
      {(uploadError || uploadSuccess) && (
        <p className={`course-detail-upload-feedback ${uploadError ? "error" : "success"}`}>
          {uploadError ?? uploadSuccess}
        </p>
      )}

      <section className="course-detail-meta">
        <div>
          <span className="meta-label">课程主题</span>
          <span className="meta-value">{detail.topic}</span>
        </div>
        <div>
          <span className="meta-label">关卡数量</span>
          <span className="meta-value">{detail.lessons.length}</span>
        </div>
        <div>
          <span className="meta-label">当前状态</span>
          <span className="meta-value highlight">{statusTextMap[detail.status] ?? detail.status}</span>
        </div>
      </section>

      <section className="course-detail-versions">
        <h2>版本记录</h2>
        <div className="version-list">
          {detail.versions.map(version => (
            <div key={version.id} className="version-card">
              <div>
                <strong>{version.label || `版本 #${version.versionNumber}`}</strong>
                <span className={`version-status status-${version.status}`}>
                  {statusTextMap[version.status] ?? version.status}
                </span>
              </div>
              <div className="version-meta">
                <span>创建时间：{formatDateTime(version.createdAt)}</span>
                <span>包含关卡：{version._count.lessons}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="course-detail-lessons">
        <h2>关卡列表</h2>
        {latestVersion && latestVersion.lessons.length === 0 && (
          <p className="course-detail-empty">当前草稿还没有关卡，可以先上传素材或手动新建。</p>
        )}
        <div className="lesson-grid">
          {(latestVersion?.lessons ?? detail.lessons).map(lesson => {
            const statusLabel = statusTextMap[lesson.status] ?? lesson.status;
            return (
              <div key={lesson.id} className="lesson-card">
                <div className="lesson-header">
                  <h3>
                    #{lesson.sequence} {lesson.title}
                  </h3>
                  <span className={`lesson-status status-${lesson.status}`}>{statusLabel}</span>
                </div>
                <p className="lesson-summary">{lesson.currentVersion?.summary || "暂未填写关卡简介。"}</p>
                <div className="lesson-actions">
                  <button type="button" disabled>
                    编辑
                  </button>
                  <button type="button" className="text" disabled>
                    预览互动体验
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
