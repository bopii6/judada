import type { QuestionBankSchema, QuestionSchema } from "@judada/shared";

export type QuestionBank = QuestionBankSchema & {
  id: string;
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Question = QuestionSchema & {
  id: string;
};

export interface PlacementStartResponse {
  sessionId: string;
  questions: Question[];
}

export interface PlacementSubmitResponse {
  score: number;
  recommendedTier: number;
  recommendedBanks: { id: string; name: string }[];
}
