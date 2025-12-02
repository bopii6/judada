import { useState, useEffect } from "react";
import { X, Volume2, Monitor, User, Info, Keyboard, Check, ChevronRight, Play, Mic } from "lucide-react";
import classNames from "classnames";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { speak, useVoices } from "../hooks/useTTS";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabId = 'input' | 'sound' | 'display' | 'account' | 'about';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'input', label: '输入设置', icon: Keyboard },
    { id: 'sound', label: '音效设置', icon: Volume2 },
    { id: 'display', label: '显示设置', icon: Monitor },
    { id: 'account', label: '个人资料', icon: User },
    { id: 'about', label: '关于我们', icon: Info },
];

const VOICE_KEY = "judada:voice";

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const [activeTab, setActiveTab] = useState<TabId>('input');
    const { theme, setTheme } = useTheme();
    const { getUserDisplayName, getUserAvatar } = useAuth();
    const voices = useVoices();

    // Settings States
    const [voiceUri, setVoiceUri] = useState<string | null>(() => localStorage.getItem(VOICE_KEY));
    const [isPlaying, setIsPlaying] = useState(false);
    const [isTextBoxMode, setIsTextBoxMode] = useState(false);
    const [ignoreCase, setIgnoreCase] = useState(true);
    const [typingDelay, setTypingDelay] = useState(0);

    useEffect(() => {
        if (voiceUri) {
            localStorage.setItem(VOICE_KEY, voiceUri);
        }
    }, [voiceUri]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const previewVoice = () => {
        const voice = voices.find(item => item.voiceURI === voiceUri);
        setIsPlaying(true);
        speak("Hello, let's practice English together!", { voice });
        setTimeout(() => setIsPlaying(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-5xl h-[85vh] max-h-[800px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">

                {/* Close Button (Mobile) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 md:hidden z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Sidebar */}
                <div className="w-full md:w-72 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 p-6 flex flex-col">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-8 px-2">设置</h2>

                    <nav className="space-y-1 flex-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={classNames(
                                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200",
                                    activeTab === tab.id
                                        ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                                )}
                            >
                                <tab.icon className={classNames("w-5 h-5", activeTab === tab.id ? "text-orange-500" : "text-slate-400")} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold">
                                JE
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase">Current Version</div>
                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">v2.4.0</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 relative">
                    {/* Close Button (Desktop) */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors hidden md:flex"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="p-8 md:p-12 max-w-3xl">
                        {/* Header */}
                        <div className="mb-10">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                {TABS.find(t => t.id === activeTab)?.label}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400">
                                {activeTab === 'input' && "自定义你的打字体验和输入习惯"}
                                {activeTab === 'sound' && "调整语音朗读和音效反馈"}
                                {activeTab === 'display' && "个性化界面外观和主题"}
                                {activeTab === 'account' && "管理个人信息和账户安全"}
                                {activeTab === 'about' && "了解更多关于 Jude English 的信息"}
                            </p>
                        </div>

                        {/* Content Body */}
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* INPUT SETTINGS */}
                            {activeTab === 'input' && (
                                <>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-lg">是否使用文本框输入模式</div>
                                                <div className="text-sm text-slate-500 mt-1">关闭开关使用默认模式，打开后使用文本框输入模式</div>
                                            </div>
                                            <button
                                                onClick={() => setIsTextBoxMode(!isTextBoxMode)}
                                                className={classNames(
                                                    "w-14 h-8 rounded-full transition-colors relative",
                                                    isTextBoxMode ? "bg-orange-500" : "bg-slate-200 dark:bg-slate-700"
                                                )}
                                            >
                                                <div className={classNames(
                                                    "absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                                                    isTextBoxMode ? "left-[calc(100%-1.75rem)]" : "left-1"
                                                )} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-lg">是否忽略大小写</div>
                                                <div className="text-sm text-slate-500 mt-1">开启后，输入时不区分大小写，如输入"hello"和"Hello"都会被认为是正确的</div>
                                            </div>
                                            <button
                                                onClick={() => setIgnoreCase(!ignoreCase)}
                                                className={classNames(
                                                    "w-14 h-8 rounded-full transition-colors relative",
                                                    ignoreCase ? "bg-orange-500" : "bg-slate-200 dark:bg-slate-700"
                                                )}
                                            >
                                                <div className={classNames(
                                                    "absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                                                    ignoreCase ? "left-[calc(100%-1.75rem)]" : "left-1"
                                                )} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-lg mb-1">打字延迟</div>
                                            <div className="text-sm text-slate-500">每打完一个单词后增加延迟时间，让您有时间查看输入的单词。注意，这可能会影响对打字速度的计算</div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.1"
                                                    value={typingDelay}
                                                    onChange={(e) => setTypingDelay(parseFloat(e.target.value))}
                                                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                                />
                                                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 w-12 text-right">{typingDelay}s</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* SOUND SETTINGS */}
                            {activeTab === 'sound' && (
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <label className="block font-bold text-slate-900 dark:text-white text-lg">语音引擎</label>
                                        <div className="relative">
                                            <select
                                                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-4 pr-10 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                                value={voiceUri ?? ''}
                                                onChange={event => setVoiceUri(event.target.value || null)}
                                            >
                                                <option value="">系统默认语音</option>
                                                {voices.map(voice => (
                                                    <option key={voice.voiceURI} value={voice.voiceURI}>
                                                        {voice.name} ({voice.lang})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none rotate-90" />
                                        </div>

                                        <button
                                            onClick={previewVoice}
                                            disabled={isPlaying}
                                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-200 dark:shadow-none"
                                        >
                                            {isPlaying ? (
                                                <>
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                                                    </span>
                                                    播放中...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4 fill-current" />
                                                    试听语音
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* DISPLAY SETTINGS */}
                            {activeTab === 'display' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={classNames(
                                            "relative group p-6 rounded-2xl border-2 transition-all duration-200 text-left",
                                            theme === 'light'
                                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                                                : "border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 bg-white dark:bg-slate-800"
                                        )}
                                    >
                                        <div className="w-full aspect-video rounded-lg bg-slate-100 mb-4 border border-slate-200 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-white flex items-center justify-center">
                                                <div className="w-3/4 h-3/4 bg-slate-50 rounded shadow-sm border border-slate-100"></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="font-bold text-slate-900 dark:text-white">浅色模式</div>
                                            {theme === 'light' && <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={classNames(
                                            "relative group p-6 rounded-2xl border-2 transition-all duration-200 text-left",
                                            theme === 'dark'
                                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                                                : "border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 bg-white dark:bg-slate-800"
                                        )}
                                    >
                                        <div className="w-full aspect-video rounded-lg bg-slate-900 mb-4 border border-slate-800 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                                                <div className="w-3/4 h-3/4 bg-slate-900 rounded shadow-sm border border-slate-800"></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="font-bold text-slate-900 dark:text-white">深色模式</div>
                                            {theme === 'dark' && <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* ACCOUNT SETTINGS */}
                            {activeTab === 'account' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                        <img
                                            src={getUserAvatar()}
                                            alt={getUserDisplayName()}
                                            className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-700"
                                        />
                                        <div>
                                            <h4 className="text-xl font-bold text-slate-900 dark:text-white">{getUserDisplayName()}</h4>
                                            <p className="text-slate-500 dark:text-slate-400">user@example.com</p>
                                            <button className="mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                                更换头像
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <button className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">修改密码</span>
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        </button>
                                        <button className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">绑定手机</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-400">138****8888</span>
                                                <ChevronRight className="w-5 h-5 text-slate-400" />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ABOUT SETTINGS */}
                            {activeTab === 'about' && (
                                <div className="text-center py-10">
                                    <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl mx-auto flex items-center justify-center mb-6">
                                        <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">JE</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Jude English</h3>
                                    <p className="text-slate-500 mb-8">Learning Studio v2.4.0</p>

                                    <div className="flex justify-center gap-4">
                                        <a href="#" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">服务条款</a>
                                        <span className="text-slate-300">|</span>
                                        <a href="#" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">隐私政策</a>
                                        <span className="text-slate-300">|</span>
                                        <a href="#" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">联系我们</a>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
