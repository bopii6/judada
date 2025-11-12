import { Router } from "express";
import { coursePackageService } from "../services";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

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
