import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "../api/coursePackages";
import "./DashboardPage.css";

const fallbackStats = {
  packagesTotal: 0,
  lessonsTotal: 0,
  pendingReviews: 0,
  activeJobs: 0
};

export const DashboardPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview
  });

  const stats = data?.stats ?? fallbackStats;

  return (
    <div className="dashboard">
      <section className="dashboard-section">
        <h2>今日概览</h2>
        {isLoading ? (
          <p className="dashboard-hint">正在读取数据...</p>
        ) : error ? (
          <p className="dashboard-error">读取统计信息失败：{(error as Error).message}</p>
        ) : (
          <div className="dashboard-cards">
            <div className="dashboard-card">
              <span className="dashboard-card-title">课程包总数</span>
              <span className="dashboard-card-value">{stats.packagesTotal}</span>
              <span className="dashboard-card-desc">包含草稿、待审核、已发布等所有状态。</span>
            </div>
            <div className="dashboard-card">
              <span className="dashboard-card-title">关卡总数</span>
              <span className="dashboard-card-value">{stats.lessonsTotal}</span>
              <span className="dashboard-card-desc">统计所有关卡，方便运营把控整体体量。</span>
            </div>
            <div className="dashboard-card">
              <span className="dashboard-card-title">待审核草稿</span>
              <span className="dashboard-card-value">{stats.pendingReviews}</span>
              <span className="dashboard-card-desc">提醒审核同学尽快处理待办。</span>
            </div>
            <div className="dashboard-card">
              <span className="dashboard-card-title">运行中的生成任务</span>
              <span className="dashboard-card-value">{stats.activeJobs}</span>
              <span className="dashboard-card-desc">自动生成任务超过 0 时，可点击任务面板查看详情。</span>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>下一步建议</h2>
        <ul className="dashboard-list">
          <li>上传 PDF、图片或手动文本后发起自动生成，快速得到课程草稿。</li>
          <li>在任务面板查看生成进度、错误日志，保证每个任务都有结果。</li>
          <li>审核并发布课程包版本，同时可以随时回滚到历史版本以保证安全。</li>
        </ul>
      </section>
    </div>
  );
};

