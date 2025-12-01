import type { Router as ExpressRouter } from "express";
import { Router } from "express";

import { requireAdmin } from "../middleware/adminAuth";
import { coursePackageService } from "../services";

const router: ExpressRouter = Router();

router.use(requireAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const jobs = await coursePackageService.listRecentJobs(20);
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

export default router;
