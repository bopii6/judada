import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { MusicTrackSummary, MusicTrackStatus } from "@judada/shared";
import { fetchMusicTracks, updateMusicTrack, deleteMusicTrack } from "../api/musicTracks";

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return "--";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const MusicListPage = () => {
  const queryClient = useQueryClient();
  const { data: tracks = [], isLoading, error } = useQuery<MusicTrackSummary[]>({
    queryKey: ["music-tracks"],
    queryFn: fetchMusicTracks
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMusicTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] }).catch(() => {
        /* ignore */
      });
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MusicTrackStatus }) => {
      return updateMusicTrack(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] }).catch(() => {
        /* ignore */
      });
    }
  });

  const handleDeleteTrack = async (id: string) => {
    if (confirm("确定要删除这首曲目吗？此操作不可撤销。")) {
      deleteMutation.mutate(id);
    }
  };

  const handleChangeStatus = async (id: string, status: MusicTrackStatus) => {
    statusMutation.mutate({ id, status });
  };

  if (isLoading) return <div className="loading">正在加载...</div>;
  if (error) return <div className="error">加载失败：{(error as Error).message}</div>;

  const draftTracks = tracks.filter(track => track.status === "draft");
  const publishedTracks = tracks.filter(track => track.status === "published");

  return (
    <div className="music-list-page">
      <div className="page-header">
        <div>
          <h1>音乐曲目管理</h1>
          <p>管理上传的音乐曲目，支持编辑歌词片段和关卡配置</p>
        </div>
        <Link to="/music/upload" className="primary-btn">
          上传新曲目
        </Link>
      </div>

      <div className="tracks-sections">
        {/* 草稿曲目 */}
        <div className="tracks-section">
          <div className="section-header">
            <h2>草稿曲目 ({draftTracks.length})</h2>
            <p>正在编辑中的曲目，未发布到前台</p>
          </div>

          {draftTracks.length === 0 ? (
            <div className="empty-state">
              <p>暂无草稿曲目</p>
              <Link to="/music/upload" className="secondary-btn">上传第一首曲目</Link>
            </div>
          ) : (
            <div className="tracks-table-container">
              <table className="tracks-table">
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>演唱者</th>
                    <th>时长</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {draftTracks.map(track => (
                    <tr key={track.id}>
                      <td>
                        <div className="track-title">
                          <span>{track.title}</span>
                          {track.titleCn && <span className="track-subtitle">{track.titleCn}</span>}
                          <small>{track.slug}</small>
                        </div>
                      </td>
                      <td>{track.artist ?? "--"}</td>
                      <td>{formatDuration(track.durationMs)}</td>
                      <td>
                        <div className="track-actions">
                          <Link
                            to={`/music/edit/${track.id}`}
                            className="edit-btn"
                          >
                            编辑
                          </Link>
                          <button
                            onClick={() => handleChangeStatus(track.id, "published")}
                            className="publish-btn"
                          >
                            上架
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(track.id)}
                            className="delete-btn"
                            disabled={deleteMutation.isPending}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 已发布曲目 */}
        <div className="tracks-section">
          <div className="section-header">
            <h2>已上架曲目 ({publishedTracks.length})</h2>
            <p>已发布到前台，玩家可以看到并游玩</p>
          </div>

          {publishedTracks.length === 0 ? (
            <div className="empty-state">
              <p>暂无已上架曲目</p>
            </div>
          ) : (
            <div className="tracks-table-container">
              <table className="tracks-table">
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>演唱者</th>
                    <th>时长</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedTracks.map(track => (
                    <tr key={track.id}>
                      <td>
                        <div className="track-title">
                          <span>{track.title}</span>
                          {track.titleCn && <span className="track-subtitle">{track.titleCn}</span>}
                          <small>{track.slug}</small>
                        </div>
                      </td>
                      <td>{track.artist ?? "--"}</td>
                      <td>{formatDuration(track.durationMs)}</td>
                      <td>
                        <div className="track-actions">
                          <Link
                            to={`/music/edit/${track.id}`}
                            className="edit-btn"
                          >
                            编辑配置
                          </Link>
                          <button
                            onClick={() => handleChangeStatus(track.id, "draft")}
                            className="unpublish-btn"
                          >
                            下架
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .music-list-page {
          padding: 24px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .page-header h1 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
        }

        .page-header p {
          margin: 0;
          color: #6b7280;
        }

        .primary-btn {
          background: #3b82f6;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
        }

        .tracks-sections {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .tracks-section {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }

        .section-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .section-header h2 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .section-header p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
          color: #6b7280;
        }

        .empty-state p {
          margin: 0 0 16px 0;
        }

        .secondary-btn {
          background: #f3f4f6;
          color: #374151;
          padding: 8px 16px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
        }

        .tracks-table-container {
          overflow-x: auto;
        }

        .tracks-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tracks-table th {
          text-align: left;
          padding: 12px 20px;
          font-weight: 600;
          font-size: 14px;
          color: #374151;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .tracks-table td {
          padding: 12px 20px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }

        .track-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .track-title span {
          font-weight: 500;
        }

        .track-title .track-subtitle {
          color: #4b5563;
          font-size: 13px;
          font-weight: 400;
        }

        .track-title small {
          color: #6b7280;
          font-size: 12px;
        }

        .track-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .edit-btn, .publish-btn, .unpublish-btn, .delete-btn {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          text-decoration: none;
          border: none;
          cursor: pointer;
        }

        .edit-btn {
          background: #f3f4f6;
          color: #374151;
        }

        .publish-btn {
          background: #10b981;
          color: white;
        }

        .unpublish-btn {
          background: #f59e0b;
          color: white;
        }

        .delete-btn {
          background: #ef4444;
          color: white;
        }

        .edit-btn:hover {
          background: #e5e7eb;
        }

        .publish-btn:hover {
          background: #059669;
        }

        .unpublish-btn:hover {
          background: #d97706;
        }

        .delete-btn:hover {
          background: #dc2626;
        }
      `}</style>
    </div>
  );
};
