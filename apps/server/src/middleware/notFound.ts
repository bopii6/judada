import { Request, Response } from "express";

export const notFoundHandler = (req: Request, res: Response) => {
  console.warn(`[404] 未匹配路由 method=${req.method} url=${req.originalUrl}`);
  res.status(404).json({ error: "Not Found" });
};
