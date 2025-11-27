import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { MusicTrackStatus } from "@prisma/client";
import { requireAdmin } from "../middleware/adminAuth";
import { coursePackageService, musicTrackService } from "../services";
import type { MusicWord, MusicPhrase } from "../services/musicTrack.service";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  }
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024 // 30MB
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

const numericString = z.preprocess(
  value => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return undefined;
  },
  z.number().int().positive().optional()
);

const createTrackMetadataSchema = z.object({
  title: z.string().trim().optional(),
  titleCn: z.string().trim().optional(),
  artist: z.string().trim().optional(),
  description: z.string().optional()
});

const musicWordSchema = z.object({
  time: z.number().nonnegative(),
  duration: z.number().positive(),
  text: z.string().min(1),
  hint: z.string().optional(),
  guide: z.string().optional()
});

const musicPhraseSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().positive(),
  en: z.string().min(1),
  zh: z.string().optional(),
  tip: z.string().optional()
});

const updateTrackSchema = z.object({
  title: z.string().min(1).optional(),
  titleCn: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  status: z.nativeEnum(MusicTrackStatus).optional(),
  words: z.array(musicWordSchema).optional(),
  phrases: z.array(musicPhraseSchema).optional()
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
  upload.array("files", 10), // 支持最多10张图片
  async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const file = req.file as Express.Multer.File | undefined;

      // 支持单文件或多文件上传
      if (!files || files.length === 0) {
        if (!file) {
          const message = "请先上传 PDF 或图片文件（最多10张）";
          res.status(400).json({ error: message });
          return;
        }
      }

      const parsed = generateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "请求参数不正确" });
        return;
      }

      const { job, assets } = await coursePackageService.enqueueGenerationFromUpload({
        packageId: req.params.id,
        files: files && files.length > 0 ? files : (file ? [file] : []),
        triggeredById: parsed.data.triggeredById ?? null
      });

      res.status(202).json({
        job,
        assets: assets || []
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

router.get("/music-tracks", async (_req, res, next) => {
  try {
    const tracks = await musicTrackService.listForAdmin();
    res.json({ tracks });
  } catch (error) {
    next(error);
  }
});

router.get("/music-tracks/:id", async (req, res, next) => {
  try {
    const track = await musicTrackService.getForAdmin(req.params.id);
    res.json({ track });
  } catch (error) {
    next(error);
  }
});

router.post("/music-tracks", audioUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "请先上传音频文件" });
      return;
    }
    const metadata = createTrackMetadataSchema.parse(req.body ?? {});
    const track = await musicTrackService.createFromUpload({
      file: req.file,
      title: metadata.title,
      titleCn: metadata.titleCn,
      artist: metadata.artist,
      description: metadata.description
    });
    res.status(201).json({ track });
  } catch (error) {
    next(error);
  }
});

router.put("/music-tracks/:id", async (req, res, next) => {
  try {
    const payload = updateTrackSchema.parse(req.body);
    const track = await musicTrackService.updateTrack(req.params.id, {
      title: payload.title,
      titleCn: payload.titleCn,
      artist: payload.artist ?? null,
      description: payload.description ?? null,
      coverUrl: payload.coverUrl ?? null,
      status: payload.status,
      words: payload.words,
      phrases: payload.phrases
    });
    res.json({ track });
  } catch (error) {
    next(error);
  }
});

router.delete("/music-tracks/:id", async (req, res, next) => {
  try {
    await musicTrackService.deleteTrack(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// LRC歌词解析路由
const lrcUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB，LRC文件很小
  },
  fileFilter: (req, file, cb) => {
    // 检查文件扩展名
    const allowedExtensions = ['.lrc', '.txt'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .lrc 和 .txt 文件格式'));
    }
  }
});

router.post("/parse-lrc", lrcUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "请先上传LRC歌词文件" });
      return;
    }

    // 导入LRC解析器
    const { parseLrcToJson, validateLrcFormat } = await import("../utils/lrcParser");

    // 将文件buffer转换为字符串
    const lrcContent = req.file.buffer.toString('utf-8');

    // 验证LRC格式
    const validation = validateLrcFormat(lrcContent);
    if (!validation.isValid) {
      res.status(400).json({
        error: "LRC格式不正确",
        details: validation.errors
      });
      return;
    }

    // 解析LRC并转换为JSON
    const phrases = parseLrcToJson(lrcContent);

    res.json({
      success: true,
      phrases: phrases,
      total: phrases.length
    });

  } catch (error) {
    next(error);
  }
});

export default router;
