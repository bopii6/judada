export interface Word {
    time: number;
    duration: number;
    text: string;
    hint: string;
    guide: string;
}

export interface Phrase {
    start: number;
    end: number;
    en: string;
    zh: string;
    tip: string;
}

export interface Song {
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    bpm: number;
    duration: number;
    words: Word[];
    phrases: Phrase[];
    gapOptions: Record<number, string[]>;
}

export const SONGS: Song[] = [
    {
        id: "baby-shark",
        title: "Baby Shark",
        artist: "Pinkfong",
        audioUrl: "/baby-shark-vocals.mp3",
        bpm: 95,
        duration: 119000,
        words: [
            { time: 8200, duration: 900, text: "Baby", hint: "宝贝", guide: "bay-bee" },
            { time: 9500, duration: 900, text: "shark", hint: "鲨鱼", guide: "shark" },
            { time: 20200, duration: 900, text: "Sister", hint: "姐姐", guide: "sis-ter" },
            { time: 21400, duration: 900, text: "shark", hint: "鲨鱼", guide: "shark" },
            { time: 32200, duration: 900, text: "Brother", hint: "哥哥", guide: "bruh-ther" },
            { time: 33400, duration: 900, text: "shark", hint: "鲨鱼", guide: "shark" },
            { time: 44200, duration: 900, text: "Mommy", hint: "妈妈", guide: "mah-mee" },
            { time: 45400, duration: 900, text: "shark", hint: "鲨鱼", guide: "shark" },
            { time: 56200, duration: 900, text: "Daddy", hint: "爸爸", guide: "da-dee" },
            { time: 57400, duration: 900, text: "shark", hint: "鲨鱼", guide: "shark" },
            { time: 68200, duration: 900, text: "Grandma", hint: "奶奶", guide: "gran-ma" },
            { time: 79400, duration: 900, text: "Grandpa", hint: "爷爷", guide: "gran-pa" },
            { time: 90400, duration: 900, text: "Let's", hint: "我们", guide: "lets" },
            { time: 91600, duration: 900, text: "hunt", hint: "打猎", guide: "hunt" },
            { time: 102400, duration: 900, text: "Run", hint: "赶紧跑", guide: "run" },
            { time: 103800, duration: 900, text: "away", hint: "离开", guide: "uh-way" },
            { time: 112400, duration: 900, text: "Safe", hint: "安全", guide: "safe" },
            { time: 113800, duration: 900, text: "last", hint: "终于", guide: "last" },
            { time: 118200, duration: 900, text: "end", hint: "结束", guide: "end" }
        ],
        phrases: [
            {
                start: 8000,
                end: 20000,
                en: "Baby shark, doo doo doo doo doo doo",
                zh: "宝贝小鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "baby 的 /b/ 要送气，shark 记得卷舌"
            },
            {
                start: 20000,
                end: 32000,
                en: "Sister shark, doo doo doo doo doo doo",
                zh: "姐姐鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "sister 开头 /s/ 咬住，末尾 /ər/ 要轻读"
            },
            {
                start: 32000,
                end: 44000,
                en: "Brother shark, doo doo doo doo doo doo",
                zh: "哥哥鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "brother 中间的 th 发 /ð/，舌尖轻触上齿"
            },
            {
                start: 44000,
                end: 56000,
                en: "Mommy shark, doo doo doo doo doo doo",
                zh: "妈妈鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "mommy 的 o 要圆唇，结尾 y 轻点一下"
            },
            {
                start: 56000,
                end: 68000,
                en: "Daddy shark, doo doo doo doo doo doo",
                zh: "爸爸鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "daddy 的两个 /d/ 要干净利落"
            },
            {
                start: 68000,
                end: 80000,
                en: "Grandma shark, doo doo doo doo doo doo",
                zh: "奶奶鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "grandma 可读成 /grændmə/，尾音轻化"
            },
            {
                start: 80000,
                end: 92000,
                en: "Grandpa shark, doo doo doo doo doo doo",
                zh: "爷爷鲨鱼，嘟嘟嘟嘟嘟嘟",
                tip: "grandpa 的 /p/ 要爆破清晰"
            },
            {
                start: 92000,
                end: 104000,
                en: "Let's go hunt, doo doo doo doo doo doo",
                zh: "一起去打猎，嘟嘟嘟嘟嘟嘟",
                tip: "let's go 连读 /letsgoʊ/"
            },
            {
                start: 104000,
                end: 112000,
                en: "Run away, doo doo doo doo doo doo",
                zh: "赶紧逃跑，嘟嘟嘟嘟嘟嘟",
                tip: "run away 连读 /rʌnəˈweɪ/"
            },
            {
                start: 112000,
                end: 118000,
                en: "Safe at last, doo doo doo doo doo doo",
                zh: "终于安全啦，嘟嘟嘟嘟嘟嘟",
                tip: "safe at 连起来读 /seɪfæt/"
            },
            {
                start: 118000,
                end: 119000,
                en: "It's the end, doo doo doo doo doo doo",
                zh: "故事结束啦，嘟嘟嘟嘟嘟嘟",
                tip: "the 在句首读 /ðə/"
            }
        ],
        gapOptions: {
            1: ["shark", "shell", "ship"],
            10: ["fast", "last", "fact"]
        }
    }
];
