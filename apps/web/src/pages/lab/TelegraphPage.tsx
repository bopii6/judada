import React, { useState, useRef, useEffect } from 'react';
import { useSoundEffects } from '../../hooks/useSoundEffects';

// 预设的英语句子
const SAMPLE_SENTENCES = [
    { en: "Hello, how are you today?", cn: "你好，今天怎么样？" },
    { en: "I am learning English.", cn: "我正在学英语。" },
    { en: "The weather is beautiful.", cn: "天气真好。" },
    { en: "Thank you very much.", cn: "非常感谢你。" },
    { en: "Nice to meet you.", cn: "很高兴认识你。" },
    { en: "Have a wonderful day!", cn: "祝你有美好的一天！" },
    { en: "Can you help me?", cn: "你能帮我吗？" },
    { en: "I love this game.", cn: "我喜欢这个游戏。" },
];

export const TelegraphPage = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [typedText, setTypedText] = useState('');
    const [printedLines, setPrintedLines] = useState<Array<{ text: string; isCorrect: boolean; time: string }>>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printingText, setPrintingText] = useState('');
    const [printingIndex, setPrintingIndex] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [stats, setStats] = useState({ correct: 0, total: 0 });
    const { playTypewriterKey, playTypewriterDing, playSuccess, playError } = useSoundEffects();
    const inputRef = useRef<HTMLInputElement>(null);
    const paperRef = useRef<HTMLDivElement>(null);

    const currentSentence = SAMPLE_SENTENCES[currentIndex];

    // 打字机打印效果
    useEffect(() => {
        if (isPrinting && printingIndex < printingText.length) {
            const timer = setTimeout(() => {
                playTypewriterKey();
                setPrintingIndex(prev => prev + 1);
            }, 50 + Math.random() * 30); // 随机延迟模拟真实打字机
            return () => clearTimeout(timer);
        } else if (isPrinting && printingIndex >= printingText.length) {
            // 打印完成
            setTimeout(() => {
                playTypewriterDing();
                setIsPrinting(false);
                setPrintingText('');
                setPrintingIndex(0);
                
                // 滚动到底部
                if (paperRef.current) {
                    paperRef.current.scrollTop = paperRef.current.scrollHeight;
                }
            }, 300);
        }
    }, [isPrinting, printingIndex, printingText, playTypewriterKey, playTypewriterDing]);

    // 检查输入是否正确
    const checkAnswer = () => {
        const isCorrect = typedText.trim().toLowerCase() === currentSentence.en.toLowerCase();
        return isCorrect;
    };

    // 获取输入状态的样式
    const getInputStatus = () => {
        if (!typedText) return 'idle';
        const target = currentSentence.en.toLowerCase();
        const typed = typedText.toLowerCase();
        
        if (target.startsWith(typed)) {
            return typed === target ? 'complete' : 'correct';
        }
        return 'error';
    };

    // 提交答案
    const handleSubmit = () => {
        if (isPrinting || !typedText.trim()) return;

        const isCorrect = checkAnswer();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // 开始打印动画
        setIsPrinting(true);
        setPrintingText(typedText);
        setPrintingIndex(0);

        // 更新统计
        setStats(prev => ({
            correct: prev.correct + (isCorrect ? 1 : 0),
            total: prev.total + 1
        }));

        // 添加到打印记录
        setTimeout(() => {
            setPrintedLines(prev => [...prev, { text: typedText, isCorrect, time: timeStr }]);
            
            if (isCorrect) {
                playSuccess();
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    // 自动切换到下一句
                    setCurrentIndex(prev => (prev + 1) % SAMPLE_SENTENCES.length);
                }, 1500);
            } else {
                playError();
            }
        }, typedText.length * 60 + 500);

        setTypedText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isPrinting) return;
        const newValue = e.target.value;
        if (newValue.length > typedText.length) {
            playTypewriterKey();
        }
        setTypedText(newValue);
    };

    const handleNextSentence = () => {
        setCurrentIndex(prev => (prev + 1) % SAMPLE_SENTENCES.length);
        setTypedText('');
        inputRef.current?.focus();
    };

    const handlePrevSentence = () => {
        setCurrentIndex(prev => (prev - 1 + SAMPLE_SENTENCES.length) % SAMPLE_SENTENCES.length);
        setTypedText('');
        inputRef.current?.focus();
    };

    const clearPaper = () => {
        setPrintedLines([]);
        setStats({ correct: 0, total: 0 });
    };

    const inputStatus = getInputStatus();

    return (
        <div className="min-h-screen bg-[#1a1612] flex flex-col overflow-hidden"
            style={{
                backgroundImage: `
                    radial-gradient(ellipse at top, #2a2218 0%, transparent 50%),
                    radial-gradient(ellipse at bottom, #1a1612 0%, #0d0b09 100%)
                `
            }}
        >
            {/* 顶部装饰条 */}
            <div className="h-2 bg-gradient-to-r from-amber-900 via-amber-600 to-amber-900" />
            
            {/* 主内容区 */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
                
                {/* 标题 */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-[0.3em] text-amber-100"
                        style={{ 
                            fontFamily: 'Georgia, serif',
                            textShadow: '0 2px 10px rgba(251, 191, 36, 0.3)'
                        }}
                    >
                        ⚡ TELEGRAPH ⚡
                    </h1>
                    <p className="text-amber-600/60 text-sm mt-1 tracking-widest">
                        — ENGLISH TYPING PRACTICE —
                    </p>
                </div>

                {/* 电报机主体 */}
                <div className="w-full max-w-2xl">
                    
                    {/* 参考句子卡片 */}
                    <div className="relative mb-4">
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-amber-900/80 rounded text-amber-200 text-xs tracking-wider">
                            第 {currentIndex + 1} 句
                        </div>
                        <div className="bg-gradient-to-b from-[#f5f0e1] to-[#e8e0cc] rounded-lg p-6 shadow-xl border-2 border-amber-900/30"
                            style={{
                                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.4)'
                            }}
                        >
                            {/* 英文句子 */}
                            <div className="text-2xl text-gray-800 font-medium tracking-wide mb-3"
                                style={{ fontFamily: '"Courier Prime", Courier, monospace' }}
                            >
                                {currentSentence.en.split('').map((char, i) => {
                                    const typedChar = typedText[i]?.toLowerCase();
                                    const targetChar = char.toLowerCase();
                                    let color = 'text-gray-800';
                                    
                                    if (i < typedText.length) {
                                        color = typedChar === targetChar ? 'text-green-600' : 'text-red-500';
                                    } else if (i === typedText.length) {
                                        color = 'text-amber-600 bg-amber-200';
                                    }
                                    
                                    return (
                                        <span key={i} className={`${color} transition-colors`}>
                                            {char}
                                        </span>
                                    );
                                })}
                            </div>
                            
                            {/* 中文翻译 */}
                            <div className="text-gray-500 text-sm border-t border-amber-900/20 pt-2">
                                💬 {currentSentence.cn}
                            </div>

                            {/* 切换按钮 */}
                            <div className="flex justify-between mt-4">
                                <button
                                    onClick={handlePrevSentence}
                                    className="px-4 py-2 text-amber-800 hover:text-amber-600 text-sm flex items-center gap-1 transition-colors"
                                >
                                    ← 上一句
                                </button>
                                <button
                                    onClick={handleNextSentence}
                                    className="px-4 py-2 text-amber-800 hover:text-amber-600 text-sm flex items-center gap-1 transition-colors"
                                >
                                    下一句 →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 输入区域 - 电报键盘风格 */}
                    <div className="relative">
                        <div className="bg-gradient-to-b from-[#3d3429] to-[#2a241c] rounded-xl p-4 shadow-2xl border border-amber-900/50">
                            
                            {/* 输入框 */}
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={typedText}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    disabled={isPrinting}
                                    placeholder="在这里输入英文，按回车发送..."
                                    className={`
                                        w-full px-4 py-4 rounded-lg text-xl
                                        bg-[#1a1612] border-2 transition-all duration-200
                                        placeholder:text-gray-600
                                        focus:outline-none
                                        ${inputStatus === 'idle' ? 'border-amber-900/50 text-amber-100' : ''}
                                        ${inputStatus === 'correct' ? 'border-green-600/50 text-green-400' : ''}
                                        ${inputStatus === 'complete' ? 'border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''}
                                        ${inputStatus === 'error' ? 'border-red-500/50 text-red-400' : ''}
                                        ${isPrinting ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                    style={{ fontFamily: '"Courier Prime", Courier, monospace' }}
                                    autoFocus
                                />
                                
                                {/* 状态指示灯 */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <div className={`
                                        w-3 h-3 rounded-full transition-all duration-200
                                        ${inputStatus === 'idle' ? 'bg-gray-600' : ''}
                                        ${inputStatus === 'correct' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : ''}
                                        ${inputStatus === 'complete' ? 'bg-green-400 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.8)]' : ''}
                                        ${inputStatus === 'error' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''}
                                    `} />
                                </div>
                            </div>

                            {/* 按钮区 */}
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isPrinting || !typedText.trim()}
                                    className={`
                                        flex-1 py-3 rounded-lg font-bold tracking-wider text-sm
                                        transition-all duration-200 uppercase
                                        ${isPrinting || !typedText.trim()
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-b from-amber-600 to-amber-700 text-white hover:from-amber-500 hover:to-amber-600 shadow-lg hover:shadow-amber-900/50 active:scale-[0.98]'
                                        }
                                    `}
                                >
                                    {isPrinting ? '⏳ 打印中...' : '📤 发送 (回车)'}
                                </button>
                            </div>

                            {/* 统计信息 */}
                            <div className="flex justify-center gap-6 mt-4 text-sm">
                                <div className="text-amber-600/80">
                                    已输入 <span className="text-amber-400 font-bold">{stats.total}</span> 条
                                </div>
                                <div className="text-green-600/80">
                                    正确 <span className="text-green-400 font-bold">{stats.correct}</span> 条
                                </div>
                                <div className="text-amber-600/80">
                                    正确率 <span className="text-amber-400 font-bold">
                                        {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 打印纸张区域 */}
                    {(printedLines.length > 0 || isPrinting) && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-amber-600/60 text-xs tracking-wider">
                                    📜 打印记录
                                </div>
                                <button
                                    onClick={clearPaper}
                                    className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                                >
                                    清空
                                </button>
                            </div>
                            
                            <div 
                                ref={paperRef}
                                className="bg-[#f5f0e1] rounded-lg p-4 max-h-48 overflow-y-auto shadow-inner"
                                style={{
                                    backgroundImage: `
                                        repeating-linear-gradient(
                                            transparent,
                                            transparent 27px,
                                            #e0d5c0 28px
                                        )
                                    `,
                                    backgroundPosition: '0 12px'
                                }}
                            >
                                {printedLines.map((line, index) => (
                                    <div 
                                        key={index}
                                        className={`
                                            py-1 text-lg border-b border-transparent
                                            ${line.isCorrect ? 'text-gray-800' : 'text-red-600 line-through'}
                                        `}
                                        style={{ 
                                            fontFamily: '"Courier Prime", Courier, monospace',
                                            lineHeight: '28px'
                                        }}
                                    >
                                        <span className="text-gray-400 text-xs mr-2">[{line.time}]</span>
                                        {line.isCorrect && <span className="text-green-600 mr-1">✓</span>}
                                        {!line.isCorrect && <span className="text-red-500 mr-1">✗</span>}
                                        {line.text}
                                    </div>
                                ))}
                                
                                {/* 正在打印的文字 */}
                                {isPrinting && (
                                    <div 
                                        className="py-1 text-lg text-amber-700"
                                        style={{ 
                                            fontFamily: '"Courier Prime", Courier, monospace',
                                            lineHeight: '28px'
                                        }}
                                    >
                                        <span className="text-gray-400 text-xs mr-2">[--:--]</span>
                                        <span className="animate-pulse">⚡</span>
                                        {printingText.slice(0, printingIndex)}
                                        <span className="inline-block w-2 h-5 bg-amber-600 animate-pulse ml-0.5" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 成功提示 */}
                {showSuccess && (
                    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                        <div className="bg-green-500 text-white px-8 py-4 rounded-2xl text-2xl font-bold shadow-2xl animate-bounce">
                            ✨ 完美！太棒了！✨
                        </div>
                    </div>
                )}
            </div>

            {/* 底部装饰 */}
            <div className="text-center py-4 text-amber-900/40 text-xs tracking-widest">
                皇家电报公司 • 创立于 1844
            </div>
        </div>
    );
};
