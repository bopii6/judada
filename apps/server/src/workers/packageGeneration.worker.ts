import { LessonItemType, Prisma } from "@prisma/client";
import type { Job } from "bullmq";
import pdf from "pdf-parse";

import { getEnv } from "../config/env";
import { PACKAGE_GENERATION_QUEUE, PackageGenerationJobData } from "../jobs/packageGeneration.queue";
import { recognizeImagesBatch } from "../lib/ocr";
import { getPrisma } from "../lib/prisma";
import { createWorker } from "../lib/queue";
import { getSupabase } from "../lib/supabase";
import { batchTranslate } from "../lib/translation";
import { generationJobRepository } from "../repositories/generationJob.repository";

const prisma = getPrisma();
const supabase = getSupabase();

const { SUPABASE_STORAGE_BUCKET } = getEnv();

const LESSON_ITEM_TYPES: LessonItemType[] = [
  "vocabulary",
  "phrase",
  "sentence",
  "dialogue",
  "quiz_single_choice",
  "quiz_multiple_choice",
  "fill_blank",
  "reorder",
  "listening",
  "speaking",
  "writing",
  "custom"
];

const DEFAULT_ENGLISH_SENTENCES = [
  "Hello, how are you today?",
  "I am a student.",
  "What is your name?",
  "My name is Tom.",
  "Where do you live?",
  "I live in China.",
  "Do you like English?",
  "Yes, I like English very much.",
  "What time is it now?",
  "It is ten o'clock.",
  "Can you help me?",
  "Of course, I can help you.",
  "Thank you very much.",
  "You are welcome.",
  "See you tomorrow."
];

const SENTENCE_ROUND_COUNT = 4;
const SENTENCE_PER_ROUND = 16;
const MAX_SENTENCE_CANDIDATES = 400;

type AllowedLessonItemType = `${LessonItemType}`;

interface GeneratedLessonItemPlan {
  type: AllowedLessonItemType;
  title?: string;
  prompt?: string;
  payload: Record<string, unknown>;
}

interface MaterialExtraction {
  materialId: string;
  order: number;
  originalName: string;
  sourceType: "image" | "pdf" | "fallback";
  ocrText: string;
  sentences: string[];
  targetLessonCount?: number | null;
  metadata?: Record<string, unknown>;
  pageNumbers: number[];
  fallbackOrder: number;
}

const cloneMetadata = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

const persistMaterialExtractionStats = async (materials: MaterialExtraction[]) => {
  const assetIds = materials
    .map(material => material.materialId)
    .filter((id): id is string => Boolean(id) && id !== "fallback");
  if (!assetIds.length) {
    return;
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } }
  });
  const assetMap = new Map(assets.map(asset => [asset.id, asset]));
  const timestamp = new Date().toISOString();

  await Promise.all(
    materials.map(async material => {
      if (!material.materialId || material.materialId === "fallback") {
        return;
      }
      const asset = assetMap.get(material.materialId);
      if (!asset) {
        return;
      }
      const metadata = cloneMetadata(asset.metadata);
      metadata.extractionStats = {
        sentenceCount: material.sentences.length,
        sampleSentences: material.sentences.slice(0, 3),
        lastExtractionAt: timestamp,
        ocrTextLength: material.ocrText.length,
        sourceType: material.sourceType
      };

      await prisma.asset.update({
        where: { id: asset.id },
        data: { metadata: metadata as any }
      });
    })
  );
};

const PAGE_NUMBER_METADATA_KEYS = [
  "pageNumber",
  "page",
  "page_index",
  "pageIndex",
  "pageNo",
  "page_no",
  "pageNum",
  "page_num"
];

const clampPageNumber = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value));
};

const extractPageNumbersFromMetadata = (
  metadata: Record<string, unknown> | undefined,
  fallbackName: string | undefined,
  fallbackOrder: number
): number[] => {
  const pages = new Set<number>();
  const pushNumericValue = (value: unknown) => {
    const numeric = parseNumericSetting(value);
    if (numeric !== null) {
      pages.add(clampPageNumber(numeric));
    }
  };

  if (metadata) {
    const lessonPages = metadata.lessonPages;
    if (Array.isArray(lessonPages)) {
      for (const item of lessonPages) {
        pushNumericValue(item);
      }
    }

    const rangeCandidate = metadata.pageRange;
    if (rangeCandidate && typeof rangeCandidate === "object") {
      const range = rangeCandidate as Record<string, unknown>;
      const start = parseNumericSetting(range.start);
      const end = parseNumericSetting(range.end);
      if (start !== null) {
        const safeEnd = end !== null ? end : start;
        const boundedEnd = Math.min(start + 31, safeEnd); // 避免一次性展开过多页码
        for (let page = start; page <= boundedEnd; page++) {
          pushNumericValue(page);
        }
      }
    }

    for (const key of PAGE_NUMBER_METADATA_KEYS) {
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        pushNumericValue(metadata[key]);
      }
    }

    const originalFileName = metadata.originalFileName;
    if (typeof originalFileName === "string") {
      const matches = originalFileName.match(/page[-_\s]*(\d{1,3})/i);
      if (matches?.[1]) {
        pushNumericValue(Number(matches[1]));
      }
    }
  }

  const targetName = fallbackName || (typeof metadata?.originalFileName === "string" ? (metadata.originalFileName as string) : undefined);
  if (targetName && pages.size === 0) {
    const pageMatch = targetName.match(/page[-_\s]*(\d{1,4})/i);
    if (pageMatch?.[1]) {
      pushNumericValue(Number(pageMatch[1]));
    } else {
      const digits = targetName.replace(/\.[^.]+$/, "").match(/(\d{1,4})$/);
      if (digits?.[1]) {
        pushNumericValue(Number(digits[1]));
      }
    }
  }

  if (pages.size === 0 && Number.isFinite(fallbackOrder)) {
    pushNumericValue(fallbackOrder + 1);
  }

  return Array.from(pages).sort((a, b) => a - b);
};

interface GeneratedLessonPlan {
  title: string;
  summary: string;
  difficulty: number;
  focus?: string[];
  items: GeneratedLessonItemPlan[];
  sourceMaterialId?: string;
  sourceMaterialName?: string;
  sourceMaterialIndex?: number;
  roundIndex: number;
  roundOrder: number;
}

interface GeneratedCoursePlan {
  packageSummary: string;
  lessons: GeneratedLessonPlan[];
}

interface SentenceCandidate {
  id: string;
  text: string;
  score: number;
  tokens: Set<string>;
  pageNumber: number;
  materialId: string;
  materialName: string;
  materialOrder: number;
}

interface SelectedSentence extends SentenceCandidate {
  roundIndex: number;
  roundOrder: number;
}

const clampDifficulty = (value: number | undefined | null): number | null => {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 1) return 1;
  if (value > 6) return 6;
  return Math.round(value);
};

const parseNumericSetting = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeLessonTarget = (value: number | null | undefined): number | null => {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_LESSONS_PER_MATERIAL) {
    return MIN_LESSONS_PER_MATERIAL;
  }
  if (rounded > MAX_LESSONS_PER_MATERIAL) {
    return MAX_LESSONS_PER_MATERIAL;
  }
  return rounded;
};

const extractLessonTargetFromMetadata = (metadata?: Record<string, unknown> | null): number | null => {
  if (!metadata) {
    return null;
  }
  const candidateKeys = [
    "lessonTargetCount",
    "lesson_target_count",
    "targetLessons",
    "targetLessonCount",
    "lessonGoal"
  ];
  for (const key of candidateKeys) {
    const numeric = parseNumericSetting(metadata[key]);
    if (numeric !== null) {
      return normalizeLessonTarget(numeric);
    }
  }
  return null;
};

const MIN_LESSONS_PER_MATERIAL = 3;
const MAX_LESSONS_PER_MATERIAL = 8;
const MAX_TOTAL_LESSONS = 80;

/**
 * 从OCR文本中提取英文句子
 */
const meetsMinimumSentenceRequirements = (wordCount: number, englishCharCount: number): boolean => {
  if (wordCount >= 3) {
    return true;
  }
  if (wordCount === 2) {
    return englishCharCount >= 6;
  }
  if (wordCount === 1) {
    return englishCharCount >= 4;
  }
  return false;
};

const extractEnglishSentences = (text: string, logContext?: { generationJobId?: string; logFn?: (msg: string, details?: any) => void }): string[] => {
  if (!text || !text.trim()) {
    if (logContext?.logFn) {
      logContext.logFn("extractEnglishSentences: 输入文本为空", { textLength: 0 });
    }
    return [];
  }
  
  const sentences: string[] = [];
  const seen = new Set<string>(); // 去重
  
  if (logContext?.logFn) {
    logContext.logFn("开始提取英文句子", { 
      textLength: text.length,
      textSample: text.substring(0, 500)
    });
  }
  
  // 方法1: 匹配英文句子：以大写字母开头，以句号/问号/感叹号结尾
  const englishSentenceRegex = /[A-Z][^.!?]*[.!?]/g;
  const matches = text.match(englishSentenceRegex);
  
  if (matches) {
    for (const match of matches) {
      const cleaned = match.trim().replace(/^["']|["']$/g, ''); // 移除首尾引号
      // 过滤掉太短或太长的句子
      if (cleaned.length >= 10 && cleaned.length <= 200) {
        // 确保主要是英文字符（至少60%是字母）
        const englishCharCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
        if (englishCharCount / cleaned.length > 0.6) {
          // 确保包含至少3个单词
          const wordCount = cleaned.split(/\s+/).filter(w => w.match(/[a-zA-Z]/)).length;
          if (meetsMinimumSentenceRequirements(wordCount, englishCharCount)) {
            pushSentenceCandidate(cleaned, sentences, seen);
          }
        }
      }
    }
  }
  
  // 方法2: 如果没有找到完整句子，尝试提取英文短语（3-10个单词）
  if (sentences.length < 10) {
    const normalizedForFragments = text.replace(/\r?\n{2,}/g, ". ");
    const fragmentRegex = /[^.!?]+[.!?]?/g;
    let fragmentMatch: RegExpExecArray | null;
    while ((fragmentMatch = fragmentRegex.exec(normalizedForFragments)) !== null) {
      const fragment = fragmentMatch[0].trim();
      if (!fragment) {
        continue;
      }
      const fragmentNoSpace = fragment.replace(/\s+/g, "");
      if (fragmentNoSpace.length < 4 || fragment.length > 180) {
        continue;
      }
      const englishCharCount = (fragment.match(/[a-zA-Z]/g) || []).length;
      if (!englishCharCount || englishCharCount / fragmentNoSpace.length <= 0.6) {
        continue;
      }
      const wordCount = fragment.split(/\s+/).filter(w => w.match(/[a-zA-Z]/)).length;
      if (!meetsMinimumSentenceRequirements(wordCount, englishCharCount)) {
        continue;
      }
      const ensuredFragment = /[.!?]$/.test(fragment) ? fragment : `${fragment}.`;
      pushSentenceCandidate(ensuredFragment, sentences, seen);
    }
  }
  
  // 方法3: 提取引号内的英文内容
  const quotedRegex = /["']([^"']{10,100})["']/g;
  let quotedMatch;
  while ((quotedMatch = quotedRegex.exec(text)) !== null && sentences.length < 50) {
    const quoted = quotedMatch[1].trim();
    const englishCharCount = (quoted.match(/[a-zA-Z]/g) || []).length;
    if (englishCharCount / quoted.length > 0.7) {
      pushSentenceCandidate(quoted, sentences, seen);
    }
  }
  
  const result = sentences.slice(0, 50); // 最多返回50个句子
  
  if (logContext?.logFn) {
    logContext.logFn("英文句子提取完成", {
      extractedCount: result.length,
      sampleSentences: result.slice(0, 5),
      method1Count: sentences.filter((_, i) => i < result.length && /[A-Z][^.!?]*[.!?]/.test(result[i])).length
    });
  }
  
  return result;
};

const sentenceStopWords = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "in",
  "on",
  "for",
  "to",
  "of",
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "with",
  "as",
  "by",
  "at",
  "from",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "them",
  "him",
  "her",
  "my",
  "your",
  "our",
  "their",
  "me",
  "us"
]);

const tokenizeSentence = (sentence: string): string[] =>
  sentence
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(token => token.length > 1 && !sentenceStopWords.has(token));

const buildTermFrequencyMap = (sentences: string[]): Map<string, number> => {
  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    const tokens = tokenizeSentence(sentence);
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return freq;
};

const verbIndicatorTokens = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "go",
  "goes",
  "went",
  "play",
  "plays",
  "played",
  "like",
  "likes",
  "liked",
  "eat",
  "eats",
  "ate",
  "drink",
  "drinks",
  "drank",
  "read",
  "reads",
  "clean",
  "cleans",
  "cleaned",
  "study",
  "studies",
  "studied",
  "start",
  "starts",
  "started",
  "finish",
  "finishes",
  "finished",
  "sleep",
  "sleeps",
  "slept",
  "work",
  "works",
  "worked",
  "do",
  "does",
  "did",
  "practice",
  "practices",
  "practiced",
  "watch",
  "watches",
  "watched",
  "write",
  "writes",
  "wrote",
  "cook",
  "cooks",
  "cooked"
]);

const dayNameTokens = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

const subjectLabelTokens = new Set([
  "art",
  "music",
  "english",
  "chinese",
  "math",
  "maths",
  "science",
  "computer",
  "pe",
  "sport",
  "sports",
  "writing",
  "reading",
  "drawing",
  "class",
  "classes",
  "words",
  "story",
  "stories",
  "breakfast",
  "lunch",
  "dinner",
  "week",
  "weekend"
]);

const headingKeywords = new Set(["unit", "lesson", "chapter", "section", "module", "part", "practice", "review"]);

const headingNumberTokens = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth"
]);

const runOnSentenceStarterTokens = new Set([
  "hello",
  "hi",
  "hey",
  "i",
  "im",
  "my",
  "we",
  "he",
  "she",
  "they",
  "it",
  "this",
  "that",
  "there",
  "let",
  "lets",
  "look",
  "listen",
  "can",
  "could",
  "do",
  "does",
  "did",
  "are",
  "is",
  "am",
  "please"
]);

const headingRomanNumeralRegex = /^[ivxlcdm]+$/i;

const sanitizeHeadingToken = (token: string): string =>
  token.replace(/^[^0-9a-z]+|[^0-9a-z]+$/gi, "").toLowerCase();

const normalizeRunOnToken = (token: string): string =>
  token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "").toLowerCase();

const looksLikeHeadingIndexToken = (token: string): boolean =>
  !!token && (headingNumberTokens.has(token) || /^\d+[a-z]?$/.test(token) || headingRomanNumeralRegex.test(token));

const tokenEndsSentence = (token: string): boolean => /[.!?]"?$/.test(token);

const splitRunOnSentence = (sentence: string): string[] => {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return [];
  }
  const tokens = trimmed.split(/\s+/);
  const segments: string[] = [];
  let current: string[] = [];

  const flushCurrent = () => {
    if (!current.length) return;
    const segment = current.join(" ").trim();
    if (segment) {
      segments.push(segment);
    }
    current = [];
  };

  for (const token of tokens) {
    const normalizedToken = normalizeRunOnToken(token);
    const rawAlphaToken = token.replace(/^[^a-zA-Z]+/, "");
    const startsWithUppercase = /^[A-Z]/.test(rawAlphaToken);
    if (
      current.length &&
      runOnSentenceStarterTokens.has(normalizedToken) &&
      !tokenEndsSentence(current[current.length - 1]) &&
      startsWithUppercase
    ) {
      flushCurrent();
      current.push(token);
      continue;
    }
    current.push(token);
  }

  flushCurrent();
  return segments.length ? segments : [trimmed];
};

const splitHeadingFromSentence = (sentence: string): string[] => {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const words = normalized.split(" ");
  if (words.length < 3) {
    return [trimmed];
  }

  const headingWord = sanitizeHeadingToken(words[0]);
  if (!headingKeywords.has(headingWord)) {
    return [trimmed];
  }

  let removalEnd = 1;
  for (let i = 1; i < Math.min(words.length, 4); i++) {
    const token = sanitizeHeadingToken(words[i]);
    if (!token) {
      continue;
    }
    if (looksLikeHeadingIndexToken(token)) {
      removalEnd = i + 1;
      continue;
    }
    break;
  }

  if (removalEnd === 1) {
    return [trimmed];
  }

  const rest = words.slice(removalEnd).join(" ").trim();
  if (!rest) {
    return [trimmed];
  }

  const restWordCount = rest.split(/\s+/).filter(word => /[a-zA-Z]/.test(word)).length;
  if (restWordCount < 3 && !/[.!?]/.test(rest)) {
    return [trimmed];
  }

  return [rest];
};

const pushSentenceCandidate = (sentence: string, collector: string[], dedup: Set<string>) => {
  for (const headingless of splitHeadingFromSentence(sentence)) {
    for (const candidate of splitRunOnSentence(headingless)) {
      const normalized = candidate.trim();
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (dedup.has(key)) {
        continue;
      }
      const ensured = tokenEndsSentence(normalized) ? normalized : `${normalized}.`;
      collector.push(ensured);
      dedup.add(key);
    }
  }
};

const labelPhraseIndicators = [
  "my week",
  "my day",
  "my class",
  "my unit",
  "let's try",
  "let's talk",
  "let's learn",
  "let's read",
  "let's write",
  "let's spell",
  "let's play",
  "listen and type",
  "listen and tick",
  "listen and circle",
  "ask and write",
  "ask and answer",
  "read and write",
  "read and tick",
  "read and say",
  "look and say",
  "look and read",
  "look and write"
];

const containsVerbLikeToken = (tokens: string[]): boolean =>
  tokens.some(token => verbIndicatorTokens.has(token) || token.endsWith("ing") || token.endsWith("ed"));

const tokensMatchLabelList = (tokens: string[]): boolean => {
  if (!tokens.length || tokens.length > 6) {
    return false;
  }
  return tokens.every(token => dayNameTokens.has(token) || subjectLabelTokens.has(token));
};

const isLikelyTitleOrLabel = (sentence: string, tokens: string[]): boolean => {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  const hasPunctuation = /[.?!]/.test(trimmed);
  const hasVerb = containsVerbLikeToken(tokens);
  const wordCount = tokens.length;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const uppercaseWords = words.filter(word => /^[A-Z]+$/.test(word));
  const firstToken = tokens[0];

  if (!hasPunctuation) {
    if (!hasVerb && wordCount <= 2) {
      return true;
    }
    if (
      !hasVerb &&
      uppercaseWords.length >= Math.max(1, words.length - 1) &&
      words.length <= 5
    ) {
      return true;
    }
    if (!hasVerb && firstToken && headingKeywords.has(firstToken)) {
      return true;
    }
    if (
      labelPhraseIndicators.some(phrase => lower === phrase || lower.startsWith(`${phrase} `))
    ) {
      return true;
    }
    if (!hasVerb && tokens.every(token => dayNameTokens.has(token) || /^\d+$/.test(token))) {
      return true;
    }
    if (!hasVerb && tokensMatchLabelList(tokens)) {
      return true;
    }
  }

  return false;
};

const scoreSentenceForImportance = (sentence: string, termFrequency: Map<string, number>): number => {
  const tokens = tokenizeSentence(sentence);
  if (tokens.length === 0) {
    return 0;
  }

  let score = tokens.reduce((sum, token) => sum + (termFrequency.get(token) ?? 0), 0);

  if (sentence.trim().endsWith("?")) {
    score += 2.5;
  }

  if (/[0-9]/.test(sentence)) {
    score += 1;
  }

  const uniqueTokenCount = new Set(tokens).size;
  if (uniqueTokenCount >= 3 && uniqueTokenCount <= 15) {
    score += 1.5;
  }

  if (/[,;]/.test(sentence)) {
    score += 0.5;
  }

  if (/(always|usually|often|sometimes|never|every)/i.test(sentence)) {
    score += 1;
  }

  if (/^(when|what|why|how|who|where)\b/i.test(sentence)) {
    score += 1.5;
  }

  return score;
};

const sentencesAreNearDuplicates = (tokensA: Set<string>, tokensB: Set<string>): boolean => {
  if (tokensA.size === 0 || tokensB.size === 0) {
    return false;
  }
  const smaller = tokensA.size < tokensB.size ? tokensA : tokensB;
  const larger = smaller === tokensA ? tokensB : tokensA;
  let intersection = 0;
  for (const token of smaller) {
    if (larger.has(token)) {
      intersection += 1;
    }
  }
  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) {
    return false;
  }
  return intersection / union >= 0.85;
};

const selectCoreSentences = (sentences: string[], limit = 50): string[] => {
  if (!sentences.length) {
    return [];
  }

  const termFrequency = buildTermFrequencyMap(sentences);
  const scored: Array<{ sentence: string; index: number; tokens: Set<string>; score: number }> = [];

  sentences.forEach((sentence, index) => {
    const rawTokens = tokenizeSentence(sentence);
    if (isLikelyTitleOrLabel(sentence, rawTokens)) {
      return;
    }
    scored.push({
      sentence,
      index,
      tokens: new Set(rawTokens),
      score: scoreSentenceForImportance(sentence, termFrequency)
    });
  });

  if (!scored.length) {
    return sentences.slice(0, Math.min(limit, sentences.length));
  }

  scored.sort((a, b) => {
    if (b.score === a.score) {
      return a.index - b.index;
    }
    return b.score - a.score;
  });

  const selected: typeof scored = [];
  const tryAdd = (candidate: (typeof scored)[number]) => {
    if (selected.length >= limit) {
      return;
    }
    if (selected.some(item => sentencesAreNearDuplicates(item.tokens, candidate.tokens))) {
      return;
    }
    selected.push(candidate);
  };

  for (const candidate of scored) {
    tryAdd(candidate);
    if (selected.length >= limit) {
      break;
    }
  }

  const selectedIndexes = new Set(selected.map(item => item.index));
  for (let i = 0; i < sentences.length && selected.length < limit; i++) {
    const sentence = sentences[i];
    if (!sentence.trim().endsWith("?")) {
      continue;
    }
    if (!selectedIndexes.has(i)) {
      const candidate = scored.find(item => item.index === i);
      if (candidate) {
        tryAdd(candidate);
        selectedIndexes.add(i);
      }
    }

    const answerIndex = i + 1;
    if (answerIndex < sentences.length && !selectedIndexes.has(answerIndex)) {
      const answerCandidate = scored.find(item => item.index === answerIndex);
      if (answerCandidate) {
        tryAdd(answerCandidate);
        selectedIndexes.add(answerIndex);
      }
    }
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence)
    .slice(0, limit);
};

const sanitizeSentenceText = (text: string): string => text.replace(/\s+/g, " ").replace(/\s([,.!?])/g, "$1").trim();

const ensurePageNumber = (material: MaterialExtraction): number => {
  if (material.pageNumbers && material.pageNumbers.length > 0) {
    return material.pageNumbers[0];
  }
  if (Number.isFinite(material.order)) {
    return material.order + 1;
  }
  return 1;
};

const MIN_SENTENCE_WORDS = 4;

const buildSentenceCandidatesFromMaterials = (
  materials: MaterialExtraction[],
  limit = MAX_SENTENCE_CANDIDATES
): SentenceCandidate[] => {
  const rawSentences: Array<{ sentence: string; material: MaterialExtraction }> = [];
  materials.forEach(material => {
    for (const sentence of material.sentences ?? []) {
      if (sentence && sentence.trim()) {
        rawSentences.push({ sentence, material });
      }
    }
  });

  if (!rawSentences.length) {
    return [];
  }

  const termFrequency = buildTermFrequencyMap(rawSentences.map(entry => entry.sentence));

  const scoredCandidates: Array<SentenceCandidate & { index: number }> = [];
  rawSentences.forEach(({ sentence, material }, index) => {
    const cleaned = sanitizeSentenceText(sentence);
    if (!cleaned) {
      return;
    }
    const tokens = new Set(tokenizeSentence(cleaned));
    if (tokens.size < MIN_SENTENCE_WORDS) {
      return;
    }
    if (isLikelyTitleOrLabel(cleaned, Array.from(tokens))) {
      return;
    }
    const score = scoreSentenceForImportance(cleaned, termFrequency);
    if (score <= 0) {
      return;
    }
    const candidate: SentenceCandidate & { index: number } = {
      id: `${material.materialId}-${index}`,
      text: cleaned,
      score,
      tokens,
      pageNumber: ensurePageNumber(material),
      materialId: material.materialId,
      materialName: material.originalName,
      materialOrder: material.pageNumbers?.length ? material.pageNumbers[0] - 1 : material.order,
      index
    };
    scoredCandidates.push(candidate);
  });

  scoredCandidates.sort((a, b) => {
    if (b.score === a.score) {
      if (a.pageNumber === b.pageNumber) {
        return a.index - b.index;
      }
      return a.pageNumber - b.pageNumber;
    }
    return b.score - a.score;
  });

  const selected: SentenceCandidate[] = [];
  for (const candidate of scoredCandidates) {
    if (selected.length >= limit) break;
    const isDuplicate = selected.some(existing =>
      sentencesAreNearDuplicates(existing.tokens, candidate.tokens)
    );
    if (isDuplicate) continue;
    selected.push({
      id: candidate.id,
      text: candidate.text,
      score: candidate.score,
      tokens: candidate.tokens,
      pageNumber: candidate.pageNumber,
      materialId: candidate.materialId,
      materialName: candidate.materialName,
      materialOrder: candidate.materialOrder
    });
  }
  return selected;
};

const distributeSentencesIntoRounds = (
  candidates: SentenceCandidate[],
  roundCount: number,
  sentencesPerRound: number
): SelectedSentence[] => {
  if (!candidates.length) {
    return [];
  }
  const totalNeeded = roundCount * sentencesPerRound;
  const selected: SentenceCandidate[] = [];
  for (const candidate of candidates) {
    if (selected.length >= totalNeeded) break;
    const isDuplicate = selected.some(existing =>
      sentencesAreNearDuplicates(existing.tokens, candidate.tokens)
    );
    if (isDuplicate) continue;
    selected.push(candidate);
  }

  const sortedByPage = [...selected].sort((a, b) => {
    if (a.pageNumber === b.pageNumber) {
      return b.score - a.score;
    }
    return a.pageNumber - b.pageNumber;
  });

  const rounds: SelectedSentence[][] = Array.from({ length: roundCount }, () => []);
  let roundCursor = 0;
  for (const candidate of sortedByPage) {
    let attempts = 0;
    while (rounds[roundCursor].length >= sentencesPerRound && attempts < roundCount) {
      roundCursor = (roundCursor + 1) % roundCount;
      attempts += 1;
    }
    if (attempts >= roundCount && rounds.every(round => round.length >= sentencesPerRound)) {
      break;
    }
    rounds[roundCursor].push({
      ...candidate,
      roundIndex: roundCursor,
      roundOrder: rounds[roundCursor].length
    });
    roundCursor = (roundCursor + 1) % roundCount;
  }

  const balanced: SelectedSentence[] = [];
  rounds.forEach((round, roundIndex) => {
    round
      .sort((a, b) => {
        if (a.pageNumber === b.pageNumber) {
          return b.score - a.score;
        }
        return a.pageNumber - b.pageNumber;
      })
      .forEach((sentence, orderIndex) => {
        balanced.push({
          ...sentence,
          roundIndex,
          roundOrder: orderIndex
        });
      });
  });
  return balanced;
};

const buildLessonsFromSelectedSentences = (
  selected: SelectedSentence[],
  focusLabel = "Core Sentences"
): GeneratedLessonPlan[] => {
  const grouped = selected.reduce<Map<number, SelectedSentence[]>>((map, sentence) => {
    const group = map.get(sentence.roundIndex) ?? [];
    group.push(sentence);
    map.set(sentence.roundIndex, group);
    return map;
  }, new Map());

  const lessons: GeneratedLessonPlan[] = [];
  const sortedRounds = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  sortedRounds.forEach(([roundIndex, sentences]) => {
    sentences.sort((a, b) => {
      if (a.roundOrder === b.roundOrder) {
        return a.pageNumber - b.pageNumber;
      }
      return a.roundOrder - b.roundOrder;
    });
    sentences.forEach((sentence, idx) => {
      const roundNumber = roundIndex + 1;
      const roundOrder = idx + 1;
      lessons.push({
        title: `Round ${roundNumber} · Sentence ${roundOrder}`,
        summary: sentence.text,
        difficulty: 3,
        focus: [focusLabel],
        sourceMaterialId: sentence.materialId,
        sourceMaterialName: sentence.materialName,
        sourceMaterialIndex: sentence.pageNumber ? sentence.pageNumber - 1 : sentence.materialOrder,
        roundIndex: roundNumber,
        roundOrder,
        items: [
          {
            type: "sentence",
            title: "核心句子",
            payload: {
              en: sentence.text,
              answer: sentence.text,
              target: sentence.text,
              pageNumber: sentence.pageNumber,
              round: roundNumber,
              roundOrder
            }
          }
        ]
      });
    });
  });
  return lessons;
};


const createCoursePlan = async (job: Job<PackageGenerationJobData>) => {
  const { generationJobId } = job.data;

  const generationJob = await prisma.generationJob.findUnique({
    where: { id: generationJobId },
    include: {
      package: true
    }
  }) as any;

  if (!generationJob) {
    throw new Error(`GenerationJob ${generationJobId} 不存在`);
  }

  if (!generationJob.packageId) {
    throw new Error("当前任务缺少关联课程包，无法生成内容");
  }

  const packageId = generationJob.packageId;
  const existingDescription = generationJob.package?.description ?? null;
  const jobInput = (generationJob.inputInfo ?? {}) as Record<string, any>;
  
  // 获取关联的单元ID（如果有）
  const unitId = generationJob.unitId || jobInput.unitId as string | null;
  let targetUnit: { id: string; sequence: number | null; title: string | null } | null = null;
  const isUnitGeneration = Boolean(unitId);
  
  // 调试日志，帮助定位未绑定到单元的问题
  console.log(`[Worker] generationJob.unitId: ${generationJob.unitId}`);
  console.log(`[Worker] jobInput.unitId: ${jobInput.unitId}`);
  console.log(`[Worker] 最终 unitId: ${unitId}`);

  if (isUnitGeneration) {
    const unitRecord = await (prisma as any).unit.findFirst({
      where: {
        id: unitId,
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        sequence: true,
        packageId: true
      }
    });

    if (!unitRecord) {
      await generationJobRepository.appendLog(
        generationJobId,
        `未找到ID为 ${unitId} 的单元，生成的关卡将不会绑定到任何单元`,
        "warning"
      );
    } else if (unitRecord.packageId !== packageId) {
      await generationJobRepository.appendLog(
        generationJobId,
        `单元 ${unitId} 不属于课程包 ${packageId}，跳过单元绑定`,
        "warning",
        { unitPackageId: unitRecord.packageId }
      );
    } else {
      targetUnit = {
        id: unitRecord.id,
        sequence: unitRecord.sequence,
        title: unitRecord.title
      };
      await generationJobRepository.appendLog(
        generationJobId,
        `将生成的关卡绑定到单元「${unitRecord.title ?? unitRecord.id}」`,
        "info",
        {
          unitId: unitRecord.id,
          unitSequence: unitRecord.sequence
        }
      );
    }
  }
  
  // 支持多文件上传：优先使用assets数组，否则使用单个文件信息（向后兼容）
  const assets = jobInput.assets as Array<{
    assetId: string;
    storagePath: string;
    originalName: string;
    mimeType: string;
    size: number;
  }> | undefined;
  
  const originalName = jobInput.originalName ?? "上传文件";
  const storagePath = jobInput.storagePath; // 向后兼容单文件

  // 确定要处理的文件列表
  const filesToProcess = assets && assets.length > 0 
    ? assets 
    : (storagePath ? [{
        assetId: jobInput.assetId || "",
        storagePath,
        originalName,
        mimeType: jobInput.mimeType || "image/jpeg",
        size: jobInput.size || 0
      }] : []);

  if (filesToProcess.length === 0) {
    throw new Error("任务缺少存储路径信息");
  }

  const assetMetadataMap = new Map<string, Record<string, unknown>>();
  const assetIds = filesToProcess
    .map(file => file.assetId)
    .filter((value): value is string => Boolean(value));
  if (assetIds.length) {
    const records = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, metadata: true }
    });
    for (const record of records) {
      assetMetadataMap.set(record.id, cloneMetadata(record.metadata));
    }
  }

  const materialExtractions: MaterialExtraction[] = filesToProcess.map((file, index) => {
    const lowerName = file.originalName?.toLowerCase() ?? "";
    const lowerMime = file.mimeType?.toLowerCase() ?? "";
    const isPdf = lowerMime.includes("pdf") || lowerName.endsWith(".pdf");
    const metadata = file.assetId ? assetMetadataMap.get(file.assetId) : undefined;
    const fallbackOrder =
      metadata && typeof (metadata as Record<string, unknown>).fileIndex === "number"
        ? Number((metadata as Record<string, unknown>).fileIndex)
        : index;
    return {
      materialId: file.assetId || file.storagePath || `${file.originalName || "file"}-${index + 1}`,
      order: index,
      originalName: file.originalName || `file-${index + 1}`,
      sourceType: isPdf ? "pdf" : "image",
      ocrText: "",
      sentences: [],
      targetLessonCount: extractLessonTargetFromMetadata(metadata),
      metadata,
      pageNumbers: extractPageNumbersFromMetadata(metadata, file.originalName, fallbackOrder),
      fallbackOrder
    };
  });

  const getMaterialForFile = (file: (typeof filesToProcess)[number]): MaterialExtraction | undefined => {
    const fileIndex = filesToProcess.indexOf(file);
    if (fileIndex === -1) {
      return undefined;
    }
    return materialExtractions[fileIndex];
  };

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 5,
    startedAt: new Date()
  });
  await job.updateProgress(5);

  await generationJobRepository.appendLog(generationJobId, `开始处理${filesToProcess.length}个文件`, "info", {
    fileCount: filesToProcess.length,
    originalName: filesToProcess[0]?.originalName
  });

  let extractedText = "";
  const allOcrTexts: string[] = [];

  // 处理PDF文件（通常只有一个PDF）
  const pdfFiles = filesToProcess.filter(f => 
    f.mimeType.includes("pdf") || f.originalName.toLowerCase().endsWith(".pdf")
  );

  if (pdfFiles.length > 0 && generationJob.sourceType === "pdf_upload") {
    await generationJobRepository.appendLog(generationJobId, `解析 ${pdfFiles.length} 个 PDF 文件`, "info");
    
    for (const pdfFile of pdfFiles) {
      const downloadResult = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(pdfFile.storagePath);
      if (downloadResult.error) {
        await generationJobRepository.appendLog(generationJobId, `下载PDF失败: ${pdfFile.originalName}`, "warning");
        continue;
      }
      const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
      const pdfResult = await pdf(fileBuffer);
      const pdfText = (pdfResult.text || "").trim();
      const material = getMaterialForFile(pdfFile);
      if (material && pdfText) {
        material.ocrText = pdfText;
      }
      allOcrTexts.push(`[PDF ${pdfFile.originalName}] ${pdfText}`);
    }
    
    extractedText = materialExtractions
      .filter(material => material.ocrText.trim().length > 0)
      .map(material => `[素材 ${material.order + 1}: ${material.originalName}]\n${material.ocrText}`)
      .join("\n\n---\n\n");
  } else {
    // 批量OCR处理图片
    await generationJobRepository.appendLog(generationJobId, `开始批量OCR识别 ${filesToProcess.length} 张图片`, "info");
    
    const imageUrls: string[] = [];
    
    // 为每张图片生成签名URL
    for (const imageFile of filesToProcess) {
      const signedUrl = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(imageFile.storagePath, 60 * 10);

      if (signedUrl.error || !signedUrl.data?.signedUrl) {
        await generationJobRepository.appendLog(
          generationJobId, 
          `获取图片签名链接失败: ${imageFile.originalName}`, 
          "warning"
        );
        continue;
      }
      
      imageUrls.push(signedUrl.data.signedUrl);
    }

    if (imageUrls.length === 0) {
      throw new Error("无法获取任何图片的签名链接，无法调用 OCR");
    }

    // 批量OCR识别
    const ocrTexts = await recognizeImagesBatch(imageUrls);
    
    // 合并所有OCR结果
    for (let i = 0; i < ocrTexts.length; i++) {
      const text = ocrTexts[i];
      if (text && text.trim()) {
        allOcrTexts.push(`[图片 ${i + 1}: ${filesToProcess[i]?.originalName || `file-${i + 1}`}]\n${text}`);
        const material = materialExtractions[i];
        if (material) {
          material.ocrText = text;
        }
        await generationJobRepository.appendLog(
          generationJobId,
          `图片 ${i + 1} OCR识别完成: ${filesToProcess[i]?.originalName || `file-${i + 1}`}`,
          "info",
          { textLength: text.length }
        );
      } else {
        await generationJobRepository.appendLog(
          generationJobId,
          `图片 ${i + 1} OCR识别结果为空: ${filesToProcess[i]?.originalName || `file-${i + 1}`}`,
          "warning"
        );
      }
    }

    extractedText = materialExtractions
      .filter(material => material.ocrText.trim().length > 0)
      .map(material => `[素材 ${material.order + 1}: ${material.originalName}]\n${material.ocrText}`)
      .join("\n\n---\n\n");
  }

  // 记录OCR提取的完整文本
  console.log(`[生成任务 ${generationJobId}] OCR文本提取完成，总长度: ${extractedText.length} 字符`);
  console.log(`[生成任务 ${generationJobId}] OCR文本样本: ${extractedText.substring(0, 500)}`);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `OCR文本提取完成，总长度: ${extractedText.length} 字符`,
    "info",
    {
      fullOcrText: extractedText.substring(0, 2000), // 记录前2000字符
      ocrTextCount: allOcrTexts.length,
      hasEnglish: /[a-zA-Z]{3,}/.test(extractedText)
    }
  );

  // 提前提取英文句子，用于后续验证和补充，并记录每个素材的句子池
  const globalSentenceDedup = new Set<string>();
  const rawExtractedSentences: string[] = [];
  for (const material of materialExtractions) {
    if (!material.ocrText.trim()) {
      material.sentences = [];
      continue;
    }
    const sentences = extractEnglishSentences(material.ocrText);
    material.sentences = sentences;
    for (const sentence of sentences) {
      const key = sentence.toLowerCase();
      if (globalSentenceDedup.has(key)) {
        continue;
      }
      globalSentenceDedup.add(key);
      rawExtractedSentences.push(sentence);
    }
  }

  const preExtractedSentences = selectCoreSentences(rawExtractedSentences, 50);
  const filteredOutCount = Math.max(0, rawExtractedSentences.length - preExtractedSentences.length);
  console.log(
    `[生成任务 ${generationJobId}] 从OCR文本中预提取到 ${rawExtractedSentences.length} 个英文句子，优先队列保留 ${preExtractedSentences.length} 个（过滤标题/标签 ${filteredOutCount} 个）`
  );
  if (preExtractedSentences.length > 0) {
    console.log(`[生成任务 ${generationJobId}] 英文句子示例: ${preExtractedSentences.slice(0, 5).join(', ')}`);
  }

  await persistMaterialExtractionStats(materialExtractions);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `从OCR文本中预提取到 ${preExtractedSentences.length} 个英文句子`,
    "info",
    {
      sampleSentences: preExtractedSentences.slice(0, 10),
      totalExtracted: preExtractedSentences.length,
      rawCandidates: rawExtractedSentences.length,
      filteredOut: filteredOutCount,
      perMaterial: materialExtractions.map(material => ({
        materialId: material.materialId,
        originalName: material.originalName,
        order: material.order,
        sourceType: material.sourceType,
        sentenceCount: material.sentences.length
      }))
    }
  );

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 15
  });
  await job.updateProgress(15);

  // PDF fallback处理（如果之前没有成功提取文本）
  if (!extractedText.trim() && generationJob.sourceType === "pdf_upload" && pdfFiles.length > 0) {
    await generationJobRepository.appendLog(generationJobId, "尝试PDF fallback解析", "info");
    const firstPdf = pdfFiles[0];
    const downloadResult = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(firstPdf.storagePath);
    if (!downloadResult.error) {
      const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
      const fallback = await pdf(fileBuffer);
      if (fallback.text?.trim()) {
        extractedText = fallback.text;
        await generationJobRepository.appendLog(generationJobId, "PDF fallback解析成功", "info");
      }
    }
  }

  if (!extractedText.trim()) {
    extractedText = DEFAULT_ENGLISH_SENTENCES.join("\n");
    console.warn(`[生成任务 ${generationJobId}] 未能从素材中提取有效文本，使用内置英文句子兜底继续流程`);
    await generationJobRepository.appendLog(
      generationJobId,
      "未能从素材提取到有效文本，使用内置英文句子兜底继续生成",
      "warning",
      {
        fallbackSentenceCount: DEFAULT_ENGLISH_SENTENCES.length,
        fallbackSample: DEFAULT_ENGLISH_SENTENCES.slice(0, 5)
      }
    );
    if (materialExtractions.length === 0) {
      materialExtractions.push({
        materialId: "fallback",
        order: 0,
        originalName: "Fallback Content",
        sourceType: "fallback",
        ocrText: extractedText,
        sentences: [],
        targetLessonCount: 0,
        metadata: undefined,
        pageNumbers: [1],
        fallbackOrder: 0
      });
    } else {
      materialExtractions[0].ocrText = extractedText;
      materialExtractions[0].sourceType = "fallback";
      if (!materialExtractions[0].pageNumbers?.length) {
        materialExtractions[0].pageNumbers = [1];
      }
    }
  }

  if (!extractedText.trim()) {
    throw new Error(`未能从${filesToProcess.length}个素材中提取有效文本，请确认内容质量`);
  }

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 30
  });
  await job.updateProgress(30);

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 55
  });
  await job.updateProgress(55);

  const sentenceCandidates = buildSentenceCandidatesFromMaterials(materialExtractions);
  if (!sentenceCandidates.length) {
    throw new Error("未能提取到任何有效英文句子，请检查教材内容");
  }

  const selectedSentences = distributeSentencesIntoRounds(
    sentenceCandidates,
    SENTENCE_ROUND_COUNT,
    SENTENCE_PER_ROUND
  );

  if (!selectedSentences.length) {
    throw new Error("候选句子不足，无法生成四轮冒险关卡");
  }

  if (!targetUnit) {
    throw new Error("当前任务缺少单元信息，无法生成关卡");
  }

  const ensuredUnit = targetUnit as NonNullable<typeof targetUnit>;
  const lessonsFromSentences = buildLessonsFromSelectedSentences(
    selectedSentences,
    ensuredUnit.title ?? "Core Sentences"
  );

  const plan: GeneratedCoursePlan = {
    packageSummary: `${ensuredUnit.title ?? "Unit"} 核心句子`,
    lessons: lessonsFromSentences
  };

  await generationJobRepository.appendLog(
    generationJobId,
    "核心句子关卡生成完成",
    "info",
    {
      candidateCount: sentenceCandidates.length,
      selectedCount: selectedSentences.length,
      rounds: SENTENCE_ROUND_COUNT,
      perRound: SENTENCE_PER_ROUND,
      pageRange: {
        min: Math.min(...selectedSentences.map(item => item.pageNumber)),
        max: Math.max(...selectedSentences.map(item => item.pageNumber))
      },
      sampleSentences: selectedSentences.slice(0, 5).map(item => ({
        page: item.pageNumber,
        sentence: item.text
      }))
    }
  );

// 验证并补充AI生成的内容中的英文
  // 统计所有item和缺少英文内容的item数量
  let totalItems = 0;
  let itemsWithoutEn = 0;
  for (const lesson of plan.lessons) {
    for (const item of lesson.items || []) {
      totalItems++;
      const payload = item.payload as Record<string, any> || {};
      const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
      if (!hasEn) {
        itemsWithoutEn++;
      }
    }
  }

  // 详细记录每个item的payload内容
  const itemDetails: Array<{lessonTitle: string, itemType: string, hasEn: boolean, payload: any}> = [];
  for (const lesson of plan.lessons.slice(0, 5)) { // 只记录前5个lesson
    for (const item of lesson.items || []) {
      const payload = item.payload as Record<string, any> || {};
      const hasEn = !!(payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence);
      itemDetails.push({
        lessonTitle: lesson.title,
        itemType: item.type,
        hasEn,
        payload: JSON.stringify(payload).substring(0, 300)
      });
    }
  }

  console.log(`[生成任务 ${generationJobId}] 内容验证：总共 ${totalItems} 个item，其中 ${itemsWithoutEn} 个缺少英文内容`);
  
  await generationJobRepository.appendLog(
    generationJobId,
    `内容验证：总共 ${totalItems} 个item，其中 ${itemsWithoutEn} 个缺少英文内容`,
    "info",
    {
      totalItems,
      itemsWithoutEn,
      itemDetails: itemDetails.slice(0, 10) // 记录前10个item的详情
    }
  );

  // 如果有缺少英文内容的item，尝试从OCR文本中提取英文句子补充
  if (itemsWithoutEn > 0) {
    await generationJobRepository.appendLog(
      generationJobId,
      "警告：AI生成的内容中没有找到英文内容，可能使用了中文或占位符",
      "warning",
      { 
        samplePayload: JSON.stringify(plan.lessons[0]?.items?.[0]?.payload || {}).substring(0, 200)
      }
    );
    
    // 尝试从OCR文本中提取英文句子作为fallback
    let englishSentences = materialExtractions.flatMap(material => material.sentences);
    if (!englishSentences.length) {
      englishSentences = selectCoreSentences(extractEnglishSentences(extractedText), 50);
    }
    await generationJobRepository.appendLog(
      generationJobId,
      `开始从OCR文本提取英文句子，OCR文本长度: ${extractedText.length}`,
      "info",
      {
        ocrTextSample: extractedText.substring(0, 1000),
        extractionMethod: "extractEnglishSentences+selectCoreSentences"
      }
    );
    
    if (englishSentences.length > 0) {
      console.log(`[生成任务 ${generationJobId}] ✅ 从OCR文本中提取到 ${englishSentences.length} 个英文句子`);
      console.log(`[生成任务 ${generationJobId}] 英文句子列表: ${englishSentences.slice(0, 10).join(' | ')}`);
      
      await generationJobRepository.appendLog(
        generationJobId,
        `✅ 从OCR文本中提取到 ${englishSentences.length} 个英文句子，用于补充内容`,
        "info",
        {
          extractedCount: englishSentences.length,
          sampleSentences: englishSentences.slice(0, 10),
          allSentences: englishSentences // 记录所有提取的句子
        }
      );
      // 用提取的英文句子替换没有英文内容的item
      let sentenceIndex = 0;
      for (const lesson of plan.lessons) {
        for (const item of lesson.items || []) {
          const payload = item.payload as Record<string, any> || {};
          // 检查是否缺少英文内容
          const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
          if (!hasEn && sentenceIndex < englishSentences.length) {
            // 从提取的英文句子中选择一个（按顺序，确保每个item都有不同的句子）
            let englishSentence = englishSentences[sentenceIndex % englishSentences.length];
            // 清理句子中的换行符和多余空格
            englishSentence = englishSentence
              .replace(/\n+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            payload.en = englishSentence;
            payload.answer = englishSentence;
            payload.target = englishSentence;
            // 如果是reorder类型，生成variants
            if (item.type === 'reorder') {
              payload.variants = englishSentence.split(/\s+/).filter(w => w.length > 0 && w.match(/[a-zA-Z]/));
            }
            sentenceIndex++;
            console.log(`[生成任务 ${generationJobId}] ✅ 为关卡 "${lesson.title}" 补充英文: "${englishSentence.substring(0, 50)}"`);
            
            await generationJobRepository.appendLog(
              generationJobId,
              `✅ 为关卡 "${lesson.title}" 的item补充英文内容`,
              "info",
              {
                lessonTitle: lesson.title,
                itemType: item.type,
                sentenceIndex,
                englishSentence,
                sentenceLength: englishSentence.length,
                payloadBefore: JSON.stringify(payload),
                payloadAfter: JSON.stringify({
                  ...payload,
                  en: englishSentence,
                  answer: englishSentence,
                  target: englishSentence
                })
              }
            );
          }
        }
      }
      
      await generationJobRepository.appendLog(
        generationJobId,
        `成功为 ${sentenceIndex} 个item补充了英文内容`,
        "info",
        { 
          sampleSentences: englishSentences.slice(0, 5),
          totalExtracted: englishSentences.length
        }
      );
      
      // 验证补充后的内容
      let verifiedItems = 0;
      for (const lesson of plan.lessons) {
        for (const item of lesson.items || []) {
          const payload = item.payload as Record<string, any> || {};
          const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
          if (hasEn) {
            verifiedItems++;
          }
        }
      }
      await generationJobRepository.appendLog(
        generationJobId,
        `补充后验证：${verifiedItems}/${totalItems} 个item包含英文内容`,
        "info"
      );
    } else {
      await generationJobRepository.appendLog(
        generationJobId,
        `OCR文本中也没有找到英文内容！请检查OCR识别结果。提取的文本长度: ${extractedText.length}`,
        "error",
        { extractedTextSample: extractedText.substring(0, 1000) }
      );
    }
  } else {
    await generationJobRepository.appendLog(
      generationJobId,
      "✅ 所有item都已包含英文内容，无需补充",
      "info"
    );
  }

  await generationJobRepository.appendLog(generationJobId, "AI 草稿生成完成，准备落库", "info", {
    lessonCount: plan.lessons.length
  });

  await generationJobRepository.updateStatus(generationJobId, {
    status: "processing",
    progress: 70
  });
  await job.updateProgress(70);

  const triggerUserId = generationJob.triggeredById ?? null;

  // 分步骤创建，避免大事务超时
  // 1. 如果已有草稿版本，先删除它（包括关联的关卡），确保只有一个草稿
  const existingDraftVersion = await prisma.coursePackageVersion.findFirst({
    where: {
      packageId,
      status: "draft"
    },
    include: {
      lessons: {
        select: { id: true }
      }
    }
  });

  let version = existingDraftVersion;
  let versionNumber = existingDraftVersion?.versionNumber ?? null;

  const createNewDraftVersion = async () => {
    const versionCount = await prisma.coursePackageVersion.count({ where: { packageId } });
    const nextVersionNumber = versionCount + 1;

    const newVersion = await prisma.coursePackageVersion.create({
      data: {
        packageId,
        versionNumber: nextVersionNumber,
        label: `AI Draft #${nextVersionNumber}`,
        notes: `生成自 ${originalName}`,
        status: "draft",
        sourceType: "ai_generated",
        payload: plan as unknown as Prisma.JsonObject,
        createdById: triggerUserId
      },
      include: {
        lessons: {
          select: { id: true }
        }
      }
    });

    await generationJobRepository.appendLog(generationJobId, "课程包版本创建成功，开始创建课程", "info", {
      versionId: newVersion.id,
      versionNumber: nextVersionNumber
    });

    versionNumber = nextVersionNumber;
    return newVersion;
  };

  if (isUnitGeneration) {
    if (!targetUnit) {
      throw new Error(`未能解析到目标单元 ${unitId}，为防止误删其它单元内容，任务已中止`);
    }

    if (!version) {
      version = await createNewDraftVersion();
    } else {
      await generationJobRepository.appendLog(
        generationJobId,
        `复用草稿版本（#${version.versionNumber}）以更新单元 ${targetUnit.title ?? targetUnit.id}`,
        "info",
        { versionId: version.id, unitId: targetUnit.id }
      );
    }

    const removedLessons = await (prisma as any).lesson.deleteMany({
      where: {
        packageVersionId: version.id,
        unitId: targetUnit.id
      }
    });

    if (removedLessons.count > 0) {
      await generationJobRepository.appendLog(
        generationJobId,
        `删除了单元 ${targetUnit.title ?? targetUnit.id} 旧的 ${removedLessons.count} 个关卡，准备重新生成`,
        "info"
      );
    }
  } else {
  if (existingDraftVersion) {
      await generationJobRepository.appendLog(
        generationJobId,
        `发现已有草稿版本（#${existingDraftVersion.versionNumber}），删除旧草稿以创建新草稿`,
        "info",
        { oldVersionId: existingDraftVersion.id, oldLessonCount: existingDraftVersion.lessons.length }
      );

      const currentPackage = await prisma.coursePackage.findUnique({
        where: { id: packageId },
        select: { currentVersionId: true }
      });

      if (currentPackage?.currentVersionId === existingDraftVersion.id) {
        await prisma.coursePackage.update({
          where: { id: packageId },
          data: { currentVersionId: null }
        });
      }

      await (prisma as any).lesson.deleteMany({
        where: {
          packageVersionId: existingDraftVersion.id
        }
      });

      await prisma.coursePackageVersion.delete({
        where: { id: existingDraftVersion.id }
      });

      await generationJobRepository.appendLog(generationJobId, "旧草稿版本已删除", "info");
    }

    version = await createNewDraftVersion();
  }

  if (!version) {
    throw new Error("无法获取或创建草稿版本，生成流程中止");
  }

  // 计算现有最大序号，用于在复用版本时将新关卡追加到末尾
  const existingLessonSeq = await prisma.lesson.aggregate({
    where: {
      packageVersionId: version.id
    },
    _max: {
      sequence: true
    }
  });

  // 2. 批量翻译：在创建关卡前，先收集所有需要翻译的句子并批量翻译
  console.log(`[Worker] 开始批量翻译所有关卡的英文句子...`);
  const sentencesToTranslate = new Set<string>();
  
  for (const lessonPlan of plan.lessons) {
    const validItems = Array.isArray(lessonPlan.items) ? lessonPlan.items : [];
    for (const item of validItems) {
      if (!item || typeof item !== "object") continue;
      const payload = (item.payload as Record<string, any>) || {};
      const enText = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
      if (enText && !payload.cn) {
        sentencesToTranslate.add(enText);
      }
    }
  }

  // 批量翻译
  let translationMap = new Map<string, string>();
  if (sentencesToTranslate.size > 0) {
    console.log(`[Worker] 需要翻译 ${sentencesToTranslate.size} 个句子，开始批量翻译...`);
    translationMap = await batchTranslate(Array.from(sentencesToTranslate), {
      concurrency: 3,  // 并发数
      delayBetweenBatches: 500  // 批次间延迟 500ms，避免限频
    });
    console.log(`[Worker] 批量翻译完成，成功 ${translationMap.size}/${sentencesToTranslate.size} 个`);
    
    // 应用翻译结果到 plan
    for (const lessonPlan of plan.lessons) {
      const validItems = Array.isArray(lessonPlan.items) ? lessonPlan.items : [];
      for (const item of validItems) {
        if (!item || typeof item !== "object") continue;
        const payload = (item.payload as Record<string, any>) || {};
        const enText = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
        if (enText && !payload.cn) {
          const translation = translationMap.get(enText);
          if (translation) {
            payload.cn = translation;
            console.log(`[Worker] 应用翻译: "${enText.substring(0, 30)}..." -> "${translation.substring(0, 30)}..."`);
          } else {
            // 翻译失败时留空，不 fallback 到英文
            payload.cn = null;
            console.warn(`[Worker] 翻译失败，留空: "${enText.substring(0, 50)}..."`);
          }
        }
      }
    }
  } else {
    console.log(`[Worker] 没有需要翻译的句子`);
  }

  // 3. 逐个创建课程和课时，使用小事务
  // 由于已删除旧草稿，sequence从1开始（只保留一个草稿版本）
  let sequence = targetUnit ? (existingLessonSeq._max?.sequence ?? 0) + 1 : 1;
  const lessonSummaries: Array<{ id: string; versionId: string }> = [];

  for (let i = 0; i < plan.lessons.length; i++) {
    const lessonPlan = plan.lessons[i];

    // 更新进度
    const progress = 70 + Math.floor((i / plan.lessons.length) * 25);
    await generationJobRepository.updateStatus(generationJobId, {
      status: "processing",
      progress
    });
    await job.updateProgress(progress);

    try {
      console.log(`[Worker] 创建关卡 "${lessonPlan.title}" 关联到 unitId: ${unitId}`);
      const lessonResult = await prisma.$transaction(
        async (tx) => {
          const lesson = await tx.lesson.create({
            data: {
              packageId,
              packageVersionId: version.id,
              unitId: targetUnit?.id ?? null,
              unitNumber: targetUnit?.sequence ?? null,
              unitName: targetUnit?.title ?? null,
              title: lessonPlan.title,
              sequence,
              createdById: triggerUserId,
              sourceAssetId: lessonPlan.sourceMaterialId ?? null,
              sourceAssetName: lessonPlan.sourceMaterialName ?? null,
              sourceAssetOrder:
                typeof lessonPlan.sourceMaterialIndex === "number" ? lessonPlan.sourceMaterialIndex : null,
              roundIndex: lessonPlan.roundIndex ?? null,
              roundOrder: lessonPlan.roundOrder ?? null
            } as any
          });
          console.log(`[Worker] 关卡创建成功, lesson.id: ${lesson.id}`);

          const difficulty = clampDifficulty(lessonPlan.difficulty);

          const lessonVersion = await tx.lessonVersion.create({
            data: {
              lessonId: lesson.id,
              versionNumber: 1,
              title: lessonPlan.title,
              summary: lessonPlan.summary,
              difficulty,
              status: "draft",
              createdById: triggerUserId
            }
          });

          await tx.lesson.update({
            where: { id: lesson.id },
            data: { currentVersionId: lessonVersion.id }
          });

          const validItems = Array.isArray(lessonPlan.items) ? lessonPlan.items : [];
          let orderIndex = 1;

          for (const item of validItems) {
            if (!item || typeof item !== "object") continue;
            if (!LESSON_ITEM_TYPES.includes(item.type as LessonItemType)) continue;

            // 验证payload中是否有英文内容
            const payload = item.payload as Record<string, any> || {};
            const hasEn = payload.en || payload.target || payload.answer || payload.enText || payload.text || payload.sentence;
            
            // 翻译已在批量翻译阶段完成，这里只需要验证
            if (hasEn && !payload.cn) {
              console.warn(`[Worker] 警告：item #${orderIndex} 有英文但无翻译，可能批量翻译时失败`);
            }

            // 记录每个item的保存详情
            await generationJobRepository.appendLog(
              generationJobId,
              `保存关卡 "${lessonPlan.title}" 的item #${orderIndex} (类型: ${item.type})`,
              "info",
              {
                lessonTitle: lessonPlan.title,
                itemIndex: orderIndex,
                itemType: item.type,
                hasEn,
                en: payload.en || 'N/A',
                answer: payload.answer || 'N/A',
                target: payload.target || 'N/A',
                cn: payload.cn || 'N/A',
                payloadKeys: Object.keys(payload),
                payloadFull: JSON.stringify(payload).substring(0, 500)
              }
            );

            if (!hasEn) {
              await generationJobRepository.appendLog(
                generationJobId,
                `❌ 错误：关卡 "${lessonPlan.title}" 的item #${orderIndex} 在保存时仍然没有英文内容！`,
                "error",
                {
                  payload: JSON.stringify(payload),
                  payloadKeys: Object.keys(payload)
                }
              );
            }

            await tx.lessonItem.create({
              data: {
                lessonVersionId: lessonVersion.id,
                orderIndex,
                type: item.type as LessonItemType,
                title: item.title ?? null,
                payload: payload
              }
            });

            orderIndex += 1;
          }

          return {
            lessonId: lesson.id,
            versionId: lessonVersion.id
          };
        },
        {
          timeout: 30000 // 每个课程30秒超时
        }
      );

      lessonSummaries.push({ id: lessonResult.lessonId, versionId: lessonResult.versionId });
      sequence += 1;

          await generationJobRepository.appendLog(generationJobId, `课程创建成功: ${lessonPlan.title}`, "info");

    } catch (error) {
      // 如果是唯一键冲突（通常发生在任务重试/并发下），自动顺延 sequence 并重试当前课程
      const err: any = error;
      if (err?.code === 'P2002') {
        await generationJobRepository.appendLog(
          generationJobId,
          `检测到 sequence 唯一键冲突，自动顺延并重试: ${lessonPlan.title}`,
          "warning",
          { lessonTitle: lessonPlan.title, retrySequence: sequence + 1 }
        );
        sequence += 1; // 顺延一个位置
        i -= 1; // 重试当前 lesson
        continue;
      }

      await generationJobRepository.appendLog(generationJobId, `课程创建失败: ${lessonPlan.title} - ${(error as Error).message}`, "error", {
        lessonTitle: lessonPlan.title,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // 3. 最后更新课程包状态
  await prisma.coursePackage.update({
    where: { id: packageId },
    data: {
      currentVersionId: version.id,
      status: "draft",
      description:
        existingDescription == null || existingDescription.trim().length === 0 ? plan.packageSummary : existingDescription
    }
  });

  const persisted = {
    versionId: version.id,
    versionNumber: versionNumber ?? version.versionNumber,
    lessonCount: await prisma.lesson.count({
      where: {
        packageVersionId: version.id,
        deletedAt: null
      }
    })
  };

  await generationJobRepository.appendLog(generationJobId, "课程包生成完成，关卡数量验证通过", "info", {
    finalLessonCount: lessonSummaries.length,
    requirementMet: `<=${MAX_TOTAL_LESSONS}关且素材覆盖`
  });

  await generationJobRepository.appendLog(generationJobId, "课程草稿落库成功", "info", persisted);

  await generationJobRepository.updateStatus(generationJobId, {
    status: "succeeded",
    progress: 100,
    result: {
      versionId: persisted.versionId,
      versionNumber: persisted.versionNumber,
      lessonCount: persisted.lessonCount
    }
  });
  await job.updateProgress(100);
};

export const packageGenerationWorker = createWorker<PackageGenerationJobData, void>(
  PACKAGE_GENERATION_QUEUE,
  async job => {
    try {
      await createCoursePlan(job);
    } catch (error) {
      const { generationJobId } = job.data;
      const message = error instanceof Error ? error.message : "未知错误";
      const progressValue = typeof job.progress === "number" ? job.progress : 0;
      const existingJob = await generationJobRepository.findById(generationJobId);

      if (!existingJob) {
        console.warn(
          `[worker] generation job ${generationJobId} is missing while handling failure: ${message}`
        );
      } else {
        try {
          await generationJobRepository.appendLog(generationJobId, message, "error");
        } catch (logError) {
          console.error(
            `[worker] failed to append error log for generation job ${generationJobId}`,
            logError
          );
        }

        try {
          await generationJobRepository.updateStatus(generationJobId, {
            status: "failed",
            progress: progressValue,
            errorMessage: message
          });
        } catch (statusError) {
          console.error(
            `[worker] failed to update status for generation job ${generationJobId}`,
            statusError
          );
        }
      }

      throw error;
    }
  }
);

packageGenerationWorker.on("ready", () => {
  // eslint-disable-next-line no-console
  console.log(`[worker] package-generation ready, listening on queue ${PACKAGE_GENERATION_QUEUE}`);
});

packageGenerationWorker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] package-generation job ${job?.id} failed`, err);
});

packageGenerationWorker.on("completed", job => {
  // eslint-disable-next-line no-console
  console.log(`[worker] package-generation job ${job.id} completed`);
});
