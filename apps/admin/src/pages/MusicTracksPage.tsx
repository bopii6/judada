import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicTrackDetail, MusicTrackStatus, MusicTrackSummary } from "@judada/shared";
import {
  fetchMusicTracks,
  fetchMusicTrackDetail,
  uploadMusicTrack,
  updateMusicTrack,
  type UploadMusicTrackPayload,
  type UpdateMusicTrackPayload
} from "../api/musicTracks";
import { MusicSegmentEditor } from "../components/MusicSegmentEditor";
import "./MusicTracksPage.css";

const statusTextMap: Record<MusicTrackStatus, string> = {
  draft: "草稿",
  processing: "处理中",
  published: "已上架",
  archived: "已归档"
};

const statusClassMap: Record<MusicTrackStatus, string> = {
  draft: "draft",
  processing: "pending",
  published: "published",
  archived: "archived"
};

const initialUploadForm = {
  file: null as File | null,
  title: "",
  titleCn: "",
  artist: "",
  description: ""
};

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return "--";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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

const buildEditorState = (track: MusicTrackDetail): EditorState => ({
  title: track.title,
  titleCn: track.titleCn ?? "",
  artist: track.artist ?? "",
  status: track.status,
  description: track.description ?? "",
  coverUrl: track.coverUrl ?? "",
  phrasesText: JSON.stringify(track.phrases ?? [], null, 2)
});

export const MusicTracksPage = () => {
  const queryClient = useQueryClient();
  const { data: tracks = [], isLoading, error } = useQuery<MusicTrackSummary[]>({
    queryKey: ["music-tracks"],
    queryFn: fetchMusicTracks
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState(initialUploadForm);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!selectedId && tracks.length > 0) {
      setSelectedId(tracks[0].id);
    }
  }, [tracks, selectedId]);

  const { data: selectedTrack, isFetching: isDetailLoading } = useQuery({
    queryKey: ["music-track", selectedId],
    queryFn: () => fetchMusicTrackDetail(selectedId!),
    enabled: Boolean(selectedId)
  });

  useEffect(() => {
    if (selectedTrack) {
      setEditorState(buildEditorState(selectedTrack));
      setEditorError(null);
    } else {
      setEditorState(null);
    }
  }, [selectedTrack]);

  const uploadMutation = useMutation({
    mutationFn: (payload: UploadMusicTrackPayload) => uploadMusicTrack(payload),
    onSuccess: track => {
      setUploadForm(initialUploadForm);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] }).catch(() => {
        /* ignore */
      });
      queryClient.setQueryData(["music-track", track.id], track);
      setSelectedId(track.id);
    },
    onError: failure => {
      setUploadError((failure as Error).message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; payload: UpdateMusicTrackPayload }) => updateMusicTrack(input.id, input.payload),
    onSuccess: track => {
      setEditorError(null);
      setSuccessMessage("保存成功！已更新配置");
      setTimeout(() => setSuccessMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] }).catch(() => {
        /* ignore */
      });
      queryClient.setQueryData(["music-track", track.id], track);
    },
    onError: failure => {
      setEditorError((failure as Error).message);
      setSuccessMessage(null);
    }
  });

  const handleUploadSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!uploadForm.file) {
      setUploadError("请先选择要上传的 MP3 文件");
      return;
    }

    uploadMutation.mutate({
      file: uploadForm.file,
      title: uploadForm.title.trim() || undefined,
      titleCn: uploadForm.titleCn.trim() || undefined,
      artist: uploadForm.artist.trim() || undefined,
      description: uploadForm.description.trim() || undefined
    });
  };

  const handleSaveDetail = () => {
    if (!editorState || !selectedId) return;
    try {
      const parsedPhrases = editorState.phrasesText.trim()
        ? (JSON.parse(editorState.phrasesText) as MusicTrackDetail["phrases"])
        : [];
      if (!Array.isArray(parsedPhrases)) {
        throw new Error("歌词片段需要是数组");
      }

      updateMutation.mutate({
        id: selectedId,
        payload: {
          title: editorState.title.trim(),
          titleCn: editorState.titleCn.trim() || null,
          artist: editorState.artist.trim() || null,
          description: editorState.description.trim() || null,
          coverUrl: editorState.coverUrl.trim() || null,
          status: editorState.status,
          phrases: parsedPhrases
        }
      });
    } catch (failure) {
      setEditorError((failure as Error).message);
    }
  };

  const tracksList = useMemo(() => tracks, [tracks]);

  return (
    <div className="music-page">
      <header className="music-header">
        <div>
          <p className="music-breadcrumb">内容中心 / 音乐闯关</p>
          <h1>音乐包管理</h1>
          <p className="music-subtitle">上传儿歌或歌曲音频，编辑歌词片段后即可在前台闯关中动态出现</p>
        </div>
      </header>

      <section className="music-layout">
        <div className="music-column">
          <div className="music-card">
            <div className="music-card-header">
              <div>
                <h2>音频上传</h2>
                <p>系统会自动读取时长和基础标签，支持 MP3 / WAV</p>
              </div>
            </div>
            <form className="music-upload-form" onSubmit={handleUploadSubmit}>
              <label className="music-field">
                <span>选择音频</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null;
                    setUploadForm(prev => ({ ...prev, file }));
                  }}
                />
              </label>
              <div className="music-grid">
                <label className="music-field">
                  <span>英文标题</span>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={event => setUploadForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="若留空则使用音频标签"
                  />
                </label>
                <label className="music-field">
                  <span>中文标题</span>
                  <input
                    type="text"
                    value={uploadForm.titleCn}
                    onChange={event => setUploadForm(prev => ({ ...prev, titleCn: event.target.value }))}
                    placeholder="展示在卡片副标题，可选"
                  />
                </label>
              </div>
              <label className="music-field">
                <span>演唱者（可选）</span>
                <input
                  type="text"
                  value={uploadForm.artist}
                  onChange={event => setUploadForm(prev => ({ ...prev, artist: event.target.value }))}
                  placeholder="内部参考使用"
                />
              </label>
              <label className="music-field">
                <span>备注</span>
                <input
                  type="text"
                  value={uploadForm.description}
                  onChange={event => setUploadForm(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="对该曲目的说明"
                />
              </label>
              {uploadError && <p className="music-error">{uploadError}</p>}
              <button type="submit" className="music-primary-btn" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? "上传中..." : "上传音频"}
              </button>
            </form>
          </div>

          <div className="music-card">
            <div className="music-card-header">
              <div>
                <h2>曲目列表</h2>
                <p>选中后即可右侧编辑详情</p>
              </div>
              <span className="music-count-badge">{tracksList.length} 首</span>
            </div>
            {isLoading ? (
              <p className="music-hint">正在加载音频...</p>
            ) : error ? (
              <p className="music-error">加载失败：{(error as Error).message}</p>
            ) : tracksList.length === 0 ? (
              <p className="music-hint">暂未上传任何音乐，先在上方完成一次上传吧。</p>
            ) : (
              <div className="music-table-container">
                <table className="music-table">
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>演唱者</th>
                      <th>时长</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracksList.map(track => (
                      <tr
                        key={track.id}
                        className={selectedId === track.id ? "selected" : ""}
                        onClick={() => setSelectedId(track.id)}
                      >
                        <td>
                          <div className="music-title-cell">
                            <span>{track.title}</span>
                            <small>{track.slug}</small>
                          </div>
                        </td>
                        <td>{track.artist ?? "--"}</td>
                        <td>{formatDuration(track.durationMs)}</td>
                        <td>
                          <span className={`music-status ${statusClassMap[track.status]}`}>
                            {statusTextMap[track.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="music-column">
          <div className="music-card">
            <div className="music-card-header">
              <div>
                <h2>歌词与关卡配置</h2>
                <p>填写英文歌词和中文提示，发布后前台即会解锁闯关</p>
              </div>
            </div>

            {!selectedId || !editorState ? (
              <p className="music-hint">请选择左侧的曲目以进行编辑。</p>
            ) : isDetailLoading ? (
              <p className="music-hint">正在加载曲目信息...</p>
            ) : (
              <>
                <div className="music-grid">
                  <label className="music-field">
                    <span>英文标题</span>
                    <input
                      type="text"
                      value={editorState.title}
                      onChange={event => setEditorState(prev => prev && { ...prev, title: event.target.value })}
                    />
                  </label>
                  <label className="music-field">
                    <span>中文标题</span>
                    <input
                      type="text"
                      value={editorState.titleCn}
                      onChange={event => setEditorState(prev => prev && { ...prev, titleCn: event.target.value })}
                      placeholder="用于展示翻译"
                    />
                  </label>
                </div>

                <label className="music-field">
                  <span>演唱者（可选）</span>
                  <input
                    type="text"
                    value={editorState.artist}
                    onChange={event => setEditorState(prev => prev && { ...prev, artist: event.target.value })}
                  />
                </label>

                <div className="music-grid">
                  <label className="music-field">
                    <span>封面 URL</span>
                    <input
                      type="text"
                      value={editorState.coverUrl}
                      onChange={event => setEditorState(prev => prev && { ...prev, coverUrl: event.target.value })}
                      placeholder="可选，用于前台展示"
                    />
                  </label>
                  <label className="music-field">
                    <span>状态</span>
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
                  </label>
                </div>

                <label className="music-field">
                  <span>简介 / 备注</span>
                  <textarea
                    rows={3}
                    value={editorState.description}
                    onChange={event => setEditorState(prev => prev && { ...prev, description: event.target.value })}
                    placeholder="可选，对闯关内容的补充说明"
                  />
                </label>

                {selectedTrack?.audioUrl && (
                  <audio ref={audioRef} className="music-audio" controls src={selectedTrack.audioUrl}>
                    浏览器不支持音频播放
                  </audio>
                )}

                <div className="music-field">
                  <div className="music-field-label">
                    <span>歌词片段</span>
                    <div className="view-toggle">
                      <button
                        type="button"
                        className={viewMode === 'visual' ? 'active' : ''}
                        onClick={() => setViewMode('visual')}
                      >
                        可视化
                      </button>
                      <button
                        type="button"
                        className={viewMode === 'json' ? 'active' : ''}
                        onClick={() => setViewMode('json')}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

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
                      <small style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>
                        每条包含 start/end 时间（毫秒）、英文、中文提示
                      </small>
                      <textarea
                        className="music-json-textarea"
                        rows={12}
                        value={editorState.phrasesText}
                        onChange={event => setEditorState(prev => prev && { ...prev, phrasesText: event.target.value })}
                      />
                    </>
                  )}
                </div>

  
                {editorError && <p className="music-error">{editorError}</p>}
                {successMessage && <p className="music-success" style={{ color: '#166534', marginTop: '4px', fontSize: '14px' }}>{successMessage}</p>}

                <div className="music-actions">
                  <button
                    type="button"
                    className="music-primary-btn"
                    onClick={handleSaveDetail}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "保存中..." : "保存配置"}
                  </button>
                  <p className="music-hint">将状态切换为「已上架」即可让玩家在前台看到该歌曲</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
