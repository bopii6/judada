declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContext = new AudioCtx();
  }
  // 确保音频上下文处于运行状态
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

const playTone = (frequency: number, duration = 0.2, type: OscillatorType = "sine") => {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
};

// 为了向后兼容，保留这个函数，但实际使用默认的机械键盘音效
// 注意：这个函数现在会使用默认的机械键盘音效
// 建议在使用的地方直接使用 useSoundEffect hook 或 useFeedbackSound hook
export const playClickSound = () => {
  // 真实的机械键盘音效 - 包含按键按下和回弹的声音
  const ctx = getContext();
  if (!ctx) return;
  
  const t = ctx.currentTime;

  // 主按键音 - 低沉的"咔"声（模拟按键按下）
  const mainClick = ctx.createOscillator();
  const mainGain = ctx.createGain();
  const mainFilter = ctx.createBiquadFilter();

  mainFilter.type = 'lowpass';
  mainFilter.frequency.setValueAtTime(800, t);
  mainFilter.Q.setValueAtTime(2, t);

  mainClick.type = 'square';
  // 随机频率变化，模拟不同按键
  const baseFreq = 200 + Math.random() * 100; // 200-300Hz
  mainClick.frequency.setValueAtTime(baseFreq, t);
  mainClick.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + 0.05);

  mainGain.gain.setValueAtTime(0.15, t);
  mainGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

  mainClick.connect(mainFilter);
  mainFilter.connect(mainGain);
  mainGain.connect(ctx.destination);

  mainClick.start(t);
  mainClick.stop(t + 0.05);

  // 高频点击音 - 清脆的"嗒"声（模拟按键回弹）
  const reboundClick = ctx.createOscillator();
  const reboundGain = ctx.createGain();
  const reboundFilter = ctx.createBiquadFilter();

  reboundFilter.type = 'bandpass';
  reboundFilter.frequency.setValueAtTime(2000, t);
  reboundFilter.Q.setValueAtTime(5, t);

  reboundClick.type = 'sine';
  reboundClick.frequency.setValueAtTime(2500 + Math.random() * 500, t);
  reboundClick.frequency.exponentialRampToValueAtTime(1500, t + 0.02);

  reboundGain.gain.setValueAtTime(0.08, t);
  reboundGain.gain.exponentialRampToValueAtTime(0.01, t + 0.02);

  reboundClick.connect(reboundFilter);
  reboundFilter.connect(reboundGain);
  reboundGain.connect(ctx.destination);

  // 回弹音稍晚一点出现
  reboundClick.start(t + 0.01);
  reboundClick.stop(t + 0.03);

  // 添加轻微的噪声层，增加真实感
  const bufferSize = ctx.sampleRate * 0.01; // 10ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  const noiseFilter = ctx.createBiquadFilter();

  noiseFilter.type = 'highpass';
  noiseFilter.frequency.setValueAtTime(1000, t);

  noiseGain.gain.setValueAtTime(0.03, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + 0.01);
};

export const playSuccessSound = () => {
  playTone(660, 0.18, "sine");
  setTimeout(() => playTone(880, 0.18, "sine"), 90);
};

export const playErrorSound = () => {
  playTone(220, 0.12, "sawtooth");
  setTimeout(() => playTone(180, 0.18, "sawtooth"), 120);
};
