import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../utils/errors";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // 记录详细错误信息
  console.error('请求错误:', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    url: req.url,
    method: req.method,
    body: req.body,
    ip: req.ip
  });

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      details: err.details ?? null
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: '输入数据验证失败',
      errors: err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message
      }))
    });
  }

  // JWT错误
  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    return res.status(403).json({
      success: false,
      message: '访问令牌无效'
    });
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    return res.status(403).json({
      success: false,
      message: '访问令牌已过期'
    });
  }

  // Redis连接错误
  if (err instanceof Error && err.message.includes('Redis')) {
    return res.status(500).json({
      success: false,
      message: '服务暂时不可用，请稍后重试'
    });
  }

  // 邮件发送错误
  if (err instanceof Error && (err.message.includes('邮件') || err.message.includes('email'))) {
    return res.status(500).json({
      success: false,
      message: '邮件发送失败，请稍后重试'
    });
  }

  // 默认服务器错误
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : `服务器内部错误: ${err instanceof Error ? err.message : String(err)}`
  });
};

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

// 异步错误处理包装器
export const asyncHandler = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 请求验证中间件
export const requestValidator = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};
