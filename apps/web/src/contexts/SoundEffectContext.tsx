import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type SoundEffectMode = 'telegraph' | 'classic' | 'minimal' | 'off';

interface SoundEffectContextType {
  soundMode: SoundEffectMode;
  setSoundMode: (mode: SoundEffectMode) => void;
  playClickSound: () => void;
}

const SOUND_MODE_KEY = 'judada:sound-mode';

const SoundEffectContext = createContext<SoundEffectContextType | undefined>(undefined);

// 音频文件路径配置
const SOUND_FILES = {
  telegraph: '/sounds/telegraph-click.wav', // 电报机音效 (Freesound ID: 148893)
  classic: null, // 使用代码生成
  minimal: null, // 使用代码生成
};

// 音频缓存
const audioCache = new Map<string, HTMLAudioElement>();

// 加载音频文件
const loadAudioFile = (url: string): Promise<HTMLAudioElement> => {
  if (audioCache.has(url)) {
    return Promise.resolve(audioCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0.5; // 默认音量
    
    // 设置超时，避免无限等待
    const timeout = setTimeout(() => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
      reject(new Error(`Audio load timeout: ${url}`));
    }, 5000);
    
    const handleCanPlay = () => {
      clearTimeout(timeout);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audioCache.set(url, audio);
      console.log('Audio loaded successfully:', url);
      resolve(audio);
    };
    
    const handleLoadedData = () => {
      // 如果 canplaythrough 没有触发，至少 loadeddata 可以工作
      if (!audioCache.has(url)) {
        clearTimeout(timeout);
        audio.removeEventListener('canplaythrough', handleCanPlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('loadeddata', handleLoadedData);
        audioCache.set(url, audio);
        console.log('Audio loaded (loadeddata):', url);
        resolve(audio);
      }
    };
    
    const handleError = (e: Event) => {
      clearTimeout(timeout);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
      console.error('Audio load error:', url, e);
      reject(new Error(`Failed to load audio: ${url}`));
    };
    
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('error', handleError);
    
    // 立即开始加载
    audio.load();
  });
};

// 当前正在播放的音频实例列表（用于支持同时播放多个音效）
const activeAudioInstances = new Set<HTMLAudioElement>();

// 播放音频文件（播放完整音频）
const playAudioFile = async (url: string, volume: number = 0.5) => {
  try {
    console.log('[SoundEffect] Attempting to play audio file:', url);
    const audio = new Audio(url);
    audio.volume = volume;
    audio.currentTime = 0;
    
    // 添加详细的错误监听
    audio.addEventListener('error', (e) => {
      const error = audio.error;
      console.error('[SoundEffect] Audio error details:', {
        url,
        code: error?.code,
        message: error?.message,
        MEDIA_ERR_ABORTED: error?.code === MediaError.MEDIA_ERR_ABORTED,
        MEDIA_ERR_NETWORK: error?.code === MediaError.MEDIA_ERR_NETWORK,
        MEDIA_ERR_DECODE: error?.code === MediaError.MEDIA_ERR_DECODE,
        MEDIA_ERR_SRC_NOT_SUPPORTED: error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
      });
      activeAudioInstances.delete(audio);
      // 降级到生成的音效
      const ctx = getAudioContext();
      if (ctx) {
        playTelegraphSound(ctx);
      }
    }, { once: true });
    
    // 添加到活动实例集合
    activeAudioInstances.add(audio);
    
    // 播放完成后清理
    audio.addEventListener('ended', () => {
      console.log('[SoundEffect] Audio playback ended:', url);
      activeAudioInstances.delete(audio);
    }, { once: true });
    
    // 监听加载成功
    audio.addEventListener('loadeddata', () => {
      console.log('[SoundEffect] Audio loaded successfully:', url);
    }, { once: true });
    
    // 播放音频
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      console.log('[SoundEffect] Audio playback started:', url);
    }
    
  } catch (error) {
    console.error('[SoundEffect] Failed to play audio file:', url, error);
    // 如果播放失败，使用生成的音效
    const ctx = getAudioContext();
    if (ctx) {
      playTelegraphSound(ctx);
    }
  }
};

// 电报机音效 - "滴滴答答"的经典音效 ⭐⭐⭐⭐⭐
const playTelegraphSound = (ctx: AudioContext) => {
  const t = ctx.currentTime;

  // 电报机的"滴"声 - 高频短促的电磁声
  const tick = ctx.createOscillator();
  const tickGain = ctx.createGain();
  const tickFilter = ctx.createBiquadFilter();

  // 使用方波模拟电报机的电磁继电器声音
  tick.type = 'square';
  tick.frequency.setValueAtTime(1200 + Math.random() * 200, t); // 1200-1400Hz，高频"滴"声
  tick.frequency.exponentialRampToValueAtTime(800, t + 0.02);

  // 带通滤波器，模拟电报机的尖锐音色
  tickFilter.type = 'bandpass';
  tickFilter.frequency.setValueAtTime(1200, t);
  tickFilter.Q.setValueAtTime(10, t); // 高Q值，更尖锐

  tickGain.gain.setValueAtTime(0.25, t);
  tickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

  tick.connect(tickFilter);
  tickFilter.connect(tickGain);
  tickGain.connect(ctx.destination);

  tick.start(t);
  tick.stop(t + 0.03);

  // 添加轻微的"答"声 - 稍低频率的回音
  const tack = ctx.createOscillator();
  const tackGain = ctx.createGain();
  const tackFilter = ctx.createBiquadFilter();

  tack.type = 'square';
  tack.frequency.setValueAtTime(800 + Math.random() * 100, t + 0.01);
  tack.frequency.exponentialRampToValueAtTime(600, t + 0.03);

  tackFilter.type = 'bandpass';
  tackFilter.frequency.setValueAtTime(800, t);
  tackFilter.Q.setValueAtTime(8, t);

  tackGain.gain.setValueAtTime(0.12, t + 0.01);
  tackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

  tack.connect(tackFilter);
  tackFilter.connect(tackGain);
  tackGain.connect(ctx.destination);

  tack.start(t + 0.01);
  tack.stop(t + 0.04);
};

// 机械键盘音效（保留作为备选）
const playMechanicalKeyboard = (ctx: AudioContext) => {
  const t = ctx.currentTime;

  // 主按键音 - 低沉的"咔"声
  const mainClick = ctx.createOscillator();
  const mainGain = ctx.createGain();
  const mainFilter = ctx.createBiquadFilter();

  mainFilter.type = 'lowpass';
  mainFilter.frequency.setValueAtTime(800, t);
  mainFilter.Q.setValueAtTime(2, t);

  mainClick.type = 'square';
  const baseFreq = 200 + Math.random() * 100;
  mainClick.frequency.setValueAtTime(baseFreq, t);
  mainClick.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + 0.05);

  mainGain.gain.setValueAtTime(0.15, t);
  mainGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

  mainClick.connect(mainFilter);
  mainFilter.connect(mainGain);
  mainGain.connect(ctx.destination);

  mainClick.start(t);
  mainClick.stop(t + 0.05);

  // 高频回弹音
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

  reboundClick.start(t + 0.01);
  reboundClick.stop(t + 0.03);

  // 噪声层
  const bufferSize = ctx.sampleRate * 0.01;
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

// 经典音效（原来的简单音调）
const playClassicClick = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, ctx.currentTime);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

// 极简音效（更轻的音调）
const playMinimalClick = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
};

export const SoundEffectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundMode, setSoundModeState] = useState<SoundEffectMode>(() => {
    if (typeof window === "undefined") return 'telegraph';
    const saved = localStorage.getItem(SOUND_MODE_KEY);
    // 兼容旧版本的 'mechanical' 模式
    if (saved === 'mechanical' || saved === null) {
      return 'telegraph';
    }
    // 验证是否为有效的模式
    const validModes: SoundEffectMode[] = ['telegraph', 'classic', 'minimal', 'off'];
    if (validModes.includes(saved as SoundEffectMode)) {
      return saved as SoundEffectMode;
    }
    return 'telegraph';
  });

  useEffect(() => {
    localStorage.setItem(SOUND_MODE_KEY, soundMode);
  }, [soundMode]);

  const setSoundMode = useCallback((mode: SoundEffectMode) => {
    setSoundModeState(mode);
  }, []);

  const playClickSound = useCallback(() => {
    if (soundMode === 'off') return;

    const ctx = getAudioContext();
    if (!ctx) return;

    switch (soundMode) {
      case 'telegraph':
        // 优先使用音频文件，如果不存在则使用生成的音效
        const telegraphFile = SOUND_FILES.telegraph;
        console.log('[SoundEffect] Telegraph mode, file path:', telegraphFile);
        if (telegraphFile) {
          // 播放完整的音频文件（文件本身就很短，约0.1秒）
          playAudioFile(telegraphFile, 0.4).catch((error) => {
            // 如果文件不存在，使用生成的音效
            console.warn('[SoundEffect] Failed to play audio file, using generated sound:', error);
            playTelegraphSound(ctx);
          });
        } else {
          console.log('[SoundEffect] No telegraph file configured, using generated sound');
          playTelegraphSound(ctx);
        }
        break;
      case 'classic':
        playClassicClick(ctx);
        break;
      case 'minimal':
        playMinimalClick(ctx);
        break;
      default:
        break;
    }
  }, [soundMode]);

  // 预加载音频文件
  useEffect(() => {
    const preloadAudio = async () => {
      if (SOUND_FILES.telegraph) {
        try {
          await loadAudioFile(SOUND_FILES.telegraph);
        } catch (error) {
          console.warn('Failed to preload telegraph sound:', error);
        }
      }
    };
    preloadAudio();
  }, []);

  return (
    <SoundEffectContext.Provider value={{ soundMode, setSoundMode, playClickSound }}>
      {children}
    </SoundEffectContext.Provider>
  );
};

export const useSoundEffect = () => {
  const context = useContext(SoundEffectContext);
  if (context === undefined) {
    throw new Error('useSoundEffect must be used within a SoundEffectProvider');
  }
  return context;
};

