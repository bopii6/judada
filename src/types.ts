export interface Sentence {
  id: number;
  tier: number;
  cn: string;
  en: string;
  tags: string[];
  variants?: string[];
}

export type LearningMode = 'type' | 'tiles';

export interface GameSettings {
  mode: LearningMode;
  tierMin: number;
  tierMax: number;
  sessionLength: number;
  enableTTS: boolean;
  enableSFX: boolean;
  enableVibration: boolean;
  voiceURI?: string;
  speechRate: number;
}

export interface SentenceStats {
  sentenceId: number;
  attempts: number;
  successes: number;
  tags: string[];
}

export interface DailyLog {
  date: string;
  attempts: number;
  successes: number;
  comboRecord: number;
  sentences: Record<number, SentenceStats>;
}

export interface PracticeHistory {
  [date: string]: DailyLog;
}

export interface AttemptPayload {
  sentence: Sentence;
  userInput: string;
  success: boolean;
  timestamp: number;
}

export interface MetaStats {
  highestCombo: number;
  totalAttempts: number;
}
