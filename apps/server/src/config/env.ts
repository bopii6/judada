import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const dotenvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env")
];

for (const dotenvPath of dotenvPaths) {
  if (fs.existsSync(dotenvPath)) {
    dotenv.config({ path: dotenvPath });
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  ADMIN_KEY: z.string().min(1, "ADMIN_KEY is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_STORAGE_BUCKET: z.string().min(1, "SUPABASE_STORAGE_BUCKET is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL_NAME: z.string().default("gpt-4.1-mini"),
  TENCENT_SECRET_ID: z.string().min(1, "TENCENT_SECRET_ID is required"),
  TENCENT_SECRET_KEY: z.string().min(1, "TENCENT_SECRET_KEY is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  QUEUE_PREFIX: z.string().default("course-gen"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required")
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export const getEnv = (): Env => {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
};
