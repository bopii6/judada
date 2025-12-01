import { Router } from "express";

import adminRoutes from "./admin";
import authRoutes from "./auth";
import coursesRoutes from "./courses";
import deviceRoutes from "./device";
import dictionaryRoutes from "./dictionary";
import emailAuthRoutes from "./email-auth";
import jobsRoutes from "./jobs";
import musicRoutes from "./music";
import publicAssetsRoutes from "./publicAssets";
import userProgressRoutes from "./user-progress";

const router = Router();

router.use("/auth", authRoutes);
router.use("/email-auth", emailAuthRoutes);
router.use("/admin", adminRoutes);
router.use("/jobs", jobsRoutes);
router.use("/courses", coursesRoutes);
router.use("/user", userProgressRoutes);
router.use("/device", deviceRoutes);
router.use("/music", musicRoutes);
router.use("/dictionary", dictionaryRoutes);
router.use("/", publicAssetsRoutes);

export default router;
