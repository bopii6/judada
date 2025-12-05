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
  uploadCoursePackageCsv,
  fetchGenerationJob,
  regenerateUnit,
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

const GRADE_OPTIONS = [
  { value: "", label: "请选择年级" },
  { value: "一年级", label: "一年级" },
  { value: "二年级", label: "二年级" },
  { value: "三年级", label: "三年级" },
  { value: "四年级", label: "四年级" },
  { value: "五年级", label: "五年级" },
  { value: "六年级", label: "六年级" },
  { value: "初一", label: "初一" },
  { value: "初二", label: "初二" },
  { value: "初三", label: "初三" },
  { value: "高一", label: "高一" },
  { value: "高二", label: "高二" },
  { value: "高三", label: "高三" }
];

const PUBLISHER_OPTIONS = [
  { value: "", label: "请选择出版社" },
  { value: "人教版（PEP）", label: "人教版（PEP）" },
  { value: "人教版（一年级起点）", label: "人教版（一年级起点）" },
  { value: "人教版（精通）", label: "人教版（精通）" },
  { value: "北师大版", label: "北师大版" },
  { value: "外研社版（一年级起点）", label: "外研社版（一年级起点）" },
  { value: "外研社版（三年级起点）", label: "外研社版（三年级起点）" },
  { value: "冀教版（一年级起点）", label: "冀教版（一年级起点）" },
  { value: "冀教版（三年级起点）", label: "冀教版（三年级起点）" },
  { value: "北京版", label: "北京版" },
  { value: "川教版", label: "川教版" },
  { value: "接力版", label: "接力版" },
  { value: "教科版（EEC学院）", label: "教科版（EEC学院）" },
  { value: "其他", label: "其他" }
];

const SEMESTER_OPTIONS = [
  { value: "", label: "请选择学期" },
  { value: "上册", label: "上册" },
  { value: "下册", label: "下册" }
];

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const MAX_PDF_UPLOAD_SIZE = 80 * 1024 * 1024;
const MIN_PDF_SPLIT_PAGES = 1;

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

const extractLessonPageRange = (material: PackageMaterialSummary): { start: number; end: number } | null => {
  const lessonPages = material.lessons
    .map(lesson => (typeof lesson.pageNumber === "number" ? Math.max(1, Math.round(lesson.pageNumber)) : null))
    .filter((value): value is number => value !== null);
  if (!lessonPages.length) {
    return null;
  }
  const start = Math.min(...lessonPages);
  const end = Math.max(...lessonPages);
  return { start, end };
};

const getMaterialPageRange = (material: PackageMaterialSummary): { start: number; end: number } | null => {
  const lessonRange = extractLessonPageRange(material);
  if (lessonRange) {
    return lessonRange;
  }
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
  const lessonRange = extractLessonPageRange(material);
  if (lessonRange && lessonRange.start === lessonRange.end) {
    return lessonRange.start;
  }
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
const MIN_ROUND_COUNT = 4;
const LESSONS_PER_ROUND = 16;

const computeRoundIndex = (sequence?: number | null) => {
  if (!sequence || sequence <= 0) {
    return 0;
  }
  return Math.floor((sequence - 1) / LESSONS_PER_ROUND);
};

const formatRoundTitle = (index: number) => `第 ${index + 1} 轮`;
const deriveRoundIndexFromLesson = (lesson: MaterialLessonSummary) => {
  if (typeof lesson.roundIndex === "number" && lesson.roundIndex > 0) {
    return lesson.roundIndex - 1;
  }
  return computeRoundIndex(lesson.sequence);
};

const deriveRoundOrderFromLesson = (lesson: MaterialLessonSummary) => {
  if (typeof lesson.roundOrder === "number" && lesson.roundOrder > 0) {
    return lesson.roundOrder;
  }
  if (typeof lesson.sequence === "number" && lesson.sequence > 0) {
    return ((lesson.sequence - 1) % LESSONS_PER_ROUND) + 1;
  }
  return 0;
};

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
    const pattern = new RegExp(`\\s*[·?．?\\-]*\\s*${escapeRegExp(candidate)}\\s*$`);
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
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const importJobPollerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [editState, setEditState] = useState({
    title: "",
    topic: "",
    description: "",
    grade: "",
    publisher: "",
    semester: ""
  });

  // 新增单元弹窗
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [newUnitDescription, setNewUnitDescription] = useState("");
  const [newUnitSequence, setNewUnitSequence] = useState("");
  const [bookImportMessage, setBookImportMessage] = useState<
    { type: "success" | "error" | "info"; text: string } | null
  >(null);
  const [csvImportMessage, setCsvImportMessage] = useState<
    { type: "success" | "error" | "info"; text: string } | null
  >(null);
  const [bookPageNumberStart, setBookPageNumberStart] = useState("");

  const stopImportJobPolling = () => {
    if (importJobPollerRef.current) {
      window.clearTimeout(importJobPollerRef.current);
      importJobPollerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopImportJobPolling();
    };
  }, []);

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
        description: updated.description ?? "",
        grade: updated.grade ?? "",
        publisher: updated.publisher ?? "",
        semester: updated.semester ?? ""
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

  type ImportBookPayload = { file: File; pageNumberStart?: number };

  const monitorTextbookImportJob = (jobId: string) => {
    stopImportJobPolling();
    setBookImportMessage({ type: "info", text: "已提交教材 PDF，后台正在解析目录..." });

    const poll = async () => {
      try {
        const { job } = await fetchGenerationJob(jobId);
        if (!job) {
          setBookImportMessage({ type: "error", text: "未找到教材导入任务，请稍后重试" });
          return;
        }

        if (job.status === "succeeded") {
          stopImportJobPolling();
          const resultPayload = (job.result ?? {}) as { units?: unknown };
          const units = Array.isArray(resultPayload.units) ? resultPayload.units : [];
          const unitCount = units.length;
          const successMessage =
            unitCount > 0
              ? `教材解析完成，已新增 ${unitCount} 个目录任务`
              : "教材解析完成，但未识别到目录，请检查 PDF";
          setBookImportMessage({
            type: unitCount > 0 ? "success" : "error",
            text: successMessage
          });
          void refetchUnits();
          void refetchMaterials();
          void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
          return;
        }

        if (job.status === "failed") {
          stopImportJobPolling();
          setBookImportMessage({
            type: "error",
            text: job.errorMessage || "教材导入任务失败，请查看任务监控"
          });
          void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
          return;
        }

        const waitingMessage =
          job.status === "processing" ? "正在解析教材，请稍候..." : "任务排队中，即将开始处理...";
        setBookImportMessage({ type: "info", text: waitingMessage });
        importJobPollerRef.current = window.setTimeout(poll, 5000);
      } catch (error) {
        console.warn("[CourseDetail] 获取教材导入任务状态失败", error);
        setBookImportMessage({
          type: "info",
          text: "正在重试获取任务状态..."
        });
        importJobPollerRef.current = window.setTimeout(poll, 7000);
      }
    };

    poll();
  };

  const importBookMutation = useMutation({
    mutationFn: async ({ file, pageNumberStart }: ImportBookPayload) => {
      if (!id) throw new Error("课程包ID缺失");
      return importTextbookPdf(id, file, pageNumberStart);
    },
    onMutate: () => {
      setBookImportMessage(null);
      stopImportJobPolling();
    },
    onSuccess: result => {
      setBookImportMessage({ type: "info", text: "教材上传完成，任务已创建..." });
      monitorTextbookImportJob(result.job.id);
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

  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) {
        throw new Error("课程包ID缺失");
      }
      return uploadCoursePackageCsv(id, file);
    },
    onMutate: () => {
      setCsvImportMessage({ type: "info", text: "正在上传 CSV..." });
    },
    onSuccess: response => {
      if (response.result) {
        const unitCount = response.result.units.length;
        const lessonCount = response.result.totalLessons;
        setCsvImportMessage({
          type: "success",
          text: `CSV 导入完成：${unitCount} 个单元 / ${lessonCount} 条关卡`
        });
        void refetchUnits();
        void refetchMaterials();
      } else {
        setCsvImportMessage({
          type: "success",
          text: response.message || "CSV 上传成功，系统正在后台导入，请稍后刷新页面查看结果"
        });
      }
    },
    onError: failure => {
      setCsvImportMessage({ type: "error", text: (failure as Error).message });
    },
    onSettled: () => {
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  });

  const runMaterialsAction = async (materialId: string, action: () => Promise<unknown>, successTip: string) => {
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

  const handleRegenerateMaterial = async (material: PackageMaterialSummary, unitId?: string) => {
    if (!id) return;
    if (!window.confirm(`确定要重新生成素材「${formatMaterialLabel(material)}」下的关卡吗？`)) return;
    await runMaterialsAction(
      material.id,
      () => regeneratePackageMaterial(id, material.id, unitId ? { unitId } : undefined),
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
        description: detail.description ?? "",
        grade: detail.grade ?? "",
        publisher: detail.publisher ?? "",
        semester: detail.semester ?? ""
      });
    }
  }, [detail]);

  const normalizedDetailDescription = (detail?.description ?? "").trim();
  const normalizedEditDescription = (editState.description ?? "").trim();
  const normalizedDetailGrade = (detail?.grade ?? "").trim();
  const normalizedEditGrade = (editState.grade ?? "").trim();
  const normalizedDetailPublisher = (detail?.publisher ?? "").trim();
  const normalizedEditPublisher = (editState.publisher ?? "").trim();
  const normalizedDetailSemester = (detail?.semester ?? "").trim();
  const normalizedEditSemester = (editState.semester ?? "").trim();
  const isBasicInfoDirty = Boolean(
    detail &&
      (detail.title !== editState.title.trim() ||
        detail.topic !== editState.topic.trim() ||
        normalizedDetailDescription !== normalizedEditDescription ||
        normalizedDetailGrade !== normalizedEditGrade ||
        normalizedDetailPublisher !== normalizedEditPublisher ||
        normalizedDetailSemester !== normalizedEditSemester)
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

  const handleCsvUploadClick = () => {
    setCsvImportMessage(null);
    csvInputRef.current?.click();
  };

  const handleCsvFileChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      setCsvImportMessage({ type: "error", text: "CSV 文件不能超过 15MB" });
      event.target.value = "";
      return;
    }
    const lowerName = file.name.toLowerCase();
    const isCsv = file.type.includes("csv") || lowerName.endsWith(".csv");
    if (!isCsv) {
      setCsvImportMessage({ type: "error", text: "请上传 .csv 格式的文件" });
      event.target.value = "";
      return;
    }
    csvImportMutation.mutate(file);
    event.target.value = "";
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
    let normalizedPageStart: number | undefined;
    if (bookPageNumberStart.trim()) {
      const parsed = Number(bookPageNumberStart.trim());
      if (Number.isNaN(parsed) || parsed < 1) {
        setBookImportMessage({ type: "error", text: "请填写正确的起始页码（正整数）" });
        event.target.value = "";
        return;
      }
      normalizedPageStart = Math.round(parsed);
    }
    importBookMutation.mutate({ file, pageNumberStart: normalizedPageStart });
    event.target.value = "";
  };

  const handleBasicInfoChange =
    (key: "title" | "topic" | "description" | "grade" | "publisher" | "semester") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        description: detail.description ?? "",
        grade: detail.grade ?? "",
        publisher: detail.publisher ?? "",
        semester: detail.semester ?? ""
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
    const description = (editState.description ?? "").trim();
    const grade = (editState.grade ?? "").trim();
    const publisher = (editState.publisher ?? "").trim();
    const semester = (editState.semester ?? "").trim();

    if (!title || !topic) {
      setUpdateError("请填写课程包名称和主题");
      setUpdateSuccess(null);
      return;
    }

    const payload: UpdateCoursePackagePayload = {
      title,
      topic,
      description: description.length > 0 ? description : null,
      grade: grade.length > 0 ? grade : null,
      publisher: publisher.length > 0 ? publisher : null,
      semester: semester.length > 0 ? semester : null
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
            <span className="publish-hint success">✅ 已有 {publishedUnits} 个单元发布，用户端可见</span>
          ) : (
            <span className="publish-hint warning">⚠️ 尚未发布任何单元，用户端不可见</span>
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
      <input
        ref={csvInputRef}
        type="file"
        accept="text/csv,.csv"
        hidden
        onChange={handleCsvFileChange}
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
          <div className="textbook-import-group">
            <button
              type="button"
              className="secondary"
              onClick={handleCsvUploadClick}
              disabled={csvImportMutation.isPending}
            >
              {csvImportMutation.isPending ? "导入中..." : "📄 上传 CSV"}
            </button>
            {csvImportMessage && (
              <p className={`textbook-import-message ${csvImportMessage.type}`}>
                {csvImportMessage.text}
              </p>
            )}
            <p className="textbook-import-hint">
              CSV 格式: unit,unit_title,round,round_title,en,cn,page（推荐用 ChatGPT 生成）
            </p>
          </div>
          <div className="textbook-import-group">
            <button
              type="button"
              className="primary"
              onClick={handleFullBookUploadClick}
              disabled={importBookMutation.isPending}
            >
              {importBookMutation.isPending ? "解析中..." : "📘 上传整本教材"}
            </button>
            <p className="textbook-import-hint">PDF ≤ 80MB，目录需带有单元名称与页码</p>
            <label className="upload-hint">
              <span>PDF 第一页的教材页码</span>
              <input
                type="number"
                min={1}
                placeholder="默认 1"
                value={bookPageNumberStart}
                onChange={event => setBookPageNumberStart(event.target.value)}
              />
            </label>
          </div>
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
          <label>
            <span>年级</span>
            <select value={editState.grade} onChange={handleBasicInfoChange("grade")}>
              {GRADE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>出版社</span>
            <select value={editState.publisher} onChange={handleBasicInfoChange("publisher")}>
              {PUBLISHER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>学期</span>
            <select value={editState.semester} onChange={handleBasicInfoChange("semester")}>
              {SEMESTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
  pageNumber: string;
}

interface RoundLessonEntry {
  material: PackageMaterialSummary;
  lesson: MaterialLessonSummary;
  roundIndex: number;
  roundOrder: number;
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
  const [pdfPageNumberStart, setPdfPageNumberStart] = useState("");

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

  const unitRegenerateMutation = useMutation({
    mutationFn: () => regenerateUnit(unit.id),
    onSuccess: () => {
      setUploadMessage({ type: "success", text: "已触发单元重新生成任务，关卡将重新生成..." });
      onUpdate();
      void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
    },
    onError: error => {
      setUploadMessage({ type: "error", text: (error as Error).message });
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
      const pageNumberInput = editor.pageNumber.trim();
      let normalizedPageNumber: number | null = null;
      if (pageNumberInput) {
        const parsed = Number(pageNumberInput);
        if (Number.isNaN(parsed) || parsed < 1) {
          throw new Error("页码必须为正整数");
        }
        normalizedPageNumber = Math.round(parsed);
      }
      const payload = {
        title,
        en,
        cn: cn ? cn : null,
        pageNumber: normalizedPageNumber
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
      // 手动 invalidate 相关查询缓存，确保数据立即更新
      void queryClient.invalidateQueries({ queryKey: ["course-packages", unit.packageId, "units"] });
      void queryClient.invalidateQueries({ queryKey: ["course-packages", unit.packageId, "materials-tree"] });
      void queryClient.invalidateQueries({ queryKey: ["course-packages", unit.packageId] });
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const singlePdf = files.length === 1 && (files[0].type.includes("pdf") || files[0].name.toLowerCase().endsWith(".pdf"));
    if (singlePdf) {
      const target = files[0];
      if (target.size > MAX_PDF_UPLOAD_SIZE) {
        setUploadMessage({ type: "error", text: "PDF 体积超过 80MB，暂无法切分" });
        return;
      }
      let normalizedPageStart: number | undefined;
      if (pdfPageNumberStart.trim()) {
        const parsed = Number(pdfPageNumberStart.trim());
        if (Number.isNaN(parsed) || parsed < 1) {
          setUploadMessage({ type: "error", text: "请填写正确的起始页码（正整数）" });
          return;
        }
        normalizedPageStart = Math.round(parsed);
      }
      uploadMaterialMutation.mutate({
        files,
        options: { splitPdf: true, splitPageCount: MIN_PDF_SPLIT_PAGES, pageNumberStart: normalizedPageStart }
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

  const handleRegenerateUnit = () => {
    if (!window.confirm(`确定重新生成「${unit.title}」中的所有关卡吗？将根据现有素材重新创建，可能覆盖已编辑的内容。`)) {
      return;
    }
    unitRegenerateMutation.mutate();
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

  const roundEntries = useMemo<RoundLessonEntry[]>(() => {
    // 优先使用素材关联的关卡
    if (unitMaterials.length > 0) {
      return unitMaterials.flatMap(({ material, lessons }) =>
        lessons.map(lesson => ({
          material,
          lesson,
          roundIndex: deriveRoundIndexFromLesson(lesson),
          roundOrder: deriveRoundOrderFromLesson(lesson)
        }))
      );
    }
    
    // 如果没有素材，从 unit.lessons 获取关卡（CSV/JSON 导入的情况）
    if (unit.lessons && unit.lessons.length > 0) {
      return unit.lessons.map(lesson => {
        // 从 currentVersion.items 中提取内容
        const item = lesson.currentVersion?.items?.[0];
        const payload = item?.payload as Record<string, unknown> | null;
        const contentEn = (payload?.en as string) ?? (payload?.answer as string) ?? lesson.title;
        const contentCn = (payload?.cn as string) ?? "";
        const pageNumber = (payload?.pageNumber as number) ?? lesson.pageNumber ?? null;
        
        // 转换为 MaterialLessonSummary 兼容格式
        const lessonData: MaterialLessonSummary = {
          id: lesson.id,
          title: lesson.title,
          sequence: lesson.sequence,
          unitNumber: lesson.unitNumber ?? null,
          unitName: lesson.unitName ?? null,
          unitId: lesson.unitId,
          status: lesson.status,
          roundIndex: lesson.roundIndex ?? null,
          roundOrder: lesson.roundOrder ?? null,
          pageNumber,
          contentEn,
          contentCn
        };
        
        // 创建一个虚拟的素材对象用于显示
        const dummyMaterial: PackageMaterialSummary = {
          id: "csv-import",
          originalName: "CSV 导入",
          mimeType: null,
          fileSize: null,
          sourceType: "csv_import",
          metadata: null,
          createdAt: "",
          lessonCount: 0,
          lessons: []
        };
        
        return {
          material: dummyMaterial,
          lesson: lessonData,
          roundIndex: deriveRoundIndexFromLesson(lessonData),
          roundOrder: deriveRoundOrderFromLesson(lessonData)
        };
      });
    }
    
    return [];
  }, [unitMaterials, unit.lessons]);

  const roundCount = useMemo(() => {
    const explicit = roundEntries.reduce((max, entry) => Math.max(max, (entry.roundIndex ?? 0) + 1), 0);
    const estimated = Math.ceil((unit.lessons?.length ?? 0) / LESSONS_PER_ROUND);
    const fallback = estimated || explicit || MIN_ROUND_COUNT;
    return Math.max(MIN_ROUND_COUNT, explicit, fallback);
  }, [roundEntries, unit.lessons]);

  const roundGroups = useMemo(
    () =>
      Array.from({ length: roundCount }, (_item, index) => {
        const lessons = roundEntries
          .filter(entry => entry.roundIndex === index)
          .sort((a, b) => {
            const orderA = a.roundOrder || 0;
            const orderB = b.roundOrder || 0;
            if (orderA && orderB && orderA !== orderB) {
              return orderA - orderB;
            }
            const seqA = a.lesson.sequence ?? 0;
            const seqB = b.lesson.sequence ?? 0;
            return seqA - seqB;
          });
        return { roundIndex: index, lessons };
      }),
    [roundEntries, roundCount]
  );

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
      cn: lesson?.contentCn ?? "",
      pageNumber: lesson?.pageNumber ? String(lesson.pageNumber) : ""
    });
  };

  const handleLessonFieldChange =
    (field: "title" | "en" | "cn" | "pageNumber") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLessonEditor(prev => (prev ? { ...prev, [field]: value } : prev));
    };

  const handleLessonMaterialChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!lessonEditor) return;
    const nextMaterial = unitMaterials.find(entry => entry.material.id === event.target.value);
    if (nextMaterial) {
      setLessonEditor({ ...lessonEditor, material: nextMaterial.material });
    }
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
              <button
                type="button"
                onClick={handleRegenerateUnit}
                disabled={unitRegenerateMutation.isPending}
              >
                {unitRegenerateMutation.isPending ? "重新生成中..." : "🔁 重新生成单元"}
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
                {unpublishMutation.isPending ? "下架中..." : "📥 下架单元"}
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
              🗑 删除
            </button>
            <div className="upload-hint">
              <label>
                <span>PDF第一页对应教材页码</span>
                <input
                  type="number"
                  min={1}
                  placeholder="默认 1"
                  value={pdfPageNumberStart}
                  onChange={event => setPdfPageNumberStart(event.target.value)}
                />
              </label>
            </div>
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

          <div className="unit-rounds-board">
            <h4>回合与关卡</h4>
            {roundEntries.length === 0 ? (
              <p className="materials-empty">暂无关卡，请先上传教材或手动新增句子。</p>
            ) : (
              <div className="round-grid">
                {roundGroups.map(group => {
                  const defaultMaterial = group.lessons[0]?.material ?? unitMaterials[0]?.material;
                  return (
                    <div key={group.roundIndex} className="round-card">
                      <div className="round-card-header">
                        <div>
                          <p className="round-title">{formatRoundTitle(group.roundIndex)}</p>
                          <p className="round-meta">{group.lessons.length} 个关卡</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!defaultMaterial) {
                              alert("请先上传教材素材后再新增句子");
                              return;
                            }
                            openLessonEditor("create", defaultMaterial, null, group.lessons.length + 1);
                          }}
                          disabled={lessonSaveMutation.isPending || !defaultMaterial}
                        >
                          + 新增句子
                        </button>
                      </div>
                      {group.lessons.length === 0 ? (
                        <p className="round-empty">该回合暂未分配关卡</p>
                      ) : (
                        <ul className="round-lesson-list">
                          {group.lessons.map(entry => {
                            const pageLabel = formatLessonPageTag(entry.lesson);
                            return (
                              <li key={entry.lesson.id}>
                                <div className="round-lesson-info">
                                  <div className="round-lesson-title">
                                    #{entry.lesson.sequence ?? "—"} {entry.lesson.contentEn || "未提供句子"}
                                  </div>
                                  <div className="round-lesson-meta">
                                    <span>{pageLabel}</span>
                                    <span className="round-lesson-source">{formatMaterialLabel(entry.material)}</span>
                                  </div>
                                  {entry.lesson.contentCn && (
                                    <p className="round-lesson-cn">{entry.lesson.contentCn}</p>
                                  )}
                                </div>
                                <div className="round-lesson-actions">
                                  <button
                                    type="button"
                                    onClick={() => openLessonEditor("edit", entry.material, entry.lesson)}
                                  >
                                    编辑
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => handleLessonDelete(entry.lesson)}
                                    disabled={lessonDeleteMutation.isPending}
                                  >
                                    删除
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="unit-materials-panel">
            <h4>素材管理</h4>
            {unitMaterials.length === 0 ? (
              <p className="materials-empty">暂无素材，请通过上方按钮上传教材。</p>
            ) : (
              <div className="materials-grid compact">
                {unitMaterials.map(({ material, lessons }) => (
                  <div key={material.id} className="material-card mini">
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
                          onClick={() => onRegenerateMaterial(material, unit.id)}
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
                    <div className="material-target-control">
                      <span>AI 目标关卡数：</span>
                      <div className="material-target-options">
                        {MATERIAL_LESSON_TARGET_OPTIONS.map(option => (
                          <button
                            type="button"
                            key={option}
                            className={getMaterialLessonTarget(material) === option ? "active" : ""}
                            onClick={() => onUpdateMaterialTarget(material, option)}
                          >
                            {option} 个
                          </button>
                        ))}
                      </div>
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
                    <span>所属素材 *</span>
                    <select value={lessonEditor.material.id} onChange={handleLessonMaterialChange}>
                      {unitMaterials.map(({ material }) => (
                        <option key={material.id} value={material.id}>
                          {formatMaterialLabel(material)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>页码</span>
                    <input
                      type="number"
                      min={1}
                      value={lessonEditor.pageNumber}
                      onChange={handleLessonFieldChange("pageNumber")}
                      placeholder="例如：2"
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

const formatLessonPageTag = (lesson: MaterialLessonSummary) => {
  if (typeof lesson.pageNumber === "number") {
    return `第 ${lesson.pageNumber} 页`;
  }
  if (typeof lesson.sourceAssetOrder === "number") {
    return `第 ${lesson.sourceAssetOrder + 1} 页`;
  }
  return "未标注页码";
};
