import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CoursePackageListItem,
  createCoursePackage,
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

  return (
    <div className="packages">
      <header className="packages-header">
        <div>
          <h1>课程包管理</h1>
          <p>这里列出所有课程包，后续的自动生成、审核、发布都会在此操作。</p>
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

      <section>
        {isLoading ? (
          <div className="packages-hint">正在加载课程包...</div>
        ) : error ? (
          <div className="packages-error">加载失败：{(error as Error).message}</div>
        ) : (
          <table className="packages-table">
            <thead>
              <tr>
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
                <tr key={item.id}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
