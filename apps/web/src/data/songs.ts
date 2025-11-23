import type { MusicTrackDetail } from "@judada/shared";

export const SAMPLE_TRACK: MusicTrackDetail = {
  id: "sample-baby-shark",
  slug: "baby-shark",
  title: "Baby Shark",
  titleCn: "宝贝鲨鱼",
  artist: "Pinkfong",
  coverUrl: "https://images.unsplash.com/photo-1551244072-5d12893278ab?q=80&w=1000&auto=format&fit=crop",
  description: "示例歌曲，用于在后台没有音频时展示体验效果。",

  durationMs: 119000,
  status: "published",
  audioUrl: "/baby-shark-vocals.mp3",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  publishedAt: "2024-01-01T00:00:00.000Z",
  metadata: null,
  words: [],
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
      end: 33000,
      en: "Sister shark, doo doo doo doo doo doo",
      zh: "姐姐鲨鱼，嘟嘟嘟嘟嘟嘟",
      tip: "sister 开头 /s/ 咬住，结尾 /ər/ 要轻读"
    },
    {
      start: 33000,
      end: 46000,
      en: "Brother shark, doo doo doo doo doo doo",
      zh: "哥哥鲨鱼，嘟嘟嘟嘟嘟嘟",
      tip: "brother 中间的 th 发 /ð/，舌尖轻触上齿"
    },
    {
      start: 46000,
      end: 59000,
      en: "Mommy shark, doo doo doo doo doo doo",
      zh: "妈妈鲨鱼，嘟嘟嘟嘟嘟嘟",
      tip: "mommy 的 o 要圆唇，结尾 y 轻点一下"
    },
    {
      start: 59000,
      end: 68000,
      en: "Daddy shark, doo doo doo doo doo doo",
      zh: "爸爸鲨鱼，嘟嘟嘟嘟嘟嘟",
      tip: "daddy 的两个 /d/ 要干净利落"
    },
    {
      start: 70000,
      end: 80000,
      en: "Let's go hunt, doo doo doo doo doo doo",
      zh: "一起去打猎，嘟嘟嘟嘟嘟嘟",
      tip: "let's go 连读成 /letsgoʊ/"
    },
    {
      start: 82000,
      end: 92000,
      en: "Run away, doo doo doo doo doo doo",
      zh: "赶紧逃跑，嘟嘟嘟嘟嘟嘟",
      tip: "run away 连读 /rʌnəˈweɪ/"
    },
    {
      start: 96000,
      end: 104000,
      en: "Safe at last, doo doo doo doo doo doo",
      zh: "终于安全啦，嘟嘟嘟嘟嘟嘟",
      tip: "safe at 连起来读 /seɪfæt/"
    },
    {
      start: 108000,
      end: 119000,
      en: "It's the end, doo doo doo doo doo doo",
      zh: "故事结束啦，嘟嘟嘟嘟嘟嘟",
      tip: "the 在句首读 /ðə/"
    }
  ],

};
