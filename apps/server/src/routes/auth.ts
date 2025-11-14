import { Router } from "express";
import { z } from "zod";

const router = Router();

const loginBodySchema = z.object({
  name: z.string().min(1, "姓名不能为空")
});

/**
 * 登录接口目前仍是占位实现：
 * - 确保前端能够走一遍“提交 -> 获取 token -> 持久化”的流程。
 * - 之后会换成 Supabase Auth，返回真实的 access token 与刷新机制。
 */
/**
 * 管理员登录接口（保留原有功能）
 */
router.post("/login", (req, res, next) => {
  try {
    const { name } = loginBodySchema.parse(req.body);
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
