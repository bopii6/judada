import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import jobsRoutes from "./jobs";
import coursesRoutes from "./courses";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/jobs", jobsRoutes);
router.use("/courses", coursesRoutes);

export default router;
