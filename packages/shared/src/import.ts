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

export const parseCsvQuestions = async (fileBuffer: Buffer): Promise<QuestionInput[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(fileBuffer.toString("utf8"), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
      complete: (results: Papa.ParseResult<any>) => {
        try {
          const rows = (results.data as Record<string, string>[]).map(raw => {
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
          resolve(questionImportSchema.parse(rows));
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => reject(error)
    });
  });

export const parseJsonQuestions = (payload: unknown): QuestionInput[] => questionImportSchema.parse(payload);
