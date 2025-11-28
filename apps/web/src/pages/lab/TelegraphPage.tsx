import React, { useState, useRef } from 'react';
import { useSoundEffects } from '../../hooks/useSoundEffects';

// 世界城市数据 - 包含丰富的文化信息
const WORLD_CITIES = [
    { 
        id: 'london',
        name: '伦敦', 
        nameEn: 'London', 
        country: '英国',
        countryEn: 'UK',
        flag: '🇬🇧', 
        icon: '🏰',
        landmark: '大本钟',
        landmarkEn: 'Big Ben',
        bgColor: 'from-slate-700 to-slate-900',
        funFact: '大本钟其实是钟的名字，不是塔的名字！塔叫伊丽莎白塔。',
        weather: '☔',
        sentences: [
            { en: "It often rains in London.", cn: "伦敦经常下雨。" },
            { en: "Big Ben is very famous.", cn: "大本钟非常有名。" },
            { en: "I love British tea.", cn: "我喜欢英国茶。" },
        ]
    },
    { 
        id: 'paris',
        name: '巴黎', 
        nameEn: 'Paris', 
        country: '法国',
        countryEn: 'France',
        flag: '🇫🇷', 
        icon: '🗼',
        landmark: '埃菲尔铁塔',
        landmarkEn: 'Eiffel Tower',
        bgColor: 'from-blue-800 to-indigo-900',
        funFact: '埃菲尔铁塔每7年要刷一次漆，需要60吨油漆！',
        weather: '🌤️',
        sentences: [
            { en: "The Eiffel Tower is beautiful.", cn: "埃菲尔铁塔很美丽。" },
            { en: "French food is delicious.", cn: "法国菜很好吃。" },
            { en: "Bonjour means hello.", cn: "Bonjour是你好的意思。" },
        ]
    },
    { 
        id: 'newyork',
        name: '纽约', 
        nameEn: 'New York', 
        country: '美国',
        countryEn: 'USA',
        flag: '🇺🇸', 
        icon: '🗽',
        landmark: '自由女神像',
        landmarkEn: 'Statue of Liberty',
        bgColor: 'from-amber-700 to-orange-900',
        funFact: '自由女神像是法国送给美国的礼物，代表自由和友谊！',
        weather: '🌆',
        sentences: [
            { en: "New York never sleeps.", cn: "纽约是不夜城。" },
            { en: "I want to see Broadway.", cn: "我想看百老汇演出。" },
            { en: "The pizza here is great.", cn: "这里的披萨很棒。" },
        ]
    },
    { 
        id: 'tokyo',
        name: '东京', 
        nameEn: 'Tokyo', 
        country: '日本',
        countryEn: 'Japan',
        flag: '🇯🇵', 
        icon: '🗾',
        landmark: '东京塔',
        landmarkEn: 'Tokyo Tower',
        bgColor: 'from-pink-700 to-rose-900',
        funFact: '日本有超过5百万台自动贩卖机，平均每23人就有一台！',
        weather: '🌸',
        sentences: [
            { en: "Cherry blossoms are pretty.", cn: "樱花很漂亮。" },
            { en: "Sushi is from Japan.", cn: "寿司来自日本。" },
            { en: "I like anime very much.", cn: "我非常喜欢动漫。" },
        ]
    },
    { 
        id: 'sydney',
        name: '悉尼', 
        nameEn: 'Sydney', 
        country: '澳大利亚',
        countryEn: 'Australia',
        flag: '🇦🇺', 
        icon: '🦘',
        landmark: '悉尼歌剧院',
        landmarkEn: 'Sydney Opera House',
        bgColor: 'from-cyan-700 to-teal-900',
        funFact: '澳大利亚的袋鼠数量比人还多！大约有5000万只袋鼠。',
        weather: '☀️',
        sentences: [
            { en: "Kangaroos live in Australia.", cn: "袋鼠生活在澳大利亚。" },
            { en: "The Opera House is amazing.", cn: "歌剧院太壮观了。" },
            { en: "I want to see koalas.", cn: "我想看考拉。" },
        ]
    },
    { 
        id: 'cairo',
        name: '开罗', 
        nameEn: 'Cairo', 
        country: '埃及',
        countryEn: 'Egypt',
        flag: '🇪🇬', 
        icon: '🏛️',
        landmark: '金字塔',
        landmarkEn: 'Pyramids',
        bgColor: 'from-yellow-700 to-amber-900',
        funFact: '金字塔建造于4500年前，比中国长城还要古老2000年！',
        weather: '🏜️',
        sentences: [
            { en: "The pyramids are very old.", cn: "金字塔非常古老。" },
            { en: "Egypt has a long history.", cn: "埃及有悠久的历史。" },
            { en: "The Nile River is important.", cn: "尼罗河很重要。" },
        ]
    },
    { 
        id: 'rio',
        name: '里约', 
        nameEn: 'Rio de Janeiro', 
        country: '巴西',
        countryEn: 'Brazil',
        flag: '🇧🇷', 
        icon: '⛱️',
        landmark: '基督像',
        landmarkEn: 'Christ the Redeemer',
        bgColor: 'from-green-700 to-emerald-900',
        funFact: '里约热内卢的狂欢节是世界上最大的派对，每年有200万人参加！',
        weather: '🌴',
        sentences: [
            { en: "Brazil loves football.", cn: "巴西人热爱足球。" },
            { en: "The carnival is so fun.", cn: "狂欢节太有趣了。" },
            { en: "The beach is beautiful.", cn: "海滩很美丽。" },
        ]
    },
    { 
        id: 'beijing',
        name: '北京', 
        nameEn: 'Beijing', 
        country: '中国',
        countryEn: 'China',
        flag: '🇨🇳', 
        icon: '🏯',
        landmark: '长城',
        landmarkEn: 'Great Wall',
        bgColor: 'from-red-700 to-red-900',
        funFact: '长城全长超过2万公里，是世界上最长的建筑！',
        weather: '🍂',
        sentences: [
            { en: "The Great Wall is long.", cn: "长城很长。" },
            { en: "Beijing duck is yummy.", cn: "北京烤鸭很好吃。" },
            { en: "I love Chinese culture.", cn: "我喜欢中国文化。" },
        ]
    },
];

// 电报员等级
const RANKS = [
    { name: '见习探索家', minCities: 0, badge: '🔰', color: '#9ca3af', title: '刚刚启程' },
    { name: '初级探索家', minCities: 2, badge: '🌱', color: '#22c55e', title: '崭露头角' },
    { name: '环球旅行者', minCities: 4, badge: '✈️', color: '#3b82f6', title: '见多识广' },
    { name: '世界通讯官', minCities: 6, badge: '🌍', color: '#a855f7', title: '博学多闻' },
    { name: '首席外交官', minCities: 8, badge: '👑', color: '#f59e0b', title: '环游世界' },
];

export const TelegraphPage = () => {
    const [currentCityIndex, setCurrentCityIndex] = useState(0);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [typedText, setTypedText] = useState('');
    const [visitedCities, setVisitedCities] = useState<Set<string>>(new Set());
    const [isPrinting, setIsPrinting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showFunFact, setShowFunFact] = useState(false);
    const [stats, setStats] = useState({ correct: 0, total: 0 });
    const [showShareModal, setShowShareModal] = useState(false);
    const [showWorldMap, setShowWorldMap] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const { playTypewriterKey, playTypewriterDing, playSuccess, playError } = useSoundEffects();
    const inputRef = useRef<HTMLInputElement>(null);
    const shareCardRef = useRef<HTMLDivElement>(null);

    const currentCity = WORLD_CITIES[currentCityIndex];
    const currentSentence = currentCity.sentences[currentSentenceIndex];
    
    // 计算当前等级
    const getCurrentRank = () => {
        const cityCount = visitedCities.size;
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (cityCount >= RANKS[i].minCities) {
                return RANKS[i];
            }
        }
        return RANKS[0];
    };
    
    const currentRank = getCurrentRank();
    const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];

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

        // 模拟发送
        setTimeout(() => {
            playTypewriterDing();
            setIsPrinting(false);
            
            setStats(prev => ({
                correct: prev.correct + (isCorrect ? 1 : 0),
                total: prev.total + 1
            }));

            if (isCorrect) {
                playSuccess();
                // 标记城市已访问
                setVisitedCities(prev => new Set([...prev, currentCity.id]));
                setShowSuccess(true);
                
                // 显示有趣知识
                setTimeout(() => {
                    setShowSuccess(false);
                    setShowFunFact(true);
                }, 1500);
                
                // 3秒后切换到下一个
                setTimeout(() => {
                    setShowFunFact(false);
                    // 切换句子或城市
                    if (currentSentenceIndex < currentCity.sentences.length - 1) {
                        setCurrentSentenceIndex(prev => prev + 1);
                    } else {
                        setCurrentSentenceIndex(0);
                        setCurrentCityIndex(prev => (prev + 1) % WORLD_CITIES.length);
                    }
                }, 4500);
            } else {
                playError();
            }
        }, 800);

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
        if (visitedCities.size === 0) {
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
            link.download = `世界探索家证书-${new Date().toLocaleDateString()}.png`;
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

    return (
        <div className={`min-h-screen bg-gradient-to-br ${currentCity.bgColor} text-white overflow-hidden relative transition-all duration-1000`}>
            
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 text-8xl opacity-10 animate-pulse">{currentCity.icon}</div>
                <div className="absolute bottom-20 right-10 text-9xl opacity-5">{currentCity.flag}</div>
            </div>

            {/* 顶部状态栏 */}
            <div className="relative z-10 bg-black/20 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* 等级信息 */}
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                                style={{ 
                                    background: `linear-gradient(135deg, ${currentRank.color}40, ${currentRank.color}20)`,
                                    border: `2px solid ${currentRank.color}`,
                                    boxShadow: `0 0 20px ${currentRank.color}40`
                                }}
                            >
                                {currentRank.badge}
                            </div>
                            <div>
                                <div className="text-sm font-bold" style={{ color: currentRank.color }}>
                                    {currentRank.name}
                                </div>
                                <div className="text-xs text-white/60">
                                    已探索 {visitedCities.size}/{WORLD_CITIES.length} 个城市
                                </div>
                            </div>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowWorldMap(true)}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-all"
                            >
                                🗺️ 地图
                            </button>
                            <button
                                onClick={handleShare}
                                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    background: `linear-gradient(135deg, ${currentRank.color}, ${currentRank.color}cc)`,
                                    boxShadow: `0 4px 15px ${currentRank.color}40`
                                }}
                            >
                                📜 证书
                            </button>
                        </div>
                    </div>
                    
                    {/* 升级进度 */}
                    {nextRank && (
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-white/60 mb-1">
                                <span>探索 {nextRank.minCities} 个城市升级为 {nextRank.name}</span>
                                <span>{nextRank.minCities - visitedCities.size} 个城市</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ 
                                        width: `${(visitedCities.size / nextRank.minCities) * 100}%`,
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
                
                {/* 城市信息卡片 */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 mb-6 border border-white/20">
                    <div className="flex items-start gap-4">
                        {/* 城市图标 */}
                        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-5xl flex-shrink-0">
                            {currentCity.icon}
                        </div>
                        
                        {/* 城市信息 */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">{currentCity.flag}</span>
                                <span className="text-2xl font-bold">{currentCity.name}</span>
                                <span className="text-lg text-white/60">{currentCity.nameEn}</span>
                            </div>
                            <div className="text-sm text-white/70 mb-2">
                                {currentCity.country} · {currentCity.weather} · 🏛️ {currentCity.landmark}
                            </div>
                            <div className="text-xs bg-white/10 rounded-lg px-3 py-2 text-white/80">
                                💡 <span className="text-yellow-300">小知识：</span>{currentCity.funFact}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 电报卡片 */}
                <div className="bg-[#f5ecd7] rounded-2xl overflow-hidden shadow-2xl">
                    {/* 电报头部 */}
                    <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <span className="font-bold text-amber-100 tracking-wider">WORLD TELEGRAPH</span>
                        </div>
                        <div className="text-xs text-amber-200">
                            发往 {currentCity.nameEn}
                        </div>
                    </div>
                    
                    {/* 电报内容 */}
                    <div className="p-5">
                        <div className="mb-1 text-xs text-amber-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            请输入以下内容，发送电报到{currentCity.landmark}：
                        </div>
                        
                        {/* 英文句子 */}
                        <div 
                            className="text-xl md:text-2xl font-medium mb-3 leading-relaxed"
                            style={{ fontFamily: '"Courier Prime", monospace', color: '#2a1f14' }}
                        >
                            {currentSentence.en.split('').map((char, i) => {
                                const typedChar = typedText[i]?.toLowerCase();
                                const targetChar = char.toLowerCase();
                                let className = 'text-[#2a1f14]';
                                
                                if (i < typedText.length) {
                                    className = typedChar === targetChar 
                                        ? 'text-green-600 font-bold' 
                                        : 'text-red-500 bg-red-100 rounded';
                                } else if (i === typedText.length) {
                                    className = 'bg-yellow-300 text-[#2a1f14] rounded-sm px-0.5';
                                }
                                
                                return <span key={i} className={className}>{char}</span>;
                            })}
                        </div>
                        
                        {/* 中文翻译 */}
                        <div className="text-sm text-amber-700 mb-4 pb-3 border-b border-dashed border-amber-300">
                            💬 {currentSentence.cn}
                        </div>

                        {/* 输入框 */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={typedText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={isPrinting || showSuccess || showFunFact}
                            placeholder="在此输入英文..."
                            className={`
                                w-full px-4 py-3 rounded-xl text-lg
                                border-2 transition-all duration-200
                                focus:outline-none
                                ${inputStatus === 'idle' ? 'border-amber-300 bg-white' : ''}
                                ${inputStatus === 'correct' ? 'border-green-400 bg-green-50' : ''}
                                ${inputStatus === 'complete' ? 'border-green-500 bg-green-100 shadow-lg' : ''}
                                ${inputStatus === 'error' ? 'border-red-400 bg-red-50' : ''}
                            `}
                            style={{ fontFamily: '"Courier Prime", monospace', color: '#2a1f14' }}
                            autoFocus
                        />

                        {/* 发送按钮 */}
                        <button
                            onClick={handleSubmit}
                            disabled={isPrinting || !typedText.trim() || showSuccess || showFunFact}
                            className={`
                                w-full mt-4 py-3 rounded-xl font-bold text-base tracking-wider
                                transition-all duration-200
                                ${isPrinting || !typedText.trim() || showSuccess || showFunFact
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                                }
                            `}
                        >
                            {isPrinting ? '⚡ 发送中...' : `📤 发送电报到 ${currentCity.name}`}
                        </button>
                    </div>
                </div>

                {/* 已访问城市预览 */}
                {visitedCities.size > 0 && (
                    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                        <div className="text-sm text-white/70 mb-3">🌍 已探索的城市</div>
                        <div className="flex flex-wrap gap-2">
                            {WORLD_CITIES.filter(city => visitedCities.has(city.id)).map(city => (
                                <div 
                                    key={city.id}
                                    className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm"
                                >
                                    <span>{city.flag}</span>
                                    <span>{city.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 成功动画 */}
            {showSuccess && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
                    <div 
                        className="text-center px-8 py-6 rounded-3xl bg-white shadow-2xl"
                        style={{ animation: 'popIn 0.5s ease-out' }}
                    >
                        <div className="text-6xl mb-3">{currentCity.icon}</div>
                        <div className="text-2xl font-bold text-green-500 mb-2">电报发送成功！</div>
                        <div className="text-gray-600">
                            已送达 {currentCity.flag} {currentCity.landmark}
                        </div>
                    </div>
                </div>
            )}

            {/* 有趣知识弹窗 */}
            {showFunFact && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4">
                    <div 
                        className="max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl text-center"
                        style={{ animation: 'slideUp 0.5s ease-out' }}
                    >
                        <div className="text-5xl mb-4">{currentCity.icon}</div>
                        <div className="text-lg font-bold text-amber-600 mb-2">
                            💡 你知道吗？
                        </div>
                        <div className="text-gray-700 leading-relaxed mb-4">
                            {currentCity.funFact}
                        </div>
                        <div className="text-sm text-gray-400">
                            即将前往下一站...
                        </div>
                    </div>
                </div>
            )}

            {/* 世界地图弹窗 */}
            {showWorldMap && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowWorldMap(false)}>
                    <div className="max-w-lg w-full bg-[#1a2744] rounded-3xl p-6" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="text-2xl mb-2">🗺️ 世界探索地图</div>
                            <div className="text-sm text-gray-400">
                                已探索 {visitedCities.size}/{WORLD_CITIES.length} 个城市
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {WORLD_CITIES.map(city => {
                                const isVisited = visitedCities.has(city.id);
                                return (
                                    <div 
                                        key={city.id}
                                        className={`
                                            p-4 rounded-xl border-2 transition-all
                                            ${isVisited 
                                                ? 'bg-green-500/20 border-green-500/50' 
                                                : 'bg-white/5 border-white/10 opacity-50'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl">{city.icon}</span>
                                            <span className="text-lg">{city.flag}</span>
                                        </div>
                                        <div className="font-bold">{city.name}</div>
                                        <div className="text-xs text-gray-400">{city.country}</div>
                                        {isVisited && (
                                            <div className="text-xs text-green-400 mt-1">✓ 已探索</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <button
                            onClick={() => setShowWorldMap(false)}
                            className="w-full mt-6 py-3 rounded-xl bg-white/10 text-white font-medium"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}

            {/* 分享证书弹窗 */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
                    <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        
                        {/* 证书卡片 */}
                        <div 
                            ref={shareCardRef}
                            className="rounded-2xl overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f172a 100%)' }}
                        >
                            {/* 顶部装饰 */}
                            <div className="h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
                            
                            {/* 证书内容 */}
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <div className="text-5xl mb-3">{currentRank.badge}</div>
                                    <div className="text-2xl font-bold text-white mb-1">{currentRank.name}</div>
                                    <div className="text-sm text-gray-400">{currentRank.title}</div>
                                </div>

                                {/* 探索数据 */}
                                <div className="bg-white/5 rounded-xl p-4 mb-4">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-amber-400">{visitedCities.size}</div>
                                            <div className="text-xs text-gray-400">探索城市</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-green-400">{stats.correct}</div>
                                            <div className="text-xs text-gray-400">成功电报</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-blue-400">
                                                {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
                                            </div>
                                            <div className="text-xs text-gray-400">准确率</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 已访问城市 */}
                                <div className="mb-4">
                                    <div className="text-xs text-gray-400 mb-2 text-center">🌍 探索足迹</div>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {WORLD_CITIES.filter(city => visitedCities.has(city.id)).map(city => (
                                            <div key={city.id} className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 text-xs">
                                                <span>{city.flag}</span>
                                                <span>{city.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 底部 */}
                                <div className="text-center pt-4 border-t border-white/10">
                                    <div className="text-xs text-gray-500">{dateStr}</div>
                                    <div className="text-xs text-gray-400 mt-1">🌐 World Telegraph · 环游世界学英语</div>
                                </div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="flex-1 py-3 rounded-xl font-medium text-sm bg-white/10 text-white"
                            >
                                关闭
                            </button>
                            <button
                                onClick={saveShareImage}
                                disabled={isGeneratingImage}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                            >
                                {isGeneratingImage ? '生成中...' : '📸 保存证书'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes popIn {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slideUp {
                    0% { transform: translateY(50px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
