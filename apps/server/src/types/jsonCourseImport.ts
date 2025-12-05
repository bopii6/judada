import { z } from "zod";

export const jsonSentenceSchema = z.object({
  title: z.string().trim().min(1).optional(),
  en: z.string().trim().min(1, "句子英文内容不能为空"),
  cn: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  difficulty: z.number().int().min(1).max(6).optional(),
  pageNumber: z.number().int().positive().optional(),
  audioUrl: z.string().trim().url().optional(),
  imageUrl: z.string().trim().max(300).optional(),
  type: z.string().trim().optional(),
  payload: z.record(z.unknown()).optional()
});

export const jsonRoundSchema = z.object({
  title: z.string().trim().optional(),
  roundNumber: z.number().int().min(1).max(20).optional(),
  sentences: z.array(jsonSentenceSchema).min(1, "每一轮至少需要 1 条句子")
});

export const jsonUnitSchema = z.object({
  unitId: z.string().uuid().optional(),
  sequence: z.number().int().min(1).optional(),
  title: z.string().trim().min(1, "单元标题不能为空"),
  description: z.string().trim().optional(),
  rounds: z
    .array(jsonRoundSchema)
    .min(1, "至少需要一轮关卡")
    .max(8, "单元内的轮次不应超过 8 轮")
});

export const jsonCourseImportSchema = z.object({
  packageSummary: z.string().trim().optional(),
  rounds: z.number().int().min(1).max(20).optional(),
  sentencesPerRound: z.number().int().min(1).max(64).optional(),
  units: z.array(jsonUnitSchema).nonempty("必须至少包含一个单元")
});

export type JsonSentence = z.infer<typeof jsonSentenceSchema>;
export type JsonRound = z.infer<typeof jsonRoundSchema>;
export type JsonUnit = z.infer<typeof jsonUnitSchema>;
export type JsonCourseImportPayload = z.infer<typeof jsonCourseImportSchema>;

