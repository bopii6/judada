import React, { useState, useRef, useEffect } from 'react';
import { useSoundEffects } from '../../hooks/useSoundEffects';

// 世界城市 - 电报发往的目的地
const WORLD_CITIES = [
    { name: '伦敦', nameEn: 'London', country: '英国', flag: '🇬🇧', icon: '🏰' },
    { name: '巴黎', nameEn: 'Paris', country: '法国', flag: '🇫🇷', icon: '🗼' },
    { name: '纽约', nameEn: 'New York', country: '美国', flag: '🇺🇸', icon: '🗽' },
    { name: '东京', nameEn: 'Tokyo', country: '日本', flag: '🇯🇵', icon: '🗾' },
    { name: '悉尼', nameEn: 'Sydney', country: '澳大利亚', flag: '🇦🇺', icon: '🦘' },
    { name: '开罗', nameEn: 'Cairo', country: '埃及', flag: '🇪🇬', icon: '🏛️' },
    { name: '里约', nameEn: 'Rio', country: '巴西', flag: '🇧🇷', icon: '⛱️' },
    { name: '北京', nameEn: 'Beijing', country: '中国', flag: '🇨🇳', icon: '🏯' },
];

// 电报员等级
const RANKS = [
    { name: '见习电报员', minMessages: 0, badge: '🔰', color: '#9ca3af' },
    { name: '初级电报员', minMessages: 5, badge: '⭐', color: '#fbbf24' },
    { name: '中级电报员', minMessages: 15, badge: '🌟', color: '#f59e0b' },
    { name: '高级电报员', minMessages: 30, badge: '💫', color: '#ef4444' },
    { name: '首席电报员', minMessages: 50, badge: '👑', color: '#8b5cf6' },
];

// 预设句子 - 模拟电报任务
const SAMPLE_SENTENCES = [
    { en: "Hello, how are you?", cn: "你好，你好吗？", mission: "问候任务" },
    { en: "The weather is nice today.", cn: "今天天气很好。", mission: "天气播报" },
    { en: "I am learning English.", cn: "我正在学英语。", mission: "学习汇报" },
    { en: "Thank you very much.", cn: "非常感谢你。", mission: "感谢信" },
    { en: "Nice to meet you.", cn: "很高兴认识你。", mission: "交友电报" },
    { en: "Have a wonderful day!", cn: "祝你有美好的一天！", mission: "祝福电报" },
    { en: "Can you help me?", cn: "你能帮我吗？", mission: "求助电报" },
    { en: "I love my family.", cn: "我爱我的家人。", mission: "家书电报" },
    { en: "What time is it?", cn: "现在几点了？", mission: "时间查询" },
    { en: "See you tomorrow!", cn: "明天见！", mission: "告别电报" },
];

export const TelegraphPage = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [typedText, setTypedText] = useState('');
    const [sentMessages, setSentMessages] = useState<Array<{ text: string; isCorrect: boolean; city: typeof WORLD_CITIES[0]; id: number }>>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printingText, setPrintingText] = useState('');
    const [printingIndex, setPrintingIndex] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [currentCity, setCurrentCity] = useState(WORLD_CITIES[0]);
    const [stats, setStats] = useState({ correct: 0, total: 0 });
    const [showShareModal, setShowShareModal] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [showCityAnimation, setShowCityAnimation] = useState(false);
    const { playTypewriterKey, playTypewriterDing, playSuccess, playError } = useSoundEffects();
    const inputRef = useRef<HTMLInputElement>(null);
    const shareCardRef = useRef<HTMLDivElement>(null);

    const currentSentence = SAMPLE_SENTENCES[currentIndex];
    
    // 计算当前等级
    const getCurrentRank = () => {
        const correctCount = stats.correct;
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (correctCount >= RANKS[i].minMessages) {
                return RANKS[i];
            }
        }
        return RANKS[0];
    };
    
    const currentRank = getCurrentRank();
    const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];

    // 打字效果
    useEffect(() => {
        if (isPrinting && printingIndex < printingText.length) {
            const timer = setTimeout(() => {
                playTypewriterKey();
                setPrintingIndex(prev => prev + 1);
            }, 50 + Math.random() * 30);
            return () => clearTimeout(timer);
        } else if (isPrinting && printingIndex >= printingText.length) {
            setTimeout(() => {
                playTypewriterDing();
                setIsPrinting(false);
                setPrintingText('');
                setPrintingIndex(0);
            }, 300);
        }
    }, [isPrinting, printingIndex, printingText, playTypewriterKey, playTypewriterDing]);

    const checkAnswer = () => {
        return typedText.trim().toLowerCase() === currentSentence.en.toLowerCase();
    };

    const getInputStatus = () => {
        if (!typedText) return 'idle';
        const target = currentSentence.en.toLowerCase();
        const typed = typedText.toLowerCase();
        if (target.startsWith(typed)) {
            return typed === target ? 'complete' : 'correct';
        }
        return 'error';
    };

    const handleSubmit = () => {
        if (isPrinting || !typedText.trim()) return;

        const isCorrect = checkAnswer();

        setIsPrinting(true);
        setPrintingText(typedText);
        setPrintingIndex(0);

        setStats(prev => ({
            correct: prev.correct + (isCorrect ? 1 : 0),
            total: prev.total + 1
        }));

        setTimeout(() => {
            setSentMessages(prev => {
                const newMessages = [...prev, { 
                    text: typedText, 
                    isCorrect, 
                    city: currentCity,
                    id: Date.now()
                }];
                return newMessages.slice(-5);
            });
            
            if (isCorrect) {
                playSuccess();
                setShowSuccess(true);
                setShowCityAnimation(true);
                
                setTimeout(() => {
                    setShowSuccess(false);
                    setShowCityAnimation(false);
                    // 切换到下一个城市和句子
                    const nextCityIndex = (WORLD_CITIES.indexOf(currentCity) + 1) % WORLD_CITIES.length;
                    setCurrentCity(WORLD_CITIES[nextCityIndex]);
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

    const handleShare = () => {
        if (stats.total === 0) {
            alert('先完成几个电报任务再分享吧~');
            return;
        }
        setShowShareModal(true);
    };

    const saveShareImage = async () => {
        if (!shareCardRef.current) return;
        setIsGeneratingImage(true);
        
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(shareCardRef.current, {
                scale: 2,
                backgroundColor: null,
                useCORS: true,
            });
            
            const link = document.createElement('a');
            link.download = `电报员证书-${new Date().toLocaleDateString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            alert('证书已保存！快去朋友圈分享吧~ 📸');
        } catch (error) {
            console.error('生成图片失败:', error);
            alert('保存失败，请重试~');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const inputStatus = getInputStatus();
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

    return (
        <div className="min-h-screen bg-[#0c1929] text-white overflow-hidden relative">
            {/* 背景装饰 - 世界地图网格 */}
            <div 
                className="absolute inset-0 opacity-5"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }}
            />
            
            {/* 顶部状态栏 */}
            <div className="relative z-10 bg-[#0a1525]/80 backdrop-blur-sm border-b border-[#1e3a5f]">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* 电报员等级 */}
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                                style={{ 
                                    background: `linear-gradient(135deg, ${currentRank.color}40, ${currentRank.color}20)`,
                                    border: `2px solid ${currentRank.color}`
                                }}
                            >
                                {currentRank.badge}
                            </div>
                            <div>
                                <div className="text-sm font-bold" style={{ color: currentRank.color }}>
                                    {currentRank.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                    已发送 {stats.correct} 封电报
                                </div>
                            </div>
                        </div>
                        
                        {/* 分享按钮 */}
                        <button
                            onClick={handleShare}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                            }}
                        >
                            📜 我的证书
                        </button>
                    </div>
                    
                    {/* 升级进度条 */}
                    {nextRank && (
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>距离 {nextRank.name}</span>
                                <span>{nextRank.minMessages - stats.correct} 封电报</span>
                            </div>
                            <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ 
                                        width: `${((stats.correct - currentRank.minMessages) / (nextRank.minMessages - currentRank.minMessages)) * 100}%`,
                                        background: `linear-gradient(90deg, ${currentRank.color}, ${nextRank.color})`
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
                
                {/* 目的地城市卡片 */}
                <div 
                    className={`mb-6 rounded-2xl p-4 transition-all duration-500 ${showCityAnimation ? 'scale-105' : ''}`}
                    style={{
                        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
                        border: '1px solid #2d5a87',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div 
                                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                                style={{
                                    background: 'linear-gradient(135deg, #2d5a87, #1e3a5f)',
                                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)'
                                }}
                            >
                                {currentCity.icon}
                            </div>
                            <div>
                                <div className="text-xs text-cyan-400 mb-1">📡 电报发往</div>
                                <div className="text-2xl font-bold text-white flex items-center gap-2">
                                    {currentCity.flag} {currentCity.name}
                                </div>
                                <div className="text-sm text-gray-400">{currentCity.nameEn}, {currentCity.country}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-400">任务类型</div>
                            <div className="text-sm font-medium text-amber-400">{currentSentence.mission}</div>
                        </div>
                    </div>
                </div>

                {/* 电报输入区 */}
                <div 
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: '#f5ecd7',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5)'
                    }}
                >
                    {/* 电报纸头部 */}
                    <div 
                        className="px-4 py-3 flex items-center justify-between"
                        style={{
                            background: 'linear-gradient(180deg, #c9a227 0%, #a07d1c 100%)',
                            borderBottom: '3px solid #8b6914'
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <span className="font-bold text-[#3d2a14] tracking-wider">ROYAL TELEGRAPH</span>
                        </div>
                        <div className="text-xs text-[#5c4a1f]">EST. 1844</div>
                    </div>
                    
                    {/* 电报内容区 */}
                    <div className="p-5">
                        {/* 参考句子 */}
                        <div className="mb-4">
                            <div className="text-xs text-[#8b7355] mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                请抄写以下电报内容：
                            </div>
                            <div 
                                className="text-xl md:text-2xl font-medium leading-relaxed"
                                style={{ 
                                    fontFamily: '"Courier Prime", "Courier New", monospace',
                                    color: '#2a1f14'
                                }}
                            >
                                {currentSentence.en.split('').map((char, i) => {
                                    const typedChar = typedText[i]?.toLowerCase();
                                    const targetChar = char.toLowerCase();
                                    let style: React.CSSProperties = { color: '#2a1f14' };
                                    
                                    if (i < typedText.length) {
                                        style = typedChar === targetChar 
                                            ? { color: '#16a34a', fontWeight: 'bold' }
                                            : { color: '#dc2626', backgroundColor: '#fecaca', borderRadius: '2px', padding: '0 1px' };
                                    } else if (i === typedText.length) {
                                        style = { backgroundColor: '#fbbf24', color: '#2a1f14', padding: '0 2px', borderRadius: '2px' };
                                    }
                                    
                                    return <span key={i} style={style}>{char}</span>;
                                })}
                            </div>
                            <div className="text-sm text-[#6b5a45] mt-2 pt-2 border-t border-dashed border-[#c9b896]">
                                💬 {currentSentence.cn}
                            </div>
                        </div>

                        {/* 输入框 */}
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={typedText}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                disabled={isPrinting}
                                placeholder="在此输入电报内容..."
                                className={`
                                    w-full px-4 py-3 rounded-xl text-lg font-medium
                                    border-2 transition-all duration-200
                                    focus:outline-none
                                    ${inputStatus === 'idle' ? 'border-[#c9b896] bg-white focus:border-[#c9a227]' : ''}
                                    ${inputStatus === 'correct' ? 'border-green-400 bg-green-50' : ''}
                                    ${inputStatus === 'complete' ? 'border-green-500 bg-green-50 shadow-lg shadow-green-200' : ''}
                                    ${inputStatus === 'error' ? 'border-red-400 bg-red-50' : ''}
                                `}
                                style={{ 
                                    fontFamily: '"Courier Prime", "Courier New", monospace',
                                    color: '#2a1f14'
                                }}
                                autoFocus
                            />
                            
                            {/* 状态图标 */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">
                                {inputStatus === 'idle' && '✏️'}
                                {inputStatus === 'correct' && '👍'}
                                {inputStatus === 'complete' && <span className="animate-bounce inline-block">✅</span>}
                                {inputStatus === 'error' && '❌'}
                            </div>
                        </div>

                        {/* 发送按钮 */}
                        <button
                            onClick={handleSubmit}
                            disabled={isPrinting || !typedText.trim()}
                            className={`
                                w-full mt-4 py-3 rounded-xl font-bold text-base tracking-wider
                                transition-all duration-200 transform
                                ${isPrinting || !typedText.trim()
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#c9a227] to-[#a07d1c] text-[#2a1f14] shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                }
                            `}
                        >
                            {isPrinting ? '⚡ 发送中...' : `📤 发送电报到 ${currentCity.name}`}
                        </button>
                    </div>
                </div>

                {/* 已发送的电报记录 */}
                {sentMessages.length > 0 && (
                    <div className="mt-6">
                        <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                            <span>📋</span>
                            <span>发送记录</span>
                        </div>
                        <div className="space-y-2">
                            {[...sentMessages].reverse().map((msg) => (
                                <div 
                                    key={msg.id}
                                    className={`
                                        flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                                        ${msg.isCorrect 
                                            ? 'bg-green-500/10 border border-green-500/20' 
                                            : 'bg-red-500/10 border border-red-500/20'
                                        }
                                    `}
                                >
                                    <span className="text-lg">{msg.city.flag}</span>
                                    <span className={msg.isCorrect ? 'text-green-400' : 'text-red-400'}>
                                        {msg.isCorrect ? '✓' : '✗'}
                                    </span>
                                    <span className={`flex-1 ${msg.isCorrect ? 'text-gray-300' : 'text-red-300 line-through'}`}>
                                        {msg.text}
                                    </span>
                                    <span className="text-xs text-gray-500">→ {msg.city.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 成功动画 */}
            {showSuccess && (
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                    <div 
                        className="text-center px-8 py-6 rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            boxShadow: '0 20px 60px rgba(16, 185, 129, 0.4)',
                            animation: 'successPop 0.5s ease-out'
                        }}
                    >
                        <div className="text-5xl mb-2">🎉</div>
                        <div className="text-xl font-bold text-white">电报发送成功！</div>
                        <div className="text-sm text-green-200 mt-1">
                            已送达 {currentCity.flag} {currentCity.name}
                        </div>
                    </div>
                </div>
            )}

            {/* 分享弹窗 - 电报员证书 */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
                    <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        
                        {/* 证书卡片 */}
                        <div 
                            ref={shareCardRef}
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, #f5ecd7 0%, #e8dcc8 100%)',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
                            }}
                        >
                            {/* 金色边框装饰 */}
                            <div className="p-1" style={{ background: 'linear-gradient(135deg, #c9a227, #f4d03f, #c9a227)' }}>
                                <div className="bg-[#f5ecd7] rounded-xl p-5">
                                    
                                    {/* 证书头部 */}
                                    <div className="text-center border-b-2 border-dashed border-[#c9a227] pb-4 mb-4">
                                        <div className="text-4xl mb-2">📜</div>
                                        <h2 
                                            className="text-xl font-bold tracking-wider"
                                            style={{ 
                                                color: '#5c4a1f',
                                                fontFamily: 'Georgia, serif'
                                            }}
                                        >
                                            皇家电报局
                                        </h2>
                                        <div className="text-xs text-[#8b7355] mt-1">ROYAL TELEGRAPH OFFICE</div>
                                    </div>

                                    {/* 证书内容 */}
                                    <div className="text-center mb-4">
                                        <div className="text-sm text-[#6b5a45] mb-2">特此证明</div>
                                        <div 
                                            className="text-3xl mb-2"
                                            style={{ color: currentRank.color }}
                                        >
                                            {currentRank.badge}
                                        </div>
                                        <div 
                                            className="text-lg font-bold mb-1"
                                            style={{ color: currentRank.color }}
                                        >
                                            {currentRank.name}
                                        </div>
                                        <div className="text-xs text-[#8b7355]">
                                            于 {dateStr} 获得此称号
                                        </div>
                                    </div>

                                    {/* 统计数据 */}
                                    <div 
                                        className="grid grid-cols-3 gap-2 p-3 rounded-lg mb-4"
                                        style={{ background: 'rgba(201, 162, 39, 0.1)' }}
                                    >
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-[#5c4a1f]">{stats.total}</div>
                                            <div className="text-xs text-[#8b7355]">发送电报</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
                                            <div className="text-xs text-[#8b7355]">成功送达</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-[#c9a227]">{accuracy}%</div>
                                            <div className="text-xs text-[#8b7355]">准确率</div>
                                        </div>
                                    </div>

                                    {/* 访问过的城市 */}
                                    <div className="mb-4">
                                        <div className="text-xs text-[#6b5a45] mb-2 text-center">🌍 电报送达城市</div>
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {[...new Set(sentMessages.filter(m => m.isCorrect).map(m => m.city.flag))].map((flag, i) => (
                                                <span key={i} className="text-xl">{flag}</span>
                                            ))}
                                            {sentMessages.filter(m => m.isCorrect).length === 0 && (
                                                <span className="text-xs text-[#8b7355]">继续努力，环游世界！</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 印章 */}
                                    <div className="flex justify-between items-end">
                                        <div className="text-xs text-[#8b7355]">
                                            证书编号：RT{Date.now().toString().slice(-6)}
                                        </div>
                                        <div 
                                            className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold rotate-[-15deg]"
                                            style={{
                                                border: '3px solid #c9a227',
                                                color: '#c9a227'
                                            }}
                                        >
                                            ROYAL<br/>SEAL
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="flex-1 py-3 rounded-xl font-medium text-sm bg-white/10 text-white border border-white/20"
                            >
                                关闭
                            </button>
                            <button
                                onClick={saveShareImage}
                                disabled={isGeneratingImage}
                                className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
                                style={{
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                                }}
                            >
                                {isGeneratingImage ? '生成中...' : '📸 保存证书'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes successPop {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
