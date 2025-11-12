import { useQuery } from "@tanstack/react-query";
import { fetchGenerationJobs, GenerationJob } from "../api/coursePackages";
import "./GenerationJobsPage.css";

const statusLabel: Record<GenerationJob["status"], string> = {
  queued: "排队中",
  processing: "处理中",
  succeeded: "成功",
  failed: "失败",
  canceled: "已取消"
};

const formatProgress = (progress: number | null) => (progress == null ? "—" : `${progress}%`);

export const GenerationJobsPage = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["generation-jobs"],
    queryFn: fetchGenerationJobs,
    refetchInterval: 10_000
  });

  const jobs = data?.jobs ?? [];

  return (
    <div className="jobs">
      <header className="jobs-header">
        <div>
          <h1>生成任务监控</h1>
          <p>自动生成流程（PDF、图片 OCR、AI 输出）会在这里展示进度与结果。</p>
        </div>
        <div className="jobs-actions">
          <button type="button" onClick={() => refetch()}>
            刷新
          </button>
        </div>
      </header>
      <section className="jobs-table-wrapper">
        {isLoading ? (
          <div className="jobs-hint">正在读取任务列表...</div>
        ) : error ? (
          <div className="jobs-error">加载失败：{(error as Error).message}</div>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>任务编号</th>
                <th>当前状态</th>
                <th>进度</th>
                <th>所属课程包</th>
                <th>触发时间</th>
                <th>完成时间</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>
                    <span className={`jobs-status status-${job.status}`}>{statusLabel[job.status]}</span>
                  </td>
                  <td>{formatProgress(job.progress)}</td>
                  <td>{job.package?.title ?? "—"}</td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>{job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

