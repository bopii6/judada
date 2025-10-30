import React from 'react';

interface TopBarProps {
  currentIndex: number;
  total: number;
  combo: number;
  bestCombo: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenParents: () => void;
}

export function TopBar({
  currentIndex,
  total,
  combo,
  bestCombo,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  onOpenParents
}: TopBarProps) {
  const progress = total === 0 ? 0 : Math.min(100, Math.round(((currentIndex + 1) / total) * 100));

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <div className="progress-label">
          <span className="progress-label__title">Round</span>
          <span className="progress-label__value">
            {Math.min(currentIndex + 1, total)} / {total}
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="top-bar__center">
        <div className="combo-label">
          <span className="combo-label__title">Combo</span>
          <span className="combo-label__value">{combo}</span>
        </div>
        <div className="combo-label combo-label--ghost">
          <span className="combo-label__title">Best</span>
          <span className="combo-label__value">{bestCombo}</span>
        </div>
      </div>
      <div className="top-bar__right">
        <button type="button" className="icon-button" onClick={onToggleSound} aria-label="Toggle sound">
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <button type="button" className="icon-button" onClick={onOpenParents}>
          👪
        </button>
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
          ⚙️
        </button>
      </div>
    </header>
  );
}

export default TopBar;
