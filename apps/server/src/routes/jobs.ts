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

router.get("/:jobId", async (req, res, next) => {
  try {
    const job = await coursePackageService.getGenerationJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "任务不存在" });
      return;
    }
    res.json({ job });
  } catch (error) {
    next(error);
  }
});

export default router;
