import React from 'react';

interface ParentSentenceRow {
  sentenceId: number;
  text: string;
  attempts: number;
  successes: number;
}

interface TagStat {
  tag: string;
  percentage: number;
}

export interface ParentSummaryData {
  dateLabel: string;
  totalAttempts: number;
  successes: number;
  comboRecord: number;
  sentences: ParentSentenceRow[];
  tagStats: TagStat[];
  totalUnique: number;
}

interface ParentPanelProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  summary: ParentSummaryData | null;
}

export function ParentPanel({ open, onClose, onReset, summary }: ParentPanelProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2>今日练习</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close parent panel">
            ✕
          </button>
        </div>
        <div className="modal__body">
          {summary ? (
            <>
              <section className="parent-highlight">
                <div>
                  <strong>{summary.totalUnique}</strong>
                  <span>条不同句子</span>
                </div>
                <div>
                  <strong>{summary.totalAttempts}</strong>
                  <span>次尝试</span>
                </div>
                <div>
                  <strong>
                    {summary.successes} ({((summary.successes / Math.max(summary.totalAttempts, 1)) * 100).toFixed(0)}%)
                  </strong>
                  <span>成功次数</span>
                </div>
                <div>
                  <strong>{summary.comboRecord}</strong>
                  <span>最高连击</span>
                </div>
              </section>

              <section className="parent-tags">
                <h3>主题标签占比</h3>
                {summary.tagStats.length === 0 && <p className="empty-hint">今日尚无练习记录。</p>}
                <ul>
                  {summary.tagStats.map(tag => (
                    <li key={tag.tag}>
                      <span>{tag.tag}</span>
                      <div className="tag-bar">
                        <div className="tag-bar__fill" style={{ width: `${tag.percentage}%` }} />
                      </div>
                      <span>{tag.percentage.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="parent-list">
                <h3>练过的句子</h3>
                <table>
                  <thead>
                    <tr>
                      <th>英文句子</th>
                      <th>次数</th>
                      <th>成功</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sentences.map(item => (
                      <tr key={item.sentenceId}>
                        <td>{item.text}</td>
                        <td>{item.attempts}</td>
                        <td>{item.successes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <p className="empty-hint">今日尚无练习数据，继续加油！</p>
          )}
        </div>
        <div className="modal__footer modal__footer--spaced">
          <button className="danger-button" onClick={onReset}>
            清空所有记录
          </button>
          <button className="primary-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParentPanel;
