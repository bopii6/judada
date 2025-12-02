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
  PackageMaterialSummary,
  MaterialLessonSummary,
  fetchCoursePackageDetail,
  fetchPackageMaterials,
  uploadCoursePackageCover,
  updateCoursePackage,
  fetchUnits,
  createUnit,
  updateUnit,
  publishUnit,
  unpublishUnit,
  deleteUnit,
  uploadUnitMaterial,
  UploadUnitMaterialOptions,
  uploadUnitCover,
  regeneratePackageMaterial,
  deletePackageMaterial,
  getMaterialPreviewUrl,
  updateMaterialMetadata,
  updateLessonContent,
  deleteLessonById,
  createManualLesson,
  importTextbookPdf,
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

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const MAX_PDF_UPLOAD_SIZE = 80 * 1024 * 1024;
const DEFAULT_PDF_SPLIT_PAGES = 8;
const MIN_PDF_SPLIT_PAGES = 1;
const MAX_PDF_SPLIT_PAGES = 16;

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const getMaterialPageRange = (material: PackageMaterialSummary): { start: number; end: number } | null => {
  const metadata = (material.metadata ?? {}) as Record<string, unknown>;
  const rangeCandidate = metadata.pageRange;
  if (!rangeCandidate || typeof rangeCandidate !== "object") {
    return null;
  }
  const range = rangeCandidate as Record<string, unknown>;
  const start = parseNumericValue(range.start);
  const end = parseNumericValue(range.end);
  if (start === null || end === null) {
    return null;
  }
  const normalizedStart = Math.max(1, Math.round(start));
  const normalizedEnd = Math.max(normalizedStart, Math.round(end));
  return { start: normalizedStart, end: normalizedEnd };
};

const getMaterialPageNumber = (material: PackageMaterialSummary): number | null => {
  const metadata = (material.metadata ?? {}) as Record<string, unknown>;
  const candidateKeys = ["pageNumber", "page", "page_index", "pageIndex", "pageNo", "page_no", "pageNum", "page_num"];
  for (const key of candidateKeys) {
    const numeric = parseNumericValue(metadata[key]);
    if (numeric !== null) {
      return numeric <= 0 ? numeric + 1 : numeric;
    }
  }
  const lessonWithOrder = material.lessons.find(lesson => typeof lesson.sourceAssetOrder === "number");
  if (lessonWithOrder) {
    return (lessonWithOrder.sourceAssetOrder ?? 0) + 1;
  }
  const baseName = material.originalName.replace(/\.[^.]+$/, "");
  const segments = baseName.split(/[-_]/).filter(Boolean);
  if (segments.length) {
    const lastSegmentDigits = segments[segments.length - 1].replace(/\D+/g, "");
    if (lastSegmentDigits) {
      const parsed = Number(lastSegmentDigits);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const formatMaterialLabel = (material: PackageMaterialSummary) => {
  const range = getMaterialPageRange(material);
  if (range) {
    return range.start === range.end ? `Page ${range.start}` : `Pages ${range.start}-${range.end}`;
  }
  const pageNumber = getMaterialPageNumber(material);
  if (pageNumber !== null) {
    const normalized = Math.max(1, Math.round(pageNumber));
    return `Page ${normalized}`;
  }
  const metadataLabel = typeof material.metadata?.label === "string" ? material.metadata.label.trim() : "";
  return metadataLabel || material.originalName;
};

const MATERIAL_LESSON_TARGET_OPTIONS = [3, 5, 8] as const;
type LessonTargetOption = (typeof MATERIAL_LESSON_TARGET_OPTIONS)[number];
const DEFAULT_MATERIAL_LESSON_TARGET: LessonTargetOption = 5;

const clampLessonTarget = (value: number): LessonTargetOption => {
  const min = MATERIAL_LESSON_TARGET_OPTIONS[0];
  const max = MATERIAL_LESSON_TARGET_OPTIONS[MATERIAL_LESSON_TARGET_OPTIONS.length - 1];
  const clamped = Math.max(min, Math.min(max, Math.round(value)));
  return MATERIAL_LESSON_TARGET_OPTIONS.includes(clamped as LessonTargetOption)
    ? (clamped as LessonTargetOption)
    : DEFAULT_MATERIAL_LESSON_TARGET;
};

const getMaterialLessonTarget = (material: PackageMaterialSummary): LessonTargetOption => {
  const metadata = (material.metadata ?? {}) as Record<string, unknown>;
  const candidateKeys = [
    "lessonTargetCount",
    "lesson_target_count",
    "targetLessons",
    "lessonGoal",
    "targetLessonCount"
  ];
  for (const key of candidateKeys) {
    const numeric = parseNumericValue(metadata?.[key]);
    if (numeric !== null) {
      return clampLessonTarget(numeric);
    }
  }
  const fallback = material.lessonCount;
  if (typeof fallback === "number" && MATERIAL_LESSON_TARGET_OPTIONS.includes(fallback as LessonTargetOption)) {
    return fallback as LessonTargetOption;
  }
  return DEFAULT_MATERIAL_LESSON_TARGET;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizeLessonTitle = (title: string | null | undefined, material?: PackageMaterialSummary) => {
  if (!title) return "";
  let result = title.trim();
  if (!result) return "";
  const candidates: string[] = [];
  if (material?.originalName) {
    candidates.push(material.originalName.trim());
    const base = material.originalName.replace(/\.[^.]+$/, "").trim();
    if (base && base !== candidates[0]) {
      candidates.push(base);
    }
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const pattern = new RegExp(`\\s*[·•．・\\-]*\\s*${escapeRegExp(candidate)}\\s*$`);
    if (pattern.test(result)) {
      result = result.replace(pattern, "").trim();
    }
  }
  return result;
};

export const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const fullBookInputRef = useRef<HTMLInputElement | null>(null);
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
  const [newUnitSequence, setNewUnitSequence] = useState("");
  const [bookImportMessage, setBookImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const recommendedUnitSequence = useMemo(() => {
    if (units.length === 0) {
      return 1;
    }
    const maxSequence = units.reduce((max, unit) => Math.max(max, unit.sequence ?? 0), 0);
    return Math.max(1, maxSequence + 1);
  }, [units]);

  const {
    data: materialsData,
    isLoading: materialsLoading,
    error: materialsError,
    refetch: refetchMaterials,
    isFetching: materialsFetching
  } = useQuery({
    queryKey: ["course-packages", id, "materials-tree"],
    queryFn: () => fetchPackageMaterials(id!),
    enabled: Boolean(id)
  });

  const materials = materialsData?.materials ?? [];
  const unassignedLessons = materialsData?.unassignedLessons ?? [];
  const [materialsFeedback, setMaterialsFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [materialActionId, setMaterialActionId] = useState<string | null>(null);

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
      setNewUnitSequence("");
      void refetchUnits();
    }
  });

  const importBookMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) throw new Error("课程包ID缺失");
      return importTextbookPdf(id, file);
    },
    onMutate: () => {
      setBookImportMessage(null);
    },
    onSuccess: result => {
      const unitCount = result.units.length;
      const message =
        unitCount > 0
          ? `已解析 ${unitCount} 个单元，系统正在为每个单元生成关卡`
          : "上传成功，但未解析到单元信息";
      setBookImportMessage({
        type: unitCount > 0 ? "success" : "error",
        text: message
      });
      void refetchUnits();
      void refetchMaterials();
      void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
    },
    onError: failure => {
      setBookImportMessage({ type: "error", text: (failure as Error).message });
    },
    onSettled: () => {
      if (fullBookInputRef.current) {
        fullBookInputRef.current.value = "";
      }
    }
  });

  const runMaterialsAction = async (materialId: string, action: () => Promise<void>, successTip: string) => {
    if (!id) return;
    setMaterialActionId(materialId);
    setMaterialsFeedback(null);
    try {
      await action();
      setMaterialsFeedback({ type: "success", text: successTip });
      void refetchMaterials();
    } catch (error) {
      setMaterialsFeedback({ type: "error", text: (error as Error).message });
    } finally {
      setMaterialActionId(null);
    }
  };

  const handleRenameMaterial = async (material: PackageMaterialSummary) => {
    if (!id) return;
    const currentLabel = formatMaterialLabel(material);
    const next = window.prompt("请输入素材备注（可选）", currentLabel);
    if (next === null) return;
    const labelToSave = next.trim();
    await runMaterialsAction(
      material.id,
      () => updateMaterialMetadata(id, material.id, { label: labelToSave || undefined }),
      "素材备注已更新"
    );
  };

  const handleRegenerateMaterial = async (material: PackageMaterialSummary) => {
    if (!id) return;
    if (!window.confirm(`确定要重新生成素材「${formatMaterialLabel(material)}」下的关卡吗？`)) return;
    await runMaterialsAction(
      material.id,
      () => regeneratePackageMaterial(id, material.id),
      "已触发重新生成任务"
    );
  };

  const handleMaterialTargetChange = async (material: PackageMaterialSummary, target: LessonTargetOption) => {
    if (!id) return;
    const current = getMaterialLessonTarget(material);
    if (current === target) return;
    await runMaterialsAction(
      material.id,
      () => updateMaterialMetadata(id, material.id, { lessonTargetCount: target }),
      `已调整为每次生成 ${target} 个关卡`
    );
  };

  const handleDeleteMaterial = async (material: PackageMaterialSummary) => {
    if (!id) return;
    if (!window.confirm(`删除素材会同时解除与关卡的关联，确认删除「${formatMaterialLabel(material)}」？`)) return;
    await runMaterialsAction(
      material.id,
      () => deletePackageMaterial(id, material.id),
      "素材已删除"
    );
  };

  const handlePreviewMaterial = async (material: PackageMaterialSummary) => {
    if (!id) return;
    setMaterialActionId(material.id);
    setMaterialsFeedback(null);
    try {
      const { url } = await getMaterialPreviewUrl(id, material.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMaterialsFeedback({ type: "error", text: (error as Error).message });
    } finally {
      setMaterialActionId(null);
    }
  };


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

  const handleFullBookUploadClick = () => {
    setBookImportMessage(null);
    fullBookInputRef.current?.click();
  };

  const handleFullBookFileChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PDF_UPLOAD_SIZE) {
      setBookImportMessage({ type: "error", text: "整本教材 PDF 不能超过 80MB" });
      event.target.value = "";
      return;
    }
    const isPdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setBookImportMessage({ type: "error", text: "请上传 PDF 格式的教材" });
      event.target.value = "";
      return;
    }
    importBookMutation.mutate(file);
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
    const title = newUnitTitle.trim();
    if (!title) {
      alert("请填写单元标题");
      return;
    }
    const description = newUnitDescription.trim();
    const sequenceInput = newUnitSequence.trim();
    let parsedSequence: number | undefined;
    if (sequenceInput) {
      const numeric = Number(sequenceInput);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        alert("请填写有效的单元编号（正整数）");
        return;
      }
      parsedSequence = Math.floor(numeric);
    }
    createUnitMutation.mutate({
      title,
      description: description || undefined,
      sequence: parsedSequence
    });
  };
  const handleOpenCreateUnit = () => {
    setNewUnitSequence(String(recommendedUnitSequence));
    setShowCreateUnit(true);
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
          {publishedUnits > 0 ? (
            <span className="publish-hint success">✓ 已有 {publishedUnits} 个单元发布，用户端可见</span>
          ) : (
            <span className="publish-hint warning">⚠ 尚未发布任何单元，用户端不可见</span>
          )}
        </div>
      </header>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleCoverFileChange}
      />
      <input
        ref={fullBookInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={handleFullBookFileChange}
      />

      <section className="textbook-import-card">
        <div className="textbook-import-info">
          <div>
            <h2>整书自动导入</h2>
            <p>上传包含目录的完整 PDF，系统会根据目录自动创建单元并生成关卡。</p>
          </div>
          {bookImportMessage && (
            <p className={`textbook-import-message ${bookImportMessage.type}`}>{bookImportMessage.text}</p>
          )}
        </div>
        <div className="textbook-import-actions">
          <button
            type="button"
            className="primary"
            onClick={handleFullBookUploadClick}
            disabled={importBookMutation.isPending}
          >
            {importBookMutation.isPending ? "解析中..." : "📚 上传整本教材"}
          </button>
          <p className="textbook-import-hint">PDF ≤ 80MB，目录需带有单元名称与页码</p>
        </div>
      </section>

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
          <button type="button" className="add-unit-btn" onClick={handleOpenCreateUnit}>
            + 新增单元
          </button>
        </div>

        {(materialsFeedback || materialsError || materialsLoading || materialsFetching) && (
          <div className={`materials-feedback ${materialsFeedback?.type ?? ""}`}>
            {materialsLoading ? "素材数据加载中..." : null}
            {materialsFetching && !materialsLoading ? "素材数据刷新中..." : null}
            {materialsError && <span>素材加载失败：{(materialsError as Error).message}</span>}
            {materialsFeedback && <span>{materialsFeedback.text}</span>}
          </div>
        )}

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
                materials={materials}
                onUpdate={() => {
                  void refetchUnits();
                  void refetchDetail();
                  void refetchMaterials();
                }}
                materialActionId={materialActionId}
                onRenameMaterial={handleRenameMaterial}
                onPreviewMaterial={handlePreviewMaterial}
                onRegenerateMaterial={handleRegenerateMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                onUpdateMaterialTarget={handleMaterialTargetChange}
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
                <span>单元编号</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={newUnitSequence}
                  onChange={e => setNewUnitSequence(e.target.value)}
                  placeholder={`默认：${recommendedUnitSequence}`}
                />
                <span className="field-hint">默认会采用下一个顺序号，可手动指定补齐缺失的单元</span>
              </label>
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

      {unassignedLessons.length > 0 && (
        <section className="materials-unassigned">
          <h3>未关联素材的关卡</h3>
          <p className="hint">这些关卡尚未匹配到具体素材，可在单元中手动调整</p>
          <ul>
            {unassignedLessons.map(lesson => (
                <li key={lesson.id}>
                  <span className="material-lesson-title">
                    #{lesson.sequence ?? "—"} {lesson.contentEn || "未提供句子"}
                  </span>
                </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

// 单元卡片组件
interface UnitCardProps {
  unit: UnitSummary;
  onUpdate: () => void;
  materials: PackageMaterialSummary[];
  materialActionId: string | null;
  onRenameMaterial: (material: PackageMaterialSummary) => void;
  onPreviewMaterial: (material: PackageMaterialSummary) => void;
  onRegenerateMaterial: (material: PackageMaterialSummary, unitId?: string) => void;
  onDeleteMaterial: (material: PackageMaterialSummary) => void;
  onUpdateMaterialTarget: (material: PackageMaterialSummary, target: LessonTargetOption) => void;
}

interface LessonEditorState {
  mode: "create" | "edit";
  material: PackageMaterialSummary;
  lesson: MaterialLessonSummary | null;
  title: string;
  en: string;
  cn: string;
}

const UnitCard = ({
  unit,
  onUpdate,
  materials,
  materialActionId,
  onRenameMaterial,
  onPreviewMaterial,
  onRegenerateMaterial,
  onDeleteMaterial,
  onUpdateMaterialTarget
}: UnitCardProps) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(unit.title);
  const [editDescription, setEditDescription] = useState(unit.description ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lessonMessage, setLessonMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lessonEditor, setLessonEditor] = useState<LessonEditorState | null>(null);
  const [autoSplitPdf, setAutoSplitPdf] = useState(false);
  const [splitPageCount, setSplitPageCount] = useState(DEFAULT_PDF_SPLIT_PAGES);

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

  const lessonSaveMutation = useMutation({
    mutationFn: async (editor: LessonEditorState) => {
      const title = editor.title.trim();
      const en = editor.en.trim();
      const cn = editor.cn.trim();
      if (!title) {
        throw new Error("请填写关卡标题");
      }
      if (!en) {
        throw new Error("请填写英文句子");
      }
      const payload = {
        title,
        en,
        cn: cn ? cn : null
      };
      if (editor.mode === "edit" && editor.lesson) {
        await updateLessonContent(editor.lesson.id, payload);
        return "关卡内容已更新";
      }
      await createManualLesson(unit.packageId, editor.material.id, payload);
      return "已新增关卡";
    },
    onSuccess: message => {
      setLessonMessage({ type: "success", text: message });
      setLessonEditor(null);
      onUpdate();
    },
    onError: failure => {
      setLessonMessage({ type: "error", text: (failure as Error).message });
    }
  });

  const lessonDeleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      await deleteLessonById(lessonId);
    },
    onSuccess: () => {
      setLessonMessage({ type: "success", text: "关卡已删除" });
      onUpdate();
    },
    onError: failure => {
      setLessonMessage({ type: "error", text: (failure as Error).message });
    }
  });

  type UploadMaterialPayload = { files: File[]; options?: UploadUnitMaterialOptions };

  const uploadMaterialMutation = useMutation({
    mutationFn: (payload: UploadMaterialPayload) => uploadUnitMaterial(unit.id, payload.files, payload.options),
    onSuccess: (result) => {
      setUploadMessage({ type: "success", text: result.message || "素材上传成功，正在生成关卡中..." });
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

  const handleSplitPageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value);
    if (Number.isNaN(raw)) {
      setSplitPageCount(DEFAULT_PDF_SPLIT_PAGES);
      return;
    }
    const clamped = Math.max(MIN_PDF_SPLIT_PAGES, Math.min(MAX_PDF_SPLIT_PAGES, Math.round(raw)));
    setSplitPageCount(clamped);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (autoSplitPdf) {
      if (files.length > 1) {
        setUploadMessage({ type: "error", text: "自动切分模式一次仅支持一个 PDF" });
        return;
      }
      const target = files[0];
      const name = target.name.toLowerCase();
      const isPdf = target.type.includes('pdf') || name.endsWith('.pdf');
      if (!isPdf) {
        setUploadMessage({ type: "error", text: "请上传 PDF 文档以便自动切分" });
        return;
      }
      if (target.size > MAX_PDF_UPLOAD_SIZE) {
        setUploadMessage({ type: "error", text: "PDF 体积超过 80MB，暂无法切分" });
        return;
      }
      uploadMaterialMutation.mutate({
        files,
        options: { splitPdf: true, splitPageCount }
      });
      e.target.value = "";
      return;
    }

    if (files.length > 10) {
      setUploadMessage({ type: "error", text: "最多只能上传10张图片" });
      return;
    }
    const oversized = files.filter(f => f.size > MAX_UPLOAD_SIZE);
    if (oversized.length > 0) {
      setUploadMessage({ type: "error", text: "文件大小不能超过15MB" });
      return;
    }
    uploadMaterialMutation.mutate({ files });
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
  const unitMaterials = useMemo(() => {
    if (!materials.length) return [];
    return materials
      .map(material => {
        const linkedLessons = material.lessons.filter(lesson => lesson.unitId === unit.id);
        if (!linkedLessons.length) return null;
        return { material, lessons: linkedLessons };
      })
      .filter(Boolean) as Array<{ material: PackageMaterialSummary; lessons: MaterialLessonSummary[] }>;
  }, [materials, unit.id]);

  const openLessonEditor = (
    mode: "create" | "edit",
    material: PackageMaterialSummary,
    lesson?: MaterialLessonSummary | null,
    orderHint?: number
  ) => {
    setLessonEditor({
      mode,
      material,
      lesson: lesson ?? null,
      title: lesson ? sanitizeLessonTitle(lesson.title, material) : orderHint ? `关卡 ${orderHint}` : "",
      en: lesson?.contentEn ?? "",
      cn: lesson?.contentCn ?? ""
    });
  };

  const handleLessonFieldChange =
    (field: "title" | "en" | "cn") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLessonEditor(prev => (prev ? { ...prev, [field]: value } : prev));
    };

  const handleLessonModalSubmit: FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    if (!lessonEditor) return;
    lessonSaveMutation.mutate(lessonEditor);
  };

  const handleLessonDelete = (lesson: MaterialLessonSummary) => {
    if (!window.confirm(`确认删除关卡「${lesson.title}」吗？`)) return;
    lessonDeleteMutation.mutate(lesson.id);
  };

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
          {lessonMessage && (
            <p className={`unit-message ${lessonMessage.type}`}>{lessonMessage.text}</p>
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

          <div className="unit-materials-tree">
            <h4>素材与关卡树</h4>
            {unitMaterials.length === 0 ? (
              <p className="materials-empty">该单元尚未关联素材，可上传素材后查看生成结果。</p>
            ) : (
              <div className="materials-grid nested">
                {unitMaterials.map(({ material, lessons }) => (
                  <div key={material.id} className="material-card">
                    <div className="material-card-header clean">
                      <div>
                        <p className="material-label">{formatMaterialLabel(material)}</p>
                        <p className="material-meta subtle">
                          {lessons.length} 个关卡 · {formatBytes(material.fileSize)}
                        </p>
                      </div>
                      <div className="material-card-actions horizontal">
                        <button
                          type="button"
                          onClick={() => onRenameMaterial(material)}
                          disabled={materialActionId === material.id}
                        >
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => onPreviewMaterial(material)}
                          disabled={materialActionId === material.id}
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          onClick={() => onRegenerateMaterial(material)}
                          disabled={materialActionId === material.id}
                        >
                          重新生成
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onDeleteMaterial(material)}
                          disabled={materialActionId === material.id}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="material-lessons compact">
                      <div className="material-lessons-header">
                        <span>已关联 {lessons.length} 个关卡</span>
                        <button
                          type="button"
                          onClick={() => openLessonEditor("create", material, null, lessons.length + 1)}
                          disabled={lessonSaveMutation.isPending}
                        >
                          + 新增句子
                        </button>
                      </div>
                      <ul className="material-lessons-list detailed">
                        {lessons.map(lesson => (
                            <li key={lesson.id}>
                              <div className="material-lesson-info">
                                <div className="material-lesson-title">
                                  #{lesson.sequence ?? "—"} {lesson.contentEn || "未提供句子"}
                                </div>
                                {lesson.contentCn && (
                                  <p className="material-lesson-cn">{lesson.contentCn}</p>
                                )}
                              </div>
                              <div className="material-lesson-actions">
                                <button type="button" onClick={() => openLessonEditor("edit", material, lesson)}>
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => handleLessonDelete(lesson)}
                                  disabled={lessonDeleteMutation.isPending}
                                >
                                  删除
                                </button>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
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

          {lessonEditor && (
            <div className="modal-overlay" onClick={() => setLessonEditor(null)}>
              <div className="modal-content" onClick={event => event.stopPropagation()}>
                <h3>{lessonEditor.mode === "edit" ? "编辑句子" : "新增句子"}</h3>
                <form className="modal-form" onSubmit={handleLessonModalSubmit}>
                  <label>
                    <span>关卡标题 *</span>
                    <input
                      type="text"
                      value={lessonEditor.title}
                      onChange={handleLessonFieldChange("title")}
                      placeholder="例如：核心词汇训练"
                    />
                  </label>
                  <label>
                    <span>英文句子 *</span>
                    <textarea
                      rows={3}
                      value={lessonEditor.en}
                      onChange={handleLessonFieldChange("en")}
                      placeholder="请输入英文原文"
                    />
                  </label>
                  <label>
                    <span>中文翻译</span>
                    <textarea
                      rows={2}
                      value={lessonEditor.cn}
                      onChange={handleLessonFieldChange("cn")}
                      placeholder="可选：添加中文翻译"
                    />
                  </label>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setLessonEditor(null)} disabled={lessonSaveMutation.isPending}>
                      取消
                    </button>
                    <button type="submit" className="primary" disabled={lessonSaveMutation.isPending}>
                      {lessonSaveMutation.isPending ? "保存中..." : "保存"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
