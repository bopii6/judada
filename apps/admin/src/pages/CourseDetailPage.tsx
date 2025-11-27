import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FormEventHandler
} from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CoursePackageDetail,
  fetchCoursePackageDetail,
  uploadCoursePackageMaterial,
  publishCoursePackage,
  uploadCoursePackageCover,
  updateCoursePackage,
  type UpdateCoursePackagePayload
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
const MAX_COVER_SIZE = 5 * 1024 * 1024;

export const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [editState, setEditState] = useState({
    title: "",
    topic: "",
    description: ""
  });

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
    mutationFn: async (files: File[]) => {
      if (!id) {
        throw new Error("当前页面缺少课程包标识，请刷新后重试。");
      }
      // 支持单文件或多文件上传
      return uploadCoursePackageMaterial(id, files.length === 1 ? files[0] : files);
    },
    onMutate: () => {
      setUploadError(null);
      setUploadSuccess(null);
    },
    onSuccess: ({ job, assets }) => {
      const fileNames = assets?.map(a => a.originalName).join("、") || "文件";
      setUploadSuccess(`已创建生成任务（${job.id}），正在分析 ${assets?.length || 1} 个文件：${fileNames}。`);
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

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error("当前页面缺少课程包标识，请刷新后重试。");
      }
      return publishCoursePackage(id);
    },
    onMutate: () => {
      setPublishError(null);
      setPublishSuccess(null);
    },
    onSuccess: ({ result }) => {
      setPublishSuccess(`发布成功，版本包含 ${result.lessonCount} 个关卡。`);
      void refetchDetail();
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: failure => {
      setPublishError((failure as Error).message);
    }
  });

  const coverMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) {
        throw new Error("当前页面缺少课程包标识，请刷新后重试。");
      }
      return uploadCoursePackageCover(id, file);
    },
    onMutate: () => {
      setCoverError(null);
      setCoverSuccess(null);
    },
    onSuccess: () => {
      setCoverSuccess("封面更新成功");
      void refetchDetail();
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
    },
    onError: failure => {
      setCoverError((failure as Error).message);
    },
    onSettled: () => {
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateCoursePackagePayload) => {
      if (!id) {
        throw new Error("当前页面缺少课程包标识，请刷新后重试");
      }
      return updateCoursePackage(id, payload);
    },
    onMutate: () => {
      setUpdateError(null);
      setUpdateSuccess(null);
    },
    onSuccess: ({ package: updated }) => {
      setUpdateSuccess("基础信息更新成功");
      setEditState({
        title: updated.title,
        topic: updated.topic,
        description: updated.description ?? ""
      });
      void refetchDetail();
      if (id) {
        queryClient.setQueryData<{ package: CoursePackageDetail }>(["course-packages", id], { package: updated });
      }
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
    },
    onError: failure => {
      setUpdateError((failure as Error).message);
    }
  });

  const detail = useMemo<CoursePackageDetail | null>(() => data?.package ?? null, [data]);

  useEffect(() => {
    if (detail) {
      setEditState({
        title: detail.title,
        topic: detail.topic,
        description: detail.description ?? ""
      });
    }
  }, [detail]);

  const normalizedDetailDescription = (detail?.description ?? "").trim();
  const normalizedEditDescription = editState.description.trim();
  const isBasicInfoDirty = Boolean(
    detail &&
      (detail.title !== editState.title.trim() ||
        detail.topic !== editState.topic.trim() ||
        normalizedDetailDescription !== normalizedEditDescription)
  );

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
    setPublishError(null);
    setPublishSuccess(null);
    fileInputRef.current?.click();
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = event => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // 检查文件数量限制（最多10张）
    if (files.length > 10) {
      setUploadError("最多只能上传10张图片，请重新选择。");
      event.target.value = "";
      return;
    }

    // 检查每个文件大小
    const oversizedFiles = files.filter(f => f.size > MAX_UPLOAD_SIZE);
    if (oversizedFiles.length > 0) {
      setUploadError(`文件大小不能超过 15MB，请重新选择。超出限制的文件：${oversizedFiles.map(f => f.name).join("、")}`);
      event.target.value = "";
      return;
    }

    uploadMutation.mutate(files);
  };

  const handleCoverButtonClick = () => {
    setCoverError(null);
    setCoverSuccess(null);
    coverInputRef.current?.click();
  };

  const handleCoverFileChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_COVER_SIZE) {
      setCoverError("封面图片大小不能超过 5MB");
      event.target.value = "";
      return;
    }

    coverMutation.mutate(file);
  };

  const handleBasicInfoChange =
    (key: "title" | "topic" | "description") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setEditState(prev => ({
        ...prev,
        [key]: value
      }));
    };

  const handleBasicInfoReset = () => {
    if (detail) {
      setEditState({
        title: detail.title,
        topic: detail.topic,
        description: detail.description ?? ""
      });
    }
    setUpdateError(null);
    setUpdateSuccess(null);
  };

  const handleBasicInfoSubmit: FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    if (!id) {
      setUpdateError("当前页面缺少课程包标识，请刷新后重试�?);
      setUpdateSuccess(null);
      return;
    }

    const title = editState.title.trim();
    const topic = editState.topic.trim();
    const description = editState.description.trim();

    if (!title || !topic) {
      setUpdateError("请填写课程包名称和主题");
      setUpdateSuccess(null);
      return;
    }

    const payload: UpdateCoursePackagePayload = {
      title,
      topic,
      description: description.length > 0 ? description : null
    };
    updateMutation.mutate(payload);
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
            {uploadMutation.isPending ? "正在上传..." : "上传素材并重新生成（最多10张图片）"}
          </button>
          <button
            type="button"
            className="primary"
            disabled={detail.status !== "draft" || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            {publishMutation.isPending ? "正在发布..." : "发布当前草稿"}
          </button>
        </div>
      </header>

      <form className="course-basic-editor" onSubmit={handleBasicInfoSubmit}>
        <div className="course-basic-editor-header">
          <div>
            <h2>基础信息</h2>
            <p>可以随时修改课程包的对外展示名称、主题和简介，方便快速纠错或补充上下文。</p>
          </div>
          <div className="course-basic-editor-actions">
            <button
              type="button"
              onClick={handleBasicInfoReset}
              disabled={!isBasicInfoDirty || updateMutation.isPending}
            >
              重置
            </button>
            <button
              type="submit"
              className="primary"
              disabled={!isBasicInfoDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
        <div className="course-basic-editor-grid">
          <label>
            <span>课程包名称</span>
            <input
              type="text"
              value={editState.title}
              maxLength={60}
              onChange={handleBasicInfoChange("title")}
              placeholder="例如：5年级英语上册"
            />
          </label>
          <label>
            <span>课程主题</span>
            <input
              type="text"
              value={editState.topic}
              maxLength={30}
              onChange={handleBasicInfoChange("topic")}
              placeholder="例如：词汇练习 / 语法闯关"
            />
          </label>
          <label className="course-basic-editor-full">
            <span>课程简介</span>
            <textarea
              value={editState.description}
              maxLength={400}
              onChange={handleBasicInfoChange("description")}
              placeholder="可选：补充一句介绍，帮助同事快速识别。"
            />
          </label>
        </div>
      </form>

      <section className="course-cover-panel">
        <div className="course-cover-preview">
          {detail.coverUrl ? (
            <img src={detail.coverUrl} alt={`${detail.title} 封面`} loading="lazy" />
          ) : (
            <div className="course-cover-placeholder">暂无封面</div>
          )}
        </div>
        <div className="course-cover-content">
          <h3>课程封面</h3>
          <p className="course-cover-description">
            学员端会在课程列表与详情页展示封面图，建议使用 4:3 比例且主题清晰的图片，大小控制在 5MB 以内。
          </p>
          <div className="course-cover-actions">
            <button type="button" onClick={handleCoverButtonClick} disabled={coverMutation.isPending}>
              {coverMutation.isPending ? "正在上传..." : detail.coverUrl ? "重新上传封面" : "上传封面"}
            </button>
            {detail.coverUrl && <span className="course-cover-meta">已设置封面</span>}
          </div>
          <p className="course-cover-hint">支持 JPG、PNG、WebP 格式 · 会自动裁剪并在学员端缓存</p>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleCoverFileChange}
      />
      {(uploadError ||
        uploadSuccess ||
        publishError ||
        publishSuccess ||
        coverError ||
        coverSuccess ||
        updateError ||
        updateSuccess) && (
        <div className="course-detail-upload-feedback-stack">
          {(uploadError || uploadSuccess) && (
            <p className={`course-detail-upload-feedback ${uploadError ? "error" : "success"}`}>
              {uploadError ?? uploadSuccess}
            </p>
          )}
          {(publishError || publishSuccess) && (
            <p className={`course-detail-upload-feedback ${publishError ? "error" : "success"}`}>
              {publishError ?? publishSuccess}
            </p>
          )}
          {(coverError || coverSuccess) && (
            <p className={`course-detail-upload-feedback ${coverError ? "error" : "success"}`}>
              {coverError ?? coverSuccess}
            </p>
          )}
          {(updateError || updateSuccess) && (
            <p className={`course-detail-upload-feedback ${updateError ? "error" : "success"}`}>
              {updateError ?? updateSuccess}
            </p>
          )}
        </div>
      )}

      <section className="course-detail-meta">
        <div>
          <span className="meta-label">课程主题</span>
          <span className="meta-value">{detail.topic}</span>
        </div>
        <div>
          <span className="meta-label">关卡数量</span>
          <span className="meta-value">{latestVersion?.lessons.length ?? detail.lessons.length}</span>
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
