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

