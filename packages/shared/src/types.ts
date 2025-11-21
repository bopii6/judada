export type QuestionType = "type" | "tiles" | "listenTap" | "speak";

export interface QuestionInput {
  id?: string;
  code?: string;
  bankId?: string;
  tier: number;
  type: QuestionType;
  cn: string;
  en: string;
  variants?: string[];
  tags?: string[];
}

export interface QuestionBankInput {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  levelMin: number;
  levelMax: number;
  isPlacement?: boolean;
}

export interface PlacementRecordInput {
  questionId: string;
  answerText: string;
  durationMs: number;
  correct?: boolean;
}

export interface PlacementRecordResult extends PlacementRecordInput {
  correct: boolean;
  baseScore: number;
  bonus: number;
}

export interface PlacementScoreResult {
  records: PlacementRecordResult[];
  totalQuestions: number;
  score: number;
  recommendedTier: number;
}

export interface MusicWord {
  time: number;
  duration: number;
  text: string;
  hint?: string;
  guide?: string;
}

export interface MusicPhrase {
  start: number;
  end: number;
  en: string;
  zh?: string;
  tip?: string;
}


export type MusicTrackStatus = "draft" | "processing" | "published" | "archived";

export interface MusicTrackSummary {
  id: string;
  slug: string;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  durationMs?: number | null;
  status: MusicTrackStatus;
  audioUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MusicTrackDetail extends MusicTrackSummary {
  words: MusicWord[];
  phrases: MusicPhrase[];
  metadata?: Record<string, unknown> | null;
  publishedAt?: string | null;
}

