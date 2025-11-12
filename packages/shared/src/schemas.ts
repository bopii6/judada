import { z } from "zod";
import type { QuestionType } from "./types";

export const questionTypeEnum = z.enum(["type", "tiles", "listenTap", "speak"]).describe("Question interaction type");

export const questionSchema = z
  .object({
    id: z.string().uuid().optional(),
    bankId: z.string().uuid().optional(),
    tier: z.number().int().min(1).max(6),
    type: questionTypeEnum,
    cn: z.string().min(1).max(280),
    en: z.string().min(1).max(280),
    variants: z
      .union([
        z.array(z.string().min(1)),
        z.string().transform(value => value.split(/[|]/g).map(v => v.trim()).filter(Boolean))
      ])
      .optional()
      .transform(value => (Array.isArray(value) ? value : value ?? [])),
    tags: z
      .union([
        z.array(z.string().min(1)),
        z.string().transform(value => value.split(/[|]/g).map(v => v.trim()).filter(Boolean))
      ])
      .optional()
      .transform(value => (Array.isArray(value) ? value : value ?? []))
  })
  .transform(data => ({
    ...data,
    variants: data.variants ?? [],
    tags: data.tags ?? []
  }));

export type QuestionSchema = z.infer<typeof questionSchema>;

export const questionBankSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9\-_.]+$/, 'Bank code may contain alphanumeric characters, dash, underscore or dot.'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  levelMin: z.number().int().min(1).max(6),
  levelMax: z.number().int().min(1).max(6),
  isPlacement: z.boolean().optional().default(false)
});

export type QuestionBankSchema = z.infer<typeof questionBankSchema>;

export const questionImportSchema = z.array(questionSchema);

export const recordInputSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().max(512),
  durationMs: z.number().int().nonnegative(),
  correct: z.boolean().optional()
});

export const recordBatchSchema = z.array(recordInputSchema).min(1);

export type QuestionTypeEnum = QuestionType;

