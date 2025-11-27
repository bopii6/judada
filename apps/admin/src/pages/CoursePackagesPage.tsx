import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  CoursePackageListItem,
  createCoursePackage,
  deleteCoursePackage,
  deleteCoursePackages,
  fetchCoursePackages
} from "../api/coursePackages";
import "./CoursePackagesPage.css";

const statusTextMap: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  archived: "已归档"
};

const statusClassMap: Record<string, string> = {
  draft: "draft",
  pending_review: "pending",
  published: "published",
  archived: "archived"
};

const formatDate = (value: string) => new Date(value).toLocaleString();

// 年级选项
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

// 出版社选项
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

// 学期选项
const SEMESTER_OPTIONS = [
  { value: "", label: "请选择学期" },
  { value: "上册", label: "上册" },
  { value: "下册", label: "下册" }
];

export const CoursePackagesPage = () => {
  const { user, adminKey } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-packages"],
    queryFn: fetchCoursePackages
  });

  const items = useMemo<CoursePackageListItem[]>(() => data?.items ?? [], [data]);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({
    title: "",
    topic: "",
    description: "",
    grade: "",
    publisher: "",
    semester: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  
  // 筛选状态
  const [filterGrade, setFilterGrade] = useState("");
  const [filterPublisher, setFilterPublisher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createCoursePackage({
        title: formState.title.trim(),
        topic: formState.topic.trim(),
        description: formState.description.trim() || undefined,
        grade: formState.grade || undefined,
        publisher: formState.publisher || undefined,
        semester: formState.semester || undefined
      }),
    onSuccess: () => {
      setShowForm(false);
      setFormState({ title: "", topic: "", description: "", grade: "", publisher: "", semester: "" });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["course-packages"] }).catch(() => {
        /* ignore */
      });
    },
    onError: failure => {
      setFormError((failure as Error).message);
    }
  });
  
  // 筛选后的列表
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterGrade && item.grade !== filterGrade) return false;
      if (filterPublisher && item.publisher !== filterPublisher) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      return true;
    });
  }, [items, filterGrade, filterPublisher, filterStatus]);
  
  // 获取可用的筛选选项（从数据中动态获取）
  const availableGrades = useMemo(() => {
    const grades = new Set(items.map(item => item.grade).filter((g): g is string => !!g));
    return Array.from(grades).sort();
  }, [items]);
  
  const availablePublishers = useMemo(() => {
    const publishers = new Set(items.map(item => item.publisher).filter((p): p is string => !!p));
    return Array.from(publishers);
  }, [items]);

  const deleteMutation = useMutation({
    mutationFn: (packageId: string) => deleteCoursePackage(packageId),
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["course-packages"] }).catch(() => {
        /* ignore */
      });
    },
    onError: failure => {
      const error = failure as Error;
      console.error('删除课程包失败:', error);

      let errorMessage = error.message;
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = '认证失败，请重新登录管理后台';
      } else if (error.message.includes('课程包不存在')) {
        errorMessage = '课程包不存在或已被删除，请刷新页面';
      }

      alert(`删除失败: ${errorMessage}`);
      setDeleteConfirmId(null);
    }
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (packageIds: string[]) => deleteCoursePackages(packageIds),
    onSuccess: (data) => {
      setShowBatchDeleteConfirm(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["course-packages"] }).catch(() => {
        /* ignore */
      });

      // 显示详细结果
      let message = data.message;
      if (data.failedPackages && data.failedPackages.length > 0) {
        const failedTitles = data.failedPackages.map(p => p.title).join(', ');
        message += `\n\n以下课程包删除失败：\n${failedTitles}`;
      }
      alert(message);
    },
    onError: failure => {
      const error = failure as Error;
      console.error('批量删除课程包失败:', error);

      let errorMessage = error.message;
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = '认证失败，请重新登录管理后台';
      }

      alert(`批量删除失败: ${errorMessage}`);
      setShowBatchDeleteConfirm(false);
    }
  });

  const handleInputChange =
    (key: "title" | "topic" | "description" | "grade" | "publisher" | "semester") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormState(prev => ({
        ...prev,
        [key]: event.target.value
      }));
    };

  const handleSubmit = () => {
    if (!formState.title.trim() || !formState.topic.trim()) {
      setFormError("请填写课程包名称和主题。");
      return;
    }
    createMutation.mutate();
  };

  const handleDeleteClick = (packageId: string) => {
    setDeleteConfirmId(packageId);
  };

  const handleDeleteConfirm = (packageId: string) => {
    deleteMutation.mutate(packageId);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const draftIds = filteredItems.filter(item => item.status !== 'published').map(item => item.id);
      setSelectedIds(new Set(draftIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的课程包');
      return;
    }
    setShowBatchDeleteConfirm(true);
  };

  const handleBatchDeleteConfirm = () => {
    batchDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleBatchDeleteCancel = () => {
    setShowBatchDeleteConfirm(false);
  };

  return (
    <div className="packages">
      <header className="packages-header">
        <div>
          <h1>课程包管理</h1>
          <p>这里列出所有课程包，后续的自动生成、审核、发布都会在此操作。</p>
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              调试信息: 用户={user?.name}, 管理员密钥={adminKey ? '已设置' : '未设置'}
            </div>
          )}
        </div>
        <div>
          {showForm ? (
            <button
              type="button"
              className="packages-create outline"
              onClick={() => {
                if (createMutation.isPending) return;
                setShowForm(false);
                setFormError(null);
              }}
            >
              取消
            </button>
          ) : (
            <button type="button" className="packages-create" onClick={() => setShowForm(true)}>
              + 新建课程包
            </button>
          )}
        </div>
      </header>

      {showForm && (
        <section className="packages-form">
          <div className="packages-form-row">
            <label htmlFor="package-title">课程包名称 *</label>
            <input
              id="package-title"
              value={formState.title}
              onChange={handleInputChange("title")}
              placeholder="例如：人教版三年级英语上册"
              disabled={createMutation.isPending}
            />
          </div>
          
          <div className="packages-form-row-group">
            <div className="packages-form-row">
              <label htmlFor="package-grade">年级</label>
              <select
                id="package-grade"
                value={formState.grade}
                onChange={handleInputChange("grade")}
                disabled={createMutation.isPending}
              >
                {GRADE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="packages-form-row">
              <label htmlFor="package-publisher">出版社</label>
              <select
                id="package-publisher"
                value={formState.publisher}
                onChange={handleInputChange("publisher")}
                disabled={createMutation.isPending}
              >
                {PUBLISHER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="packages-form-row">
              <label htmlFor="package-semester">学期</label>
              <select
                id="package-semester"
                value={formState.semester}
                onChange={handleInputChange("semester")}
                disabled={createMutation.isPending}
              >
                {SEMESTER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="packages-form-row">
            <label htmlFor="package-topic">主题 *</label>
            <input
              id="package-topic"
              value={formState.topic}
              onChange={handleInputChange("topic")}
              placeholder="例如：英语 / 词汇练习"
              disabled={createMutation.isPending}
            />
          </div>
          <div className="packages-form-row">
            <label htmlFor="package-description">描述</label>
            <textarea
              id="package-description"
              value={formState.description}
              onChange={handleInputChange("description")}
              rows={3}
              placeholder="补充背景信息：目标学员、偏好风格、想覆盖的知识点等"
              disabled={createMutation.isPending}
            />
            <span className="packages-form-hint">
              提交后可在详情页上传 PDF / 图片素材，触发 AI 自动生成关卡。
            </span>
          </div>
          {formError && <div className="packages-form-error">{formError}</div>}
          <div className="packages-form-actions">
            <button
              type="button"
              className="packages-create"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "创建中..." : "创建课程包"}
            </button>
            <button
              type="button"
              className="packages-create outline"
              onClick={() => {
                if (createMutation.isPending) return;
                setShowForm(false);
                setFormError(null);
              }}
            >
              关闭
            </button>
          </div>
        </section>
      )}

      {selectedIds.size > 0 && (
        <section className="packages-batch-toolbar">
          <div className="packages-batch-info">
            已选择 {selectedIds.size} 个课程包
          </div>
          <div className="packages-batch-actions">
            <button
              className="packages-batch-delete"
              onClick={handleBatchDeleteClick}
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? '删除中...' : '批量删除'}
            </button>
            <button
              className="packages-batch-cancel"
              onClick={() => setSelectedIds(new Set())}
              disabled={batchDeleteMutation.isPending}
            >
              取消选择
            </button>
          </div>
        </section>
      )}

      {/* 筛选栏 */}
      <section className="packages-filters">
        <div className="packages-filter-group">
          <label>年级：</label>
          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
            <option value="">全部年级</option>
            {availableGrades.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
        <div className="packages-filter-group">
          <label>出版社：</label>
          <select value={filterPublisher} onChange={(e) => setFilterPublisher(e.target.value)}>
            <option value="">全部出版社</option>
            {availablePublishers.map(publisher => (
              <option key={publisher} value={publisher}>{publisher}</option>
            ))}
          </select>
        </div>
        <div className="packages-filter-group">
          <label>状态：</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        {(filterGrade || filterPublisher || filterStatus) && (
          <button
            type="button"
            className="packages-filter-clear"
            onClick={() => {
              setFilterGrade("");
              setFilterPublisher("");
              setFilterStatus("");
            }}
          >
            清除筛选
          </button>
        )}
        <span className="packages-filter-count">
          共 {filteredItems.length} 个课程包
        </span>
      </section>

      <section>
        {isLoading ? (
          <div className="packages-hint">正在加载课程包...</div>
        ) : error ? (
          <div className="packages-error">加载失败：{(error as Error).message}</div>
        ) : (
          <table className="packages-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredItems.filter(item => item.status !== 'published').length > 0 && selectedIds.size === filteredItems.filter(item => item.status !== 'published').length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    ref={el => {
                      if (el) {
                        const draftCount = filteredItems.filter(item => item.status !== 'published').length;
                        el.indeterminate = selectedIds.size > 0 && selectedIds.size < draftCount;
                      }
                    }}
                  />
                </th>
                <th>课程包名称</th>
                <th>年级</th>
                <th>出版社</th>
                <th>状态</th>
                <th>关卡数量</th>
                <th>最后更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className={selectedIds.has(item.id) ? 'packages-selected-row' : ''}>
                  <td>
                    {item.status !== 'published' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      />
                    )}
                  </td>
                  <td>
                    <div className="packages-title-cell">
                      <span className="packages-title">{item.title}</span>
                      {item.semester && <span className="packages-semester-badge">{item.semester}</span>}
                    </div>
                  </td>
                  <td>{item.grade || '-'}</td>
                  <td>{item.publisher || '-'}</td>
                  <td>
                    <span className={`packages-status ${statusClassMap[item.status] ?? "draft"}`}>
                      {statusTextMap[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>{item.lessonCount}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <Link to={`/packages/${item.id}`} className="packages-link">
                      查看详情
                    </Link>
                    <span className="packages-link-separator">|</span>
                    {deleteConfirmId === item.id ? (
                      <span className="packages-delete-confirm">
                        确认删除？
                        <button
                          className="packages-delete-yes"
                          onClick={() => handleDeleteConfirm(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          是
                        </button>
                        <button
                          className="packages-delete-no"
                          onClick={handleDeleteCancel}
                          disabled={deleteMutation.isPending}
                        >
                          否
                        </button>
                      </span>
                    ) : (
                      <button
                        className="packages-delete"
                        onClick={() => handleDeleteClick(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showBatchDeleteConfirm && (
        <div className="packages-batch-delete-modal">
          <div className="packages-batch-delete-dialog">
            <h3>批量删除确认</h3>
            <p>
              确定要删除选中的 {selectedIds.size} 个课程包吗？
              <br />
              <small>注意：删除操作不可恢复，请谨慎操作</small>
            </p>
            <div className="packages-batch-delete-actions">
              <button
                className="packages-batch-delete-confirm"
                onClick={handleBatchDeleteConfirm}
                disabled={batchDeleteMutation.isPending}
              >
                {batchDeleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
              <button
                className="packages-batch-delete-cancel"
                onClick={handleBatchDeleteCancel}
                disabled={batchDeleteMutation.isPending}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
