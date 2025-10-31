import pdf from "pdf-parse";

export interface ParsedQuestion {
  tier: number;
  type: "type" | "tiles" | "listenTap" | "speak";
  cn: string;
  en: string;
  variants: string[];
  tags: string[];
}

const inferTier = (words: number): number => {
  if (words <= 4) return 1;
  if (words <= 6) return 2;
  if (words <= 8) return 3;
  if (words <= 10) return 4;
  if (words <= 12) return 5;
  return 6;
};

export const parsePdfToQuestions = async (file: Buffer): Promise<ParsedQuestion[]> => {
  const result = await pdf(file);
  const lines = result.text
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  for (const line of lines) {
    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map((sentence: string) => sentence.trim())
      .filter(Boolean);

    sentences.forEach((sentence: string) => {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length < 3 || words.length > 18) return;
      questions.push({
        tier: inferTier(words.length),
        type: "type",
        cn: sentence,
        en: sentence,
        variants: [],
        tags: []
      });
    });
  }
  return questions;
};
