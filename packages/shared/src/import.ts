import Papa from "papaparse";
import { z } from "zod";
import { questionImportSchema } from "./schemas";
import type { QuestionInput } from "./types";

const csvHeaderSchema = z.object({
  tier: z.string(),
  type: z.string(),
  cn: z.string(),
  en: z.string(),
  variants: z.string().optional(),
  tags: z.string().optional()
});

export const parseCsvQuestions = async (fileBuffer: Buffer): Promise<QuestionInput[]> => {
  const results = Papa.parse<Record<string, string>>(fileBuffer.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string, _index: number) => header.trim().toLowerCase()
  });

  if (results.errors.length) {
    const firstError = results.errors[0];
    const errorMessage = `${firstError.code ?? firstError.type}: ${firstError.message}`;
    throw new Error(`CSV 解析失败：${errorMessage}`);
  }

  const rows = results.data.map(raw => {
    const parsed = csvHeaderSchema.parse(raw);
    return {
      tier: Number(parsed.tier),
      type: parsed.type as QuestionInput["type"],
      cn: parsed.cn,
      en: parsed.en,
      variants: parsed.variants ? parsed.variants.split("|").map(v => v.trim()).filter(Boolean) : [],
      tags: parsed.tags ? parsed.tags.split("|").map(v => v.trim()).filter(Boolean) : []
    } satisfies QuestionInput;
  });

  return questionImportSchema.parse(rows);
};

export const parseJsonQuestions = (payload: unknown): QuestionInput[] => questionImportSchema.parse(payload);
