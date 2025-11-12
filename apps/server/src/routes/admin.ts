import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth";
import { coursePackageService } from "../services";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  }
});

const createPackageSchema = z.object({
  title: z.string().min(1, "请填写课程包标题"),
  topic: z.string().min(1, "请填写课程主题"),
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  label: z.string().optional(),
  notes: z.string().optional()
});

const generateRequestSchema = z.object({
  triggeredById: z.string().uuid().optional()
});

router.use(requireAdmin);

router.get("/overview", async (_req, res, next) => {
  try {
    const stats = await coursePackageService.getOverview();
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

router.get("/course-packages", async (_req, res, next) => {
  try {
    const items = await coursePackageService.listPackages();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post("/course-packages", async (req, res, next) => {
  try {
    const payload = createPackageSchema.parse(req.body);
    const { pkg, version } = await coursePackageService.createDraftPackage(payload);
    res.status(201).json({
      package: {
        id: pkg.id,
        title: pkg.title,
        topic: pkg.topic,
        description: pkg.description,
        coverUrl: pkg.coverUrl,
        status: pkg.status,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
        currentVersionId: pkg.currentVersionId,
        firstVersion: {
          id: version.id,
          status: version.status,
          label: version.label,
          createdAt: version.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/course-packages/:id/generate",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        const message = "请先上传 PDF 或图片文件";
        res.status(400).json({ error: message });
        return;
      }

      const parsed = generateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "请求参数不正确" });
        return;
      }

      const { job, asset } = await coursePackageService.enqueueGenerationFromUpload({
        packageId: req.params.id,
        file: req.file,
        triggeredById: parsed.data.triggeredById ?? null
      });

      res.status(202).json({
        job,
        asset
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/course-packages/:id", async (req, res, next) => {
  try {
    const detail = await coursePackageService.getPackageDetail(req.params.id);
    res.json({ package: detail });
  } catch (error) {
    next(error);
  }
});

router.post("/course-packages/:id/publish", async (req, res, next) => {
  try {
    const result = await coursePackageService.publishCurrentDraft(req.params.id);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

router.delete("/course-packages/:id", async (req, res, next) => {
  try {
    await coursePackageService.deletePackage(req.params.id);
    res.json({ success: true, message: "课程包删除成功" });
  } catch (error) {
    next(error);
  }
});

const deletePackagesSchema = z.object({
  packageIds: z.array(z.string().uuid()).min(1, "请至少选择一个课程包")
});

router.delete("/course-packages", async (req, res, next) => {
  try {
    const { packageIds } = deletePackagesSchema.parse(req.body);
    const result = await coursePackageService.deletePackages(packageIds);
    res.json({
      success: true,
      message: `成功删除 ${result.deletedCount} 个课程包`,
      failedPackages: result.failedPackages
    });
  } catch (error) {
    next(error);
  }
});

export default router;
