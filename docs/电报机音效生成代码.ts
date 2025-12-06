// 电报机音效生成代码
// 如果你找不到合适的音频文件，可以用这个代码生成电报机音效

const playTelegraphSound = (ctx: AudioContext) => {
  const t = ctx.currentTime;

  // 电报机的"滴"声 - 高频短促
  const tick = ctx.createOscillator();
  const tickGain = ctx.createGain();
  const tickFilter = ctx.createBiquadFilter();

  // 使用方波模拟电报机的电磁声
  tick.type = 'square';
  tick.frequency.setValueAtTime(1200, t); // 高频"滴"声
  tick.frequency.exponentialRampToValueAtTime(800, t + 0.02);

  // 带通滤波器，模拟电报机的音色
  tickFilter.type = 'bandpass';
  tickFilter.frequency.setValueAtTime(1200, t);
  tickFilter.Q.setValueAtTime(10, t); // 高Q值，更尖锐

  tickGain.gain.setValueAtTime(0.2, t);
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
  tack.frequency.setValueAtTime(800, t + 0.01);
  tack.frequency.exponentialRampToValueAtTime(600, t + 0.03);

  tackFilter.type = 'bandpass';
  tackFilter.frequency.setValueAtTime(800, t);
  tackFilter.Q.setValueAtTime(8, t);

  tackGain.gain.setValueAtTime(0.1, t + 0.01);
  tackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

  tack.connect(tackFilter);
  tackFilter.connect(tackGain);
  tackGain.connect(ctx.destination);

  tack.start(t + 0.01);
  tack.stop(t + 0.04);
};

// 经典电报机音效（更简洁版本）
const playTelegraphClassic = (ctx: AudioContext) => {
  const t = ctx.currentTime;

  // 单一的高频"滴"声
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1000, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.02);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1000, t);
  filter.Q.setValueAtTime(12, t); // 非常尖锐的音色

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.025);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.025);
};

// 摩尔斯电码风格（更真实）
const playMorseCodeClick = (ctx: AudioContext) => {
  const t = ctx.currentTime;

  // 电报机的电磁继电器声音
  const click1 = ctx.createOscillator();
  const click1Gain = ctx.createGain();
  
  click1.type = 'square';
  click1.frequency.setValueAtTime(1500, t);
  click1.frequency.exponentialRampToValueAtTime(1000, t + 0.015);

  click1Gain.gain.setValueAtTime(0.2, t);
  click1Gain.gain.exponentialRampToValueAtTime(0.01, t + 0.02);

  click1.connect(click1Gain);
  click1Gain.connect(ctx.destination);

  click1.start(t);
  click1.stop(t + 0.02);

  // 回弹音
  const click2 = ctx.createOscillator();
  const click2Gain = ctx.createGain();
  
  click2.type = 'sine';
  click2.frequency.setValueAtTime(800, t + 0.01);
  
  click2Gain.gain.setValueAtTime(0.08, t + 0.01);
  click2Gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

  click2.connect(click2Gain);
  click2Gain.connect(ctx.destination);

  click2.start(t + 0.01);
  click2.stop(t + 0.03);
};

// 使用示例：
// 在 SoundEffectContext.tsx 中，将 'mechanical' 模式改为使用电报机音效
// playTelegraphSound(ctx); // 完整版
// playTelegraphClassic(ctx); // 简洁版
// playMorseCodeClick(ctx); // 摩尔斯电码版













