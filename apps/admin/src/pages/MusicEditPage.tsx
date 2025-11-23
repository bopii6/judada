import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { MusicTrackDetail, MusicTrackStatus } from "@judada/shared";
import { fetchMusicTrackDetail, updateMusicTrack, parseLrcFile } from "../api/musicTracks";
import { MusicSegmentEditor } from "../components/MusicSegmentEditor";

const statusTextMap: Record<MusicTrackStatus, string> = {
  draft: "草稿",
  processing: "处理中",
  published: "已上架",
  archived: "已归档"
};

interface EditorState {
  title: string;
  titleCn: string;
  artist: string;
  status: MusicTrackStatus;
  description: string;
  coverUrl: string;
  phrasesText: string;
}

const convertMsToSeconds = (phrases: MusicTrackDetail["phrases"]) => {
  return (phrases ?? []).map(phrase => ({
    ...phrase,
    start: phrase.start / 1000,
    end: phrase.end / 1000,
    // 将数据库的 zh 字段映射为 cn 字段给前端使用
    cn: phrase.zh,
    zh: undefined // 移除原有的 zh 字段
  }));
};

const convertSecondsToMs = (phrases: any[]) => {
  return phrases.map(phrase => ({
    ...phrase,
    start: phrase.start * 1000,
    end: phrase.end * 1000,
    // 将前端的 cn 字段映射回数据库的 zh 字段
    zh: phrase.cn,
    cn: undefined // 移除原有的 cn 字段
  }));
};

const buildEditorState = (track: MusicTrackDetail): EditorState => ({
  title: track.title,
  titleCn: track.titleCn ?? "",
  artist: track.artist ?? "",
  status: track.status,
  description: track.description ?? "",
  coverUrl: track.coverUrl ?? "",
  phrasesText: JSON.stringify(convertMsToSeconds(track.phrases), null, 2)
});

export const MusicEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [lrcUploadLoading, setLrcUploadLoading] = useState(false);
  const [lrcUploadError, setLrcUploadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lrcFileInputRef = useRef<HTMLInputElement>(null);

  const { data: track, isFetching, error } = useQuery({
    queryKey: ["music-track", id],
    queryFn: () => fetchMusicTrackDetail(id!),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (track) {
      setEditorState(buildEditorState(track));
      setEditorError(null);
    } else {
      setEditorState(null);
    }
  }, [track]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateMusicTrack>[1]) => updateMusicTrack(id!, payload),
    onSuccess: () => {
      setEditorError(null);
      setSuccessMessage("保存成功！已更新配置");
      setTimeout(() => setSuccessMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ["music-track", id] }).catch(() => {
        /* ignore */
      });
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] }).catch(() => {
        /* ignore */
      });
    },
    onError: failure => {
      setEditorError((failure as Error).message);
      setSuccessMessage(null);
    }
  });

  const handleSaveDetail = () => {
    if (!editorState || !id) return;
    try {
      const parsedPhrases = editorState.phrasesText.trim()
        ? JSON.parse(editorState.phrasesText)
        : [];
      if (!Array.isArray(parsedPhrases)) {
        throw new Error("歌词片段需要是数组");
      }

      // Convert seconds back to milliseconds for storage
      const phrasesInMs = convertSecondsToMs(parsedPhrases);

      updateMutation.mutate({
        title: editorState.title.trim(),
        titleCn: editorState.titleCn.trim() || null,
        artist: editorState.artist.trim() || null,
        description: editorState.description.trim() || null,
        coverUrl: editorState.coverUrl.trim() || null,
        status: editorState.status,
        phrases: phrasesInMs
      });
    } catch (failure) {
      setEditorError((failure as Error).message);
    }
  };

  const handleLrcUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLrcUploadLoading(true);
    setLrcUploadError(null);

    try {
      const result = await parseLrcFile(file);

      if (result.success && result.phrases) {
        // 将LRC解析结果转换为MusicSegmentEditor需要的格式
        const convertedPhrases = result.phrases.map(phrase => ({
          start: phrase.start,
          end: phrase.end,
          en: phrase.english || '',
          cn: phrase.chinese || ''
        }));

        // 更新编辑器的歌词片段
        setEditorState(prev => prev && {
          ...prev,
          phrasesText: JSON.stringify(convertedPhrases, null, 2)
        });

        setSuccessMessage(`成功导入 ${result.total} 个歌词片段！`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error('解析失败');
      }
    } catch (error) {
      setLrcUploadError((error as Error).message || 'LRC文件解析失败，请检查文件格式');
    } finally {
      setLrcUploadLoading(false);
      // 清空文件输入
      if (lrcFileInputRef.current) {
        lrcFileInputRef.current.value = '';
      }
    }
  };

  if (!id) {
    return <div>无效的曲目ID</div>;
  }

  if (isFetching) {
    return <div className="loading">正在加载曲目信息...</div>;
  }

  if (error) {
    return <div className="error">加载失败：{(error as Error).message}</div>;
  }

  if (!track) {
    return <div className="error">曲目不存在</div>;
  }

  return (
    <div className="music-edit-page">
      <div className="page-header">
        <div className="header-content">
          <button
            className="back-btn"
            onClick={() => navigate("/music")}
          >
            ← 返回列表
          </button>
          <h1>编辑曲目配置</h1>
        </div>
        <div className="header-info">
          <span className="track-title">{track.title}</span>
          {track.audioUrl && (
            <audio ref={audioRef} className="audio-player" controls src={track.audioUrl}>
              浏览器不支持音频播放
            </audio>
          )}
        </div>
      </div>

      <div className="edit-form-container">
        {!editorState ? (
          <div className="loading">正在加载编辑器...</div>
        ) : (
          <div className="edit-form">
            {/* 基本信息 */}
            <div className="form-section">
              <h3>基本信息</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>英文标题</label>
                  <input
                    type="text"
                    value={editorState.title}
                    onChange={event => setEditorState(prev => prev && { ...prev, title: event.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>中文标题</label>
                  <input
                    type="text"
                    value={editorState.titleCn}
                    placeholder="玩家卡片下方展示，用于翻译"
                    onChange={event => setEditorState(prev => prev && { ...prev, titleCn: event.target.value })}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>演唱者（可选）</label>
                <input
                  type="text"
                  value={editorState.artist}
                  onChange={event => setEditorState(prev => prev && { ...prev, artist: event.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label>封面 URL</label>
                  <input
                    type="text"
                    value={editorState.coverUrl}
                    onChange={event => setEditorState(prev => prev && { ...prev, coverUrl: event.target.value })}
                    placeholder="可选，用于前台展示"
                  />
                </div>
                <div className="form-field">
                  <label>状态</label>
                  <select
                    value={editorState.status}
                    onChange={event => setEditorState(prev => prev && { ...prev, status: event.target.value as MusicTrackStatus })}
                  >
                    {(Object.keys(statusTextMap) as MusicTrackStatus[]).map(status => (
                      <option key={status} value={status}>
                        {statusTextMap[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>简介 / 备注</label>
                <textarea
                  rows={3}
                  value={editorState.description}
                  onChange={event => setEditorState(prev => prev && { ...prev, description: event.target.value })}
                  placeholder="可选，对闯关内容的补充说明"
                />
              </div>
            </div>

            {/* 歌词片段 */}
            <div className="form-section">
              <h3>歌词片段配置</h3>
              <div className="editor-header">
                <span>配置歌词片段的时间点和内容</span>
                <div className="editor-actions">
                  <div className="view-toggle">
                    <button
                      type="button"
                      className={viewMode === 'visual' ? 'active' : ''}
                      onClick={() => setViewMode('visual')}
                    >
                      可视化编辑
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'json' ? 'active' : ''}
                      onClick={() => setViewMode('json')}
                    >
                      JSON 编辑
                    </button>
                  </div>

                  {/* LRC文件上传 */}
                  <div className="lrc-upload">
                    <input
                      ref={lrcFileInputRef}
                      type="file"
                      accept=".lrc,.txt"
                      onChange={handleLrcUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="lrc-upload-btn"
                      onClick={() => lrcFileInputRef.current?.click()}
                      disabled={lrcUploadLoading}
                    >
                      {lrcUploadLoading ? "解析中..." : "📄 上传LRC歌词"}
                    </button>
                  </div>
                </div>
              </div>

              {/* LRC上传错误提示 */}
              {lrcUploadError && (
                <div className="lrc-error-message">
                  {lrcUploadError}
                </div>
              )}

              {viewMode === 'visual' ? (
                <MusicSegmentEditor
                  audioRef={audioRef}
                  phrases={(() => {
                    try {
                      return JSON.parse(editorState.phrasesText || '[]');
                    } catch {
                      return [];
                    }
                  })()}
                  onChange={(newPhrases) => {
                    setEditorState(prev => prev && {
                      ...prev,
                      phrasesText: JSON.stringify(newPhrases, null, 2)
                    });
                  }}
                />
              ) : (
                <>
                  <small className="json-hint">
                    每条包含 start/end 时间（秒）、英文歌词、中文提示
                  </small>
                  <textarea
                    className="json-textarea"
                    rows={12}
                    value={editorState.phrasesText}
                    onChange={event => setEditorState(prev => prev && { ...prev, phrasesText: event.target.value })}
                  />
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="form-actions">
              {editorError && <div className="error-message">{editorError}</div>}
              {successMessage && <div className="success-message">{successMessage}</div>}

              <div className="action-buttons">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => navigate("/music")}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSaveDetail}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "保存中..." : "保存配置"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .music-edit-page {
          padding: 24px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .back-btn {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .back-btn:hover {
          background: #f3f4f6;
        }

        .page-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .track-title {
          font-size: 16px;
          font-weight: 500;
          color: #374151;
        }

        .audio-player {
          height: 32px;
        }

        .edit-form-container {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          padding: 24px;
        }

        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .form-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-field label {
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .form-field input,
        .form-field textarea,
        .form-field select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-field input:focus,
        .form-field textarea:focus,
        .form-field select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-field textarea {
          resize: vertical;
          min-height: 80px;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .editor-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .view-toggle {
          display: flex;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }

        .lrc-upload {
          display: flex;
          align-items: center;
        }

        .lrc-upload-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .lrc-upload-btn:hover:not(:disabled) {
          background: #059669;
        }

        .lrc-upload-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .lrc-error-message {
          padding: 8px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .view-toggle button {
          padding: 6px 12px;
          border: none;
          background: #f9fafb;
          color: #6b7280;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .view-toggle button.active {
          background: #3b82f6;
          color: white;
        }

        .json-hint {
          display: block;
          margin-bottom: 8px;
          color: #6b7280;
          font-size: 12px;
        }

        .json-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.5;
          resize: vertical;
        }

        .error-message {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .success-message {
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          color: #166534;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-btn, .save-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .cancel-btn {
          background: #f3f4f6;
          color: #374151;
        }

        .cancel-btn:hover {
          background: #e5e7eb;
        }

        .save-btn {
          background: #3b82f6;
          color: white;
        }

        .save-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .save-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .loading, .error {
          padding: 24px;
          text-align: center;
          color: #6b7280;
        }

        .error {
          color: #dc2626;
        }

        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .editor-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .editor-actions {
            flex-direction: column;
            width: 100%;
            gap: 8px;
          }

          .view-toggle,
          .lrc-upload {
            width: 100%;
          }

          .view-toggle button,
          .lrc-upload-btn {
            flex: 1;
            justify-content: center;
          }

          .header-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .cancel-btn, .save-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
