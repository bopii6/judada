import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { uploadMusicTrack, type UploadMusicTrackPayload } from "../api/musicTracks";

const initialUploadForm = {
  file: null as File | null,
  title: "",
  artist: "",
  description: ""
};

export const MusicUploadPage = () => {
  const navigate = useNavigate();
  const [uploadForm, setUploadForm] = useState(initialUploadForm);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (payload: UploadMusicTrackPayload) => uploadMusicTrack(payload),
    onSuccess: () => {
      setUploadForm(initialUploadForm);
      setUploadError(null);
      navigate("/music");
    },
    onError: failure => {
      setUploadError((failure as Error).message);
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
      artist: uploadForm.artist.trim() || undefined,
      description: uploadForm.description.trim() || undefined
    });
  };

  return (
    <div className="music-upload-page">
      <div className="page-header">
        <h1>上传音乐曲目</h1>
        <p>上传音频文件后，系统会自动进行语音识别并生成歌词片段</p>
      </div>

      <div className="upload-form-container">
        <form className="upload-form" onSubmit={handleUploadSubmit}>
          <div className="form-section">
            <h3>音频文件</h3>
            <div className="file-upload">
              <label className="file-input-label">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null;
                    setUploadForm(prev => ({ ...prev, file }));
                  }}
                />
                <div className="file-input-content">
                  {uploadForm.file ? (
                    <div className="selected-file">
                      <span className="file-name">{uploadForm.file.name}</span>
                      <span className="file-size">
                        {Math.round(uploadForm.file.size / 1024 / 1024 * 100) / 100} MB
                      </span>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <span>选择音频文件</span>
                      <small>支持 MP3 / WAV 格式，最大 30MB</small>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>基本信息</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>歌曲标题 *</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={event => setUploadForm(prev => ({ ...prev, title: event.target.value }))}
                  placeholder="请输入歌曲标题"
                  required
                />
              </div>
              <div className="form-field">
                <label>演唱者</label>
                <input
                  type="text"
                  value={uploadForm.artist}
                  onChange={event => setUploadForm(prev => ({ ...prev, artist: event.target.value }))}
                  placeholder="请输入演唱者名称"
                />
              </div>
            </div>
            <div className="form-field">
              <label>备注说明</label>
              <textarea
                rows={3}
                value={uploadForm.description}
                onChange={event => setUploadForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="对该曲目的说明，例如适合年龄段、难度等信息"
              />
            </div>
          </div>

          {uploadError && (
            <div className="error-message">
              {uploadError}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate("/music")}
            >
              取消
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={uploadMutation.isPending || !uploadForm.file}
            >
              {uploadMutation.isPending ? "上传中..." : "开始上传"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .music-upload-page {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-header {
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

        .upload-form-container {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          padding: 24px;
        }

        .upload-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .form-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }

        .file-upload {
          margin-bottom: 8px;
        }

        .file-input-label {
          display: block;
          cursor: pointer;
        }

        .file-input-label input[type="file"] {
          display: none;
        }

        .file-input-content {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 32px;
          text-align: center;
          background: #f9fafb;
          transition: all 0.2s;
        }

        .file-input-label:hover .file-input-content {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .selected-file {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #374151;
        }

        .file-name {
          font-weight: 500;
        }

        .file-size {
          font-size: 14px;
          color: #6b7280;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #6b7280;
        }

        .upload-placeholder span {
          font-weight: 500;
        }

        .upload-placeholder small {
          font-size: 14px;
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
        .form-field textarea {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-field input:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-field textarea {
          resize: vertical;
          min-height: 80px;
        }

        .error-message {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 14px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-btn, .submit-btn {
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

        .submit-btn {
          background: #3b82f6;
          color: white;
        }

        .submit-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .submit-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .cancel-btn, .submit-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
