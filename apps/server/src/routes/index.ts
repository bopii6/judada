import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import emailAuthRoutes from "./email-auth";
import jobsRoutes from "./jobs";
import coursesRoutes from "./courses";
import userProgressRoutes from "./user-progress";

const router = Router();

router.use("/auth", authRoutes);
router.use("/email-auth", emailAuthRoutes);
router.use("/admin", adminRoutes);
router.use("/jobs", jobsRoutes);
router.use("/courses", coursesRoutes);
router.use("/user", userProgressRoutes);

export default router;
