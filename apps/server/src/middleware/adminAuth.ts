import { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env";
import { HttpError } from "../utils/errors";

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const { ADMIN_KEY } = getEnv();
  const provided = req.header("x-admin-key");
  if (!provided || provided !== ADMIN_KEY) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }
  next();
};
