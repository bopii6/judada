import React, { useState, useEffect } from 'react';

export interface MusicPhrase {
  start: number; // 开始时间（秒）
  end: number;   // 结束时间（秒）
  en: string;
  cn?: string;
}

interface MusicSegmentEditorProps {
  phrases: MusicPhrase[];
  onChange: (phrases: MusicPhrase[]) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export const MusicSegmentEditor: React.FC<MusicSegmentEditorProps> = ({
  phrases,
  onChange,
  audioRef,
}) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // Monitor audio pause to reset playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => setPlayingIndex(null);
    const handleEnded = () => setPlayingIndex(null);

    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef]);

  const handlePlaySegment = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const phrase = phrases[index];
    if (playingIndex === index) {
      audio.pause();
      setPlayingIndex(null);
    } else {
      audio.currentTime = phrase.start;
      audio.play();
      setPlayingIndex(index);

      // Stop at end
      const duration = phrase.end - phrase.start;
      setTimeout(() => {
        if (audioRef.current === audio && !audio.paused && Math.abs(audio.currentTime - phrase.end) < 0.5) {
          audio.pause();
        }
      }, duration * 1000);
    }
  };

  const updatePhrase = (index: number, field: keyof MusicPhrase, value: any) => {
    const newPhrases = [...phrases];
    newPhrases[index] = { ...newPhrases[index], [field]: value };
    onChange(newPhrases);
  };

  const addPhrase = () => {
    const lastPhrase = phrases[phrases.length - 1];
    const newStart = lastPhrase ? lastPhrase.end : 0;
    onChange([
      ...phrases,
      { start: newStart, end: newStart + 2, en: '', cn: '' },
    ]);
  };

  const removePhrase = (index: number) => {
    onChange(phrases.filter((_, i) => i !== index));
  };

  const insertPhrase = (afterIndex: number) => {
    const currentPhrase = phrases[afterIndex];
    const nextPhrase = phrases[afterIndex + 1];

    // New segment starts where current segment ends
    const newStart = currentPhrase.end;
    // New segment ends at next segment's start, or 2 seconds later if it's the last segment
    const newEnd = nextPhrase ? nextPhrase.start : newStart + 2;

    const newPhrases = [...phrases];
    newPhrases.splice(afterIndex + 1, 0, {
      start: newStart,
      end: newEnd,
      en: '',
      cn: ''
    });
    onChange(newPhrases);
  };

  
  return (
    <div className="segment-editor">
      <div className="segment-list">
        {phrases.map((phrase, index) => (
          <div key={index} className={`segment-item ${playingIndex === index ? 'playing' : ''}`}>
            <div className="segment-controls">
              <button
                type="button"
                className={`play-btn ${playingIndex === index ? 'active' : ''}`}
                onClick={() => handlePlaySegment(index)}
                title={playingIndex === index ? "停止" : "试听片段"}
              >
                {playingIndex === index ? '⏸' : '▶'}
              </button>
              <div className="time-inputs">
                <div className="time-group">
                  <label>开始(秒)</label>
                  <input
                    type="number"
                    value={phrase.start}
                    onChange={(e) => updatePhrase(index, 'start', Number(e.target.value))}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className="time-group">
                  <label>结束(秒)</label>
                  <input
                    type="number"
                    value={phrase.end}
                    onChange={(e) => updatePhrase(index, 'end', Number(e.target.value))}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className="duration-display">
                  {(phrase.end - phrase.start).toFixed(1)}s
                </div>
              </div>
            </div>

            <div className="text-inputs">
              <input
                type="text"
                className="en-input"
                value={phrase.en}
                onChange={(e) => updatePhrase(index, 'en', e.target.value)}
                placeholder="英文歌词"
              />
              <input
                type="text"
                className="cn-input"
                value={phrase.cn || ''}
                onChange={(e) => updatePhrase(index, 'cn', e.target.value)}
                placeholder="中文提示 (可选)"
              />
            </div>

            <button
              type="button"
              className="delete-btn"
              onClick={() => removePhrase(index)}
              title="删除片段"
            >
              ×
            </button>

            <button
              type="button"
              className="insert-btn"
              onClick={() => insertPhrase(index)}
              title="在此片段后插入新片段"
            >
              + 插入
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-segment-btn" onClick={addPhrase}>
        + 添加新片段
      </button>

      <style>{`
        .segment-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .segment-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 600px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .segment-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          padding-bottom: 40px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          position: relative;
          transition: all 0.2s;
        }
        .segment-item.playing {
          background: #eff6ff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }
        .segment-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .play-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          flex-shrink: 0;
        }
        .play-btn:hover {
          background: #f1f5f9;
          color: #334155;
        }
        .play-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
        .time-inputs {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        .time-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .time-group label {
          font-size: 12px;
          color: #64748b;
        }
        .time-group input {
          width: 80px;
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
        }
        .duration-display {
          font-size: 12px;
          color: #94a3b8;
          font-family: monospace;
          margin-left: auto;
        }
        .text-inputs {
          display: flex;
          gap: 8px;
          padding-left: 44px;
        }
        .en-input {
          flex: 2;
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        .cn-input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 14px;
        }
        .delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          border-radius: 4px;
        }
        .delete-btn:hover {
          background: #fee2e2;
          color: #ef4444;
        }
        .insert-btn {
          position: absolute;
          bottom: 8px;
          right: 8px;
          padding: 4px 12px;
          font-size: 12px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #64748b;
          cursor: pointer;
          border-radius: 4px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .insert-btn:hover {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
        }
        .add-segment-btn {
          padding: 10px;
          background: white;
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          color: #64748b;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-segment-btn:hover {
          border-color: #94a3b8;
          color: #475569;
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
};
