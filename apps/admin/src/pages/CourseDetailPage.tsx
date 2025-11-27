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
  UnitSummary,
  LessonSummary,
  fetchCoursePackageDetail,
  uploadCoursePackageCover,
  updateCoursePackage,
  fetchUnits,
  createUnit,
  updateUnit,
  publishUnit,
  unpublishUnit,
  deleteUnit,
  uploadUnitMaterial,
  uploadUnitCover,
  publishCoursePackage,
  type UpdateCoursePackagePayload,
  type CreateUnitPayload,
  type UpdateUnitPayload
} from "../api/coursePackages";
import "./CourseDetailPage.css";

const statusTextMap: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  archived: "已归档"
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

export const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [editState, setEditState] = useState({
    title: "",
    topic: "",
    description: ""
  });

  // 新增单元弹窗
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [newUnitDescription, setNewUnitDescription] = useState("");

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

  // 获取单元列表
  const {
    data: unitsData,
    refetch: refetchUnits
  } = useQuery({
    queryKey: ["course-packages", id, "units"],
    queryFn: () => fetchUnits(id!),
    enabled: Boolean(id)
  });

  const units = useMemo(() => unitsData?.units ?? [], [unitsData]);

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

  const createUnitMutation = useMutation({
    mutationFn: async (payload: CreateUnitPayload) => {
      if (!id) throw new Error("课程包ID缺失");
      return createUnit(id, payload);
    },
    onSuccess: () => {
      setShowCreateUnit(false);
      setNewUnitTitle("");
      setNewUnitDescription("");
      void refetchUnits();
    }
  });

  const publishPackageMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("课程包ID缺失");
      return publishCoursePackage(id);
    },
    onSuccess: () => {
      void refetchDetail();
      void refetchUnits();
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
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
      setUpdateError("当前页面缺少课程包标识，请刷新后重试。");
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

  const handleCreateUnit = () => {
    if (!newUnitTitle.trim()) {
      alert("请填写单元标题");
      return;
    }
    createUnitMutation.mutate({
      title: newUnitTitle.trim(),
      description: newUnitDescription.trim() || undefined
    });
  };

  const totalLessons = units.reduce((sum, u) => sum + (u._count?.lessons ?? 0), 0);
  const publishedUnits = units.filter(u => u.status === "published").length;

  return (
    <div className="course-detail">
      {/* 课程包头部信息 */}
      <header className="course-detail-header">
        <div className="course-header-left">
          <div className="course-cover-small" onClick={handleCoverButtonClick}>
            {detail.coverUrl ? (
              <img src={detail.coverUrl} alt={detail.title} />
            ) : (
              <div className="cover-placeholder">点击上传封面</div>
            )}
          </div>
          <div className="course-header-info">
            <h1>{detail.title}</h1>
            <p className="course-meta-tags">
              {detail.grade && <span className="meta-tag grade">{detail.grade}</span>}
              {detail.publisher && <span className="meta-tag publisher">{detail.publisher}</span>}
              {detail.semester && <span className="meta-tag semester">{detail.semester}</span>}
              <span className={`meta-tag status-${detail.status}`}>{statusTextMap[detail.status]}</span>
            </p>
            <p className="course-description">{detail.description || "暂无描述"}</p>
            <p className="course-detail-meta-info">
              共 {units.length} 个单元 · {totalLessons} 个关卡 · {publishedUnits} 个已发布
            </p>
          </div>
        </div>
        <div className="course-detail-actions">
          <button
            type="button"
            className="primary"
            disabled={detail.status === "published" || publishPackageMutation.isPending}
            onClick={() => publishPackageMutation.mutate()}
          >
            {publishPackageMutation.isPending ? "发布中..." : "发布整个课程包"}
          </button>
        </div>
      </header>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleCoverFileChange}
      />

      {(coverError || coverSuccess || updateError || updateSuccess) && (
        <div className="course-detail-upload-feedback-stack">
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

      {/* 基础信息编辑 */}
      <form className="course-basic-editor" onSubmit={handleBasicInfoSubmit}>
        <div className="course-basic-editor-header">
          <div>
            <h2>基础信息</h2>
            <p>修改课程包的名称、主题和简介</p>
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
              placeholder="例如：跟着教材练英语"
            />
          </label>
          <label className="course-basic-editor-full">
            <span>课程简介</span>
            <textarea
              value={editState.description}
              maxLength={400}
              onChange={handleBasicInfoChange("description")}
              placeholder="可选：补充一句介绍"
            />
          </label>
        </div>
      </form>

      {/* 单元管理区域 */}
      <section className="units-section">
        <div className="units-section-header">
          <h2>单元管理</h2>
          <button
            type="button"
            className="add-unit-btn"
            onClick={() => setShowCreateUnit(true)}
          >
            + 新增单元
          </button>
        </div>

        {units.length === 0 ? (
          <div className="units-empty">
            <p>还没有创建单元</p>
            <p className="hint">点击上方「新增单元」按钮创建第一个单元</p>
          </div>
        ) : (
          <div className="units-list">
            {units.map(unit => (
              <UnitCard
                key={unit.id}
                unit={unit}
                packageId={id}
                onUpdate={() => {
                  void refetchUnits();
                  void refetchDetail();
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* 新增单元弹窗 */}
      {showCreateUnit && (
        <div className="modal-overlay" onClick={() => setShowCreateUnit(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新增单元</h3>
            <div className="modal-form">
              <label>
                <span>单元标题 *</span>
                <input
                  type="text"
                  value={newUnitTitle}
                  onChange={e => setNewUnitTitle(e.target.value)}
                  placeholder="例如：Unit 1: Hello"
                  autoFocus
                />
              </label>
              <label>
                <span>单元简介</span>
                <textarea
                  value={newUnitDescription}
                  onChange={e => setNewUnitDescription(e.target.value)}
                  placeholder="可选：描述这个单元的学习内容"
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCreateUnit(false)}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleCreateUnit}
                disabled={createUnitMutation.isPending}
              >
                {createUnitMutation.isPending ? "创建中..." : "创建单元"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 单元卡片组件
interface UnitCardProps {
  unit: UnitSummary;
  packageId: string;
  onUpdate: () => void;
}

const UnitCard = ({ unit, packageId, onUpdate }: UnitCardProps) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(unit.title);
  const [editDescription, setEditDescription] = useState(unit.description ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUnitPayload) => updateUnit(unit.id, payload),
    onSuccess: () => {
      setIsEditing(false);
      onUpdate();
    }
  });

  const publishMutation = useMutation({
    mutationFn: () => publishUnit(unit.id),
    onSuccess: () => {
      onUpdate();
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
    }
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishUnit(unit.id),
    onSuccess: () => {
      onUpdate();
      void queryClient.invalidateQueries({ queryKey: ["course-packages"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUnit(unit.id),
    onSuccess: () => {
      onUpdate();
    }
  });

  const uploadMaterialMutation = useMutation({
    mutationFn: (files: File[]) => uploadUnitMaterial(unit.id, files),
    onSuccess: (result) => {
      setUploadMessage({ type: "success", text: result.message || "素材上传成功，正在生成关卡..." });
      onUpdate();
      void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
    },
    onError: (error) => {
      setUploadMessage({ type: "error", text: (error as Error).message });
    }
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => uploadUnitCover(unit.id, file),
    onSuccess: () => {
      setUploadMessage({ type: "success", text: "封面上传成功" });
      onUpdate();
    },
    onError: (error) => {
      setUploadMessage({ type: "error", text: (error as Error).message });
    }
  });

  const handleUploadClick = () => {
    setUploadMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 10) {
      setUploadMessage({ type: "error", text: "最多只能上传10张图片" });
      return;
    }
    const oversized = files.filter(f => f.size > MAX_UPLOAD_SIZE);
    if (oversized.length > 0) {
      setUploadMessage({ type: "error", text: "文件大小不能超过15MB" });
      return;
    }
    uploadMaterialMutation.mutate(files);
    e.target.value = "";
  };

  const handleCoverClick = () => {
    coverInputRef.current?.click();
  };

  const handleCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_COVER_SIZE) {
      setUploadMessage({ type: "error", text: "封面图片大小不能超过5MB" });
      return;
    }
    uploadCoverMutation.mutate(file);
    e.target.value = "";
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editTitle.trim(),
      description: editDescription.trim() || null
    });
  };

  const handleDelete = () => {
    if (confirm(`确定要删除单元「${unit.title}」吗？该单元下的所有关卡也会被删除。`)) {
      deleteMutation.mutate();
    }
  };

  const lessonCount = unit._count?.lessons ?? unit.lessons?.length ?? 0;
  const isPublished = unit.status === "published";

  return (
    <div className={`unit-card ${isPublished ? "published" : "draft"}`}>
      <div className="unit-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="unit-header-left">
          <span className="unit-expand-icon">{expanded ? "▼" : "▶"}</span>
          {unit.coverUrl && (
            <img src={unit.coverUrl} alt="" className="unit-cover-thumb" />
          )}
          <div className="unit-header-info">
            <h3>
              <span className="unit-sequence">单元 {unit.sequence}</span>
              {unit.title}
            </h3>
            {unit.description && <p className="unit-description">{unit.description}</p>}
          </div>
        </div>
        <div className="unit-header-right">
          <span className="unit-lesson-count">{lessonCount} 个关卡</span>
          <span className={`unit-status status-${unit.status}`}>
            {statusTextMap[unit.status]}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="unit-card-body">
          {/* 操作按钮区 */}
          <div className="unit-actions-bar">
            <button type="button" onClick={handleUploadClick} disabled={uploadMaterialMutation.isPending}>
              {uploadMaterialMutation.isPending ? "上传中..." : "📤 上传素材生成关卡"}
            </button>
            <button type="button" onClick={handleCoverClick} disabled={uploadCoverMutation.isPending}>
              {uploadCoverMutation.isPending ? "上传中..." : "🖼️ 上传封面"}
            </button>
            <button type="button" onClick={() => setIsEditing(true)}>
              ✏️ 编辑单元
            </button>
            {isPublished ? (
              <button
                type="button"
                className="warning"
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
              >
                {unpublishMutation.isPending ? "下架中..." : "⬇️ 下架单元"}
              </button>
            ) : (
              <button
                type="button"
                className="success"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || lessonCount === 0}
              >
                {publishMutation.isPending ? "发布中..." : "🚀 发布单元"}
              </button>
            )}
            <button type="button" className="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
              🗑️ 删除
            </button>
          </div>

          {uploadMessage && (
            <p className={`unit-message ${uploadMessage.type}`}>{uploadMessage.text}</p>
          )}

          {/* 编辑表单 */}
          {isEditing && (
            <div className="unit-edit-form">
              <label>
                <span>单元标题</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </label>
              <label>
                <span>单元简介</span>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={2}
                />
              </label>
              <div className="unit-edit-actions">
                <button type="button" onClick={() => setIsEditing(false)}>取消</button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          )}

          {/* 关卡列表 */}
          <div className="unit-lessons">
            <h4>关卡列表</h4>
            {lessonCount === 0 ? (
              <p className="lessons-empty">暂无关卡，请上传素材自动生成</p>
            ) : (
              <div className="lessons-grid">
                {unit.lessons?.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            )}
          </div>

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
            onChange={handleCoverChange}
          />
        </div>
      )}
    </div>
  );
};

// 关卡卡片组件
interface LessonCardProps {
  lesson: LessonSummary;
}

const LessonCard = ({ lesson }: LessonCardProps) => {
  const statusLabel = statusTextMap[lesson.status] ?? lesson.status;

  return (
    <div className="lesson-card-mini">
      <div className="lesson-mini-header">
        <span className="lesson-sequence">#{lesson.sequence}</span>
        <span className={`lesson-status-mini status-${lesson.status}`}>{statusLabel}</span>
      </div>
      <h5>{lesson.title}</h5>
      {lesson.currentVersion?.summary && (
        <p className="lesson-summary-mini">{lesson.currentVersion.summary}</p>
      )}
      <div className="lesson-mini-actions">
        <button type="button" disabled>编辑关卡</button>
        <button type="button" className="text" disabled>预览</button>
      </div>
    </div>
  );
};
