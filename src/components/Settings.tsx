import React, { useMemo } from 'react';
import { GameSettings, LearningMode } from '../types';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  tierBounds: { min: number; max: number };
  voices: SpeechSynthesisVoice[];
  ttsSupported: boolean;
}

const MODES: { value: LearningMode; label: string; description: string }[] = [
  { value: 'type', label: '敲字模式', description: '键盘输入整句，Enter 提交' },
  { value: 'tiles', label: '点词拼句', description: '点选词块拼出句子' }
];

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  tierBounds,
  voices,
  ttsSupported
}: SettingsProps) {
  const englishVoices = useMemo(() => voices.filter(v => v.lang.toLowerCase().startsWith('en')), [voices]);

  const handleModeChange = (mode: LearningMode) => {
    onChange({ ...settings, mode });
  };

  const handleToggle = (key: keyof GameSettings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  const handleTierChange = (key: 'tierMin' | 'tierMax', value: number) => {
    if (key === 'tierMin') {
      onChange({ ...settings, tierMin: Math.min(value, settings.tierMax) });
    } else {
      onChange({ ...settings, tierMax: Math.max(value, settings.tierMin) });
    }
  };

  const handleSessionLength = (value: number) => {
    onChange({ ...settings, sessionLength: Math.max(5, Math.min(20, value)) });
  };

  const handleVoiceChange = (voiceURI: string) => {
    onChange({ ...settings, voiceURI });
  };

  const handleRateChange = (value: number) => {
    onChange({ ...settings, speechRate: Number(value.toFixed(2)) });
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2>设置</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        <div className="modal__body">
          <section className="settings-section">
            <h3>模式</h3>
            <div className="mode-select">
              {MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  className={`mode-card ${settings.mode === mode.value ? 'mode-card--active' : ''}`}
                  onClick={() => handleModeChange(mode.value)}
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>难度范围</h3>
            <div className="settings-grid">
              <label>
                最低 Tier
                <input
                  type="number"
                  min={tierBounds.min}
                  max={tierBounds.max}
                  value={settings.tierMin}
                  onChange={event => handleTierChange('tierMin', Number(event.target.value))}
                />
              </label>
              <label>
                最高 Tier
                <input
                  type="number"
                  min={tierBounds.min}
                  max={tierBounds.max}
                  value={settings.tierMax}
                  onChange={event => handleTierChange('tierMax', Number(event.target.value))}
                />
              </label>
              <p className="settings-hint">推荐：保持逐步提升，玩“i+1”难度。</p>
            </div>
          </section>

          <section className="settings-section">
            <h3>每局题数</h3>
            <label className="slider-row">
              <input
                type="range"
                min={5}
                max={20}
                value={settings.sessionLength}
                onChange={event => handleSessionLength(Number(event.target.value))}
              />
              <span>{settings.sessionLength} 句</span>
            </label>
          </section>

          <section className="settings-section">
            <h3>声音与反馈</h3>
            <div className="settings-toggles">
              <button type="button" className={`toggle ${settings.enableTTS ? 'toggle--on' : ''}`} onClick={() => handleToggle('enableTTS')}>
                <strong>TTS 播报</strong>
                <span>{ttsSupported ? (settings.enableTTS ? '已开启' : '关闭') : '设备暂不支持'}</span>
              </button>
              <button type="button" className={`toggle ${settings.enableSFX ? 'toggle--on' : ''}`} onClick={() => handleToggle('enableSFX')}>
                <strong>提示音效</strong>
                <span>{settings.enableSFX ? '叮咚提示' : '静音'}</span>
              </button>
              <button type="button" className={`toggle ${settings.enableVibration ? 'toggle--on' : ''}`} onClick={() => handleToggle('enableVibration')}>
                <strong>震动反馈</strong>
                <span>{settings.enableVibration ? '设备震动开启' : '关闭'}</span>
              </button>
            </div>
            <div className="settings-grid">
              <label>
                语速
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={settings.speechRate}
                  onChange={event => handleRateChange(Number(event.target.value))}
                />
                <span className="settings-hint">{settings.speechRate.toFixed(2)}</span>
              </label>
              <label>
                发音
                <select value={settings.voiceURI ?? ''} onChange={event => handleVoiceChange(event.target.value)}>
                  <option value="">系统默认（优先英文）</option>
                  {englishVoices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>
        <div className="modal__footer">
          <button className="primary-button" onClick={onClose}>
            返回闯关
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
