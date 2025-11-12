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
    description: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      createCoursePackage({
        title: formState.title.trim(),
        topic: formState.topic.trim(),
        description: formState.description.trim() || undefined
      }),
    onSuccess: () => {
      setShowForm(false);
      setFormState({ title: "", topic: "", description: "" });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["course-packages"] }).catch(() => {
        /* ignore */
      });
    },
    onError: failure => {
      setFormError((failure as Error).message);
    }
  });

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
      } else if (error.message.includes('已发布的课程包不能删除')) {
        errorMessage = '已发布的课程包不能删除，请先取消发布状态';
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
    (key: "title" | "topic" | "description") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const draftIds = items.filter(item => item.status !== 'published').map(item => item.id);
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
              placeholder="例如：旅行口语入门"
              disabled={createMutation.isPending}
            />
          </div>
          <div className="packages-form-row">
            <label htmlFor="package-topic">主题 *</label>
            <input
              id="package-topic"
              value={formState.topic}
              onChange={handleInputChange("topic")}
              placeholder="例如：Travel / 旅行"
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
                    checked={items.filter(item => item.status !== 'published').length > 0 && selectedIds.size === items.filter(item => item.status !== 'published').length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    ref={el => {
                      if (el) {
                        const draftCount = items.filter(item => item.status !== 'published').length;
                        el.indeterminate = selectedIds.size > 0 && selectedIds.size < draftCount;
                      }
                    }}
                  />
                </th>
                <th>课程包名称</th>
                <th>主题</th>
                <th>状态</th>
                <th>关卡数量</th>
                <th>版本数量</th>
                <th>最后更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
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
                  <td>{item.title}</td>
                  <td>{item.topic}</td>
                  <td>
                    <span className={`packages-status ${statusClassMap[item.status] ?? "draft"}`}>
                      {statusTextMap[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>{item.lessonCount}</td>
                  <td>{item.versionCount}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <Link to={`/packages/${item.id}`} className="packages-link">
                      查看详情
                    </Link>
                    {item.status !== 'published' && (
                      <>
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
                      </>
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
              <small>注意：已发布的课程包不会被删除</small>
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
