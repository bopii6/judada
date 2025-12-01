import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { getEnv } from "../config/env";
import { getPrisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

const passwordLoginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位")
});

const passwordSetSchema = z.object({
  password: z.string().min(6, "密码至少 6 位")
});

const adminLoginSchema = z.object({
  name: z.string().min(1, "姓名不能为空")
});

const issueToken = (payload: { id: string; email?: string; name?: string; loginType: string }) => {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
};

const canonicalUserId = (email: string) =>
  "email-" + Buffer.from(email.toLowerCase()).toString("base64").replace(/[^a-zA-Z0-9]/g, "");

// 确保邮箱密码表存在（无需额外迁移）
async function ensureCredentialTable() {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailCredential" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" text UNIQUE NOT NULL,
      "passwordHash" text NOT NULL,
      "createdAt" timestamp with time zone DEFAULT now(),
      "updatedAt" timestamp with time zone DEFAULT now()
    );
  `);
}

async function ensureUser(email: string, name?: string) {
  const prisma = getPrisma();
  const userId = canonicalUserId(email);
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: email.toLowerCase(), name },
    update: { email: email.toLowerCase(), name: name ?? undefined }
  });
  return userId;
}

/**
 * 邮箱 + 密码登录 / 注册（同一个接口）
 * - 若邮箱尚无密码记录，则自动创建账号并设置密码
 * - 若已有密码，校验通过后返回 JWT
 */
router.post("/password/login", async (req, res, next) => {
  try {
    const { email, password } = passwordLoginSchema.parse(req.body);
    const emailLower = email.toLowerCase();
    await ensureCredentialTable();
    const prisma = getPrisma();

    const rows = (await prisma.$queryRaw`
      SELECT "email", "passwordHash" FROM "EmailCredential" WHERE "email" = ${emailLower} LIMIT 1
    `) as Array<{ email: string; passwordHash: string }>;
    const credential = rows[0];

    if (!credential) {
      // 首次设置，相当于注册
      const hash = await bcrypt.hash(password, 10);
      await prisma.$executeRaw`
        INSERT INTO "EmailCredential" ("email", "passwordHash") VALUES (${emailLower}, ${hash})
        ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now()
      `;
    } else {
      const ok = await bcrypt.compare(password, credential.passwordHash);
      if (!ok) {
        return res.status(400).json({ success: false, message: "邮箱或密码错误" });
      }
    }

    const userId = await ensureUser(emailLower, emailLower.split("@")[0]);
    const token = issueToken({
      id: userId,
      email: emailLower,
      name: emailLower.split("@")[0],
      loginType: "email"
    });

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        email: emailLower,
        name: emailLower.split("@")[0],
        loginType: "email"
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 已登录用户设置/重置密码
 */
router.post("/password/set", authenticateToken, async (req, res, next) => {
  try {
    const { password } = passwordSetSchema.parse(req.body);
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(400).json({ success: false, message: "当前登录态无邮箱，无法设置密码" });
    }
    await ensureCredentialTable();
    const prisma = getPrisma();
    const hash = await bcrypt.hash(password, 10);
    await prisma.$executeRaw`
      INSERT INTO "EmailCredential" ("email", "passwordHash")
      VALUES (${userEmail.toLowerCase()}, ${hash})
      ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now()
    `;
    await ensureUser(userEmail, req.user?.name);
    res.json({ success: true, message: "密码已更新" });
  } catch (error) {
    next(error);
  }
});

/**
 * 管理员登录占位（保留原功能）
 */
router.post("/login", (req, res, next) => {
  try {
    const { name } = adminLoginSchema.parse(req.body);
    res.json({
      token: "demo-token",
      user: {
        id: "demo-user",
        name,
        role: "operator"
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
