import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import emailAuthRoutes from "./email-auth";
import jobsRoutes from "./jobs";
import coursesRoutes from "./courses";
import userProgressRoutes from "./user-progress";
import deviceRoutes from "./device";
import musicRoutes from "./music";

const router = Router();

router.use("/auth", authRoutes);
router.use("/email-auth", emailAuthRoutes);
router.use("/admin", adminRoutes);
router.use("/jobs", jobsRoutes);
router.use("/courses", coursesRoutes);
router.use("/user", userProgressRoutes);
router.use("/device", deviceRoutes);
router.use("/music", musicRoutes);

export default router;
