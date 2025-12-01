import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { getEnv } from "../config/env";

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        name?: string;
        loginType: string;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "访问令牌缺失",
      });
    }

    const env = getEnv();
    const jwtSecret = env.JWT_SECRET;

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        // JWT 验证失败时，先尝试游客 token（base64 json）
        try {
          const guestToken = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
          if (guestToken.type === "guest" && guestToken.id) {
            req.user = {
              id: guestToken.id,
              loginType: "guest"
            };
            return next();
          }
        } catch {
          // not a guest token, fall through
        }
        console.error("JWT验证失败:", err);
        return res.status(403).json({
          success: false,
          message: "访问令牌无效或已过期"
        });
      }

      req.user = decoded as Express.Request["user"];
      next();
    });
  } catch (error) {
    console.error("认证中间件错误:", error);
    return res.status(500).json({
      success: false,
      message: "认证验证失败"
    });
  }
};

// 游客令牌验证（更宽松的验证）
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      // 没有token，继续执行但不设置用户信息
      return next();
    }

    const env = getEnv();
    const jwtSecret = env.JWT_SECRET;

    // 尝试验证JWT token
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        // JWT验证失败，尝试验证游客token
        try {
          const guestToken = JSON.parse(atob(token));
          if (guestToken.type === "guest" && guestToken.id) {
            req.user = {
              id: guestToken.id,
              loginType: "guest"
            };
          }
        } catch (guestErr) {
          // 游客token也无效，继续执行但不设置用户信息
        }
      } else {
        req.user = decoded as Express.Request["user"];
      }
      next();
    });
  } catch (error) {
    console.error("可选认证中间件错误:", error);
    next(); // 继续执行
  }
};
