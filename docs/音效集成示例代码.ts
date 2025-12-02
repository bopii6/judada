// 这是集成音频文件的示例代码
// 当你下载好音效文件后，我会帮你修改 SoundEffectContext.tsx

// ============================================
// 步骤1: 将音效文件放在 public/sounds/ 目录
// ============================================
// 文件结构：
// apps/web/public/sounds/
//   ├── keyboard-mechanical-1.wav
//   ├── keyboard-mechanical-2.wav
//   ├── keyboard-classic.wav
//   └── keyboard-minimal.wav

// ============================================
// 步骤2: 修改 SoundEffectContext.tsx
// ============================================

// 音频文件路径配置
const SOUND_FILES = {
  mechanical: [
    '/sounds/keyboard-mechanical-1.wav',
    '/sounds/keyboard-mechanical-2.wav',
    '/sounds/keyboard-mechanical-3.wav', // 可以有多个变体
  ],
  classic: '/sounds/keyboard-classic.wav',
  minimal: '/sounds/keyboard-minimal.wav',
};

// 预加载音频（可选，提升性能）
const audioCache = new Map<string, HTMLAudioElement>();

const loadAudio = (url: string): Promise<HTMLAudioElement> => {
  if (audioCache.has(url)) {
    return Promise.resolve(audioCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.oncanplaythrough = () => {
      audioCache.set(url, audio);
      resolve(audio);
    };
    audio.onerror = reject;
  });
};

// 播放音频文件的函数
const playAudioFile = (url: string | string[], volume: number = 0.5) => {
  const urls = Array.isArray(url) ? url : [url];
  // 如果是数组，随机选择一个（增加变化）
  const randomUrl = urls[Math.floor(Math.random() * urls.length)];
  
  const audio = audioCache.get(randomUrl) || new Audio(randomUrl);
  
  // 重置播放位置
  audio.currentTime = 0;
  audio.volume = volume;
  
  // 播放
  const playPromise = audio.play();
  
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn('Audio play failed:', error);
    });
  }
};

// 修改后的 playClickSound 函数示例
// 注意：这是示例代码，实际使用时需要在 React 组件中
/*
const playClickSound = useCallback(() => {
  if (soundMode === 'off') return;

  switch (soundMode) {
    case 'mechanical':
      // 使用音频文件
      playAudioFile(SOUND_FILES.mechanical, 0.4);
      break;
    case 'classic':
      playAudioFile(SOUND_FILES.classic, 0.3);
      break;
    case 'minimal':
      playAudioFile(SOUND_FILES.minimal, 0.2);
      break;
    default:
      break;
  }
}, [soundMode]);

// ============================================
// 步骤3: 在组件加载时预加载音频（可选）
// ============================================
useEffect(() => {
  // 预加载所有音效
  Object.values(SOUND_FILES).forEach(url => {
    if (Array.isArray(url)) {
      url.forEach(u => loadAudio(u));
    } else {
      loadAudio(url);
    }
  });
}, []);
*/

// ============================================
// 完整示例：使用 AudioContext 播放（更精确控制）
// ============================================
const playAudioWithContext = async (url: string, volume: number = 0.5) => {
  // 注意：getAudioContext 需要在实际代码中定义
  // const ctx = getAudioContext();
  // if (!ctx) return;

  try {
    // 加载音频文件
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // 创建音频源
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = audioBuffer;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0);
  } catch (error) {
    console.warn('Failed to play audio:', error);
    // 降级到 HTML Audio
    playAudioFile(url, volume);
  }
};

// ============================================
// 使用说明
// ============================================
/*
1. 下载音效文件（WAV格式最佳，MP3也可以）
2. 将文件放在 apps/web/public/sounds/ 目录
3. 修改 SOUND_FILES 配置，指向你的文件
4. 告诉我文件名，我会帮你完整集成

推荐文件命名：
- keyboard-mechanical-blue.wav (青轴)
- keyboard-mechanical-brown.wav (茶轴)
- keyboard-mechanical-red.wav (红轴)
- keyboard-mechanical-cherry.wav (Cherry MX)
*/

