import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import jobsRoutes from "./jobs";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/jobs", jobsRoutes);

export default router;
