import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { MusicTrackStatus } from "@prisma/client";
import { requireAdmin } from "../middleware/adminAuth";
import { coursePackageService, musicTrackService, unitService } from "../services";
import { lessonRepository } from "../repositories";
import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

const router: ExpressRouter = Router();

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

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.toLowerCase().startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("仅支持 PNG/JPG/WebP 图片作为封面"));
  }
});

const createPackageSchema = z.object({
  title: z.string().min(1, "请填写课程包标题"),
  topic: z.string().min(1, "请填写课程主题"),
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  label: z.string().optional(),
  notes: z.string().optional(),
  grade: z.string().optional(),      // 年级
  publisher: z.string().optional(),  // 出版社
  semester: z.string().optional()    // 学期
});


const updatePackageSchema = z.object({
  title: z.string().min(1, "请填写课程包标题").optional(),
  topic: z.string().min(1, "请填写课程主题").optional(),
  description: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),      // 年级
  publisher: z.string().optional().nullable(),  // 出版社
  semester: z.string().optional().nullable()    // 学期
});

const generateRequestSchema = z.object({
  triggeredById: z.string().uuid().optional()
});

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
        grade: pkg.grade,
        publisher: pkg.publisher,
        semester: pkg.semester,
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

router.post(
  "/course-packages/:id/cover",
  coverUpload.single("cover"),
  async (req, res, next) => {
    try {
      console.info(
        `[admin][cover-upload] 开始处理封面上传 packageId=${req.params.id} method=${req.method} url=${req.originalUrl}`
      );

      if (!req.file) {
        console.warn(
          `[admin][cover-upload] 未收到文件 packageId=${req.params.id} headers=${JSON.stringify(req.headers)}`
        );
        res.status(400).json({ error: "请上传封面图像" });
        return;
      }

      const result = await coursePackageService.updateCoverImage(req.params.id, req.file);
      console.info(
        `[admin][cover-upload] 上传成功 packageId=${req.params.id} mime=${req.file.mimetype} size=${req.file.size}B url=${result.coverUrl}`
      );
      res.json({ coverUrl: result.coverUrl });
    } catch (error) {
      console.error(
        `[admin][cover-upload] 处理失败 packageId=${req.params.id} message=${(error as Error).message}`
      );
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

router.put("/course-packages/:id", async (req, res, next) => {
  try {
    const payload = updatePackageSchema.parse(req.body ?? {});
    const detail = await coursePackageService.updatePackageMetadata(req.params.id, payload);
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

// 更新关卡单元信息
const updateLessonSchema = z.object({
  unitNumber: z.number().int().positive().nullable().optional(),
  unitName: z.string().nullable().optional()
});

const batchUpdateLessonsSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1, "请至少选择一个关卡"),
  unitNumber: z.number().int().positive().nullable().optional(),
  unitName: z.string().nullable().optional()
});

router.put("/course-packages/:packageId/lessons/:lessonId", async (req, res, next) => {
  try {
    const { packageId, lessonId } = req.params;
    const payload = updateLessonSchema.parse(req.body);
    
    // 验证关卡属于该课程包
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        packageId,
        deletedAt: null
      }
    });

    if (!lesson) {
      res.status(404).json({ error: "关卡不存在或不属于该课程包" });
      return;
    }

    const updated = await lessonRepository.update(lessonId, {
      unitNumber: payload.unitNumber ?? undefined,
      unitName: payload.unitName ?? undefined
    });

    res.json({ lesson: updated });
  } catch (error) {
    next(error);
  }
});

// 批量更新关卡单元信息
router.put("/course-packages/:packageId/lessons", async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const { lessonIds, unitNumber, unitName } = batchUpdateLessonsSchema.parse(req.body);
    
    // 验证所有关卡都属于该课程包
    const lessons = await prisma.lesson.findMany({
      where: {
        id: { in: lessonIds },
        packageId,
        deletedAt: null
      }
    });

    if (lessons.length !== lessonIds.length) {
      res.status(400).json({ error: "部分关卡不存在或不属于该课程包" });
      return;
    }

    const updateData: any = {};
    if (unitNumber !== undefined) updateData.unitNumber = unitNumber;
    if (unitName !== undefined) updateData.unitName = unitName;

    await lessonRepository.updateMany(
      { id: { in: lessonIds } },
      updateData
    );

    res.json({ success: true, updatedCount: lessonIds.length });
  } catch (error) {
    next(error);
  }
});

// ==================== 单元管理 API ====================

// 获取课程包下的所有单元
router.get("/course-packages/:packageId/units", async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const units = await unitService.listByPackageId(packageId);
    res.json({ units });
  } catch (error) {
    next(error);
  }
});

// 获取单个单元详情
router.get("/units/:unitId", async (req, res, next) => {
  try {
    const unit = await unitService.getById(req.params.unitId);
    if (!unit) {
      res.status(404).json({ error: "单元不存在" });
      return;
    }
    res.json({ unit });
  } catch (error) {
    next(error);
  }
});

// 创建新单元
const createUnitSchema = z.object({
  title: z.string().min(1, "请填写单元标题"),
  description: z.string().optional(),
  sequence: z.number().int().positive().optional()
});

router.post("/course-packages/:packageId/units", async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const payload = createUnitSchema.parse(req.body);
    
    // 验证课程包存在
    const pkg = await prisma.coursePackage.findUnique({
      where: { id: packageId }
    });
    if (!pkg) {
      res.status(404).json({ error: "课程包不存在" });
      return;
    }

    // 获取下一个序号（包括软删除的记录，因为sequence有唯一约束）
    const maxSeq = await (prisma as any).unit.aggregate({
      where: { packageId },
      _max: { sequence: true }
    });
    const sequence = payload.sequence ?? (maxSeq._max?.sequence ?? 0) + 1;

    const unit = await unitService.create({
      packageId,
      sequence,
      title: payload.title,
      description: payload.description
    });

    res.status(201).json({ unit });
  } catch (error) {
    next(error);
  }
});

// 更新单元信息
const updateUnitSchema = z.object({
  title: z.string().min(1, "请填写单元标题").optional(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  status: z.enum(["draft", "pending_review", "published", "archived"]).optional()
});

router.put("/units/:unitId", async (req, res, next) => {
  try {
    const payload = updateUnitSchema.parse(req.body);
    const unit = await unitService.update(req.params.unitId, payload as any);
    res.json({ unit });
  } catch (error) {
    next(error);
  }
});

// 发布单元
router.post("/units/:unitId/publish", async (req, res, next) => {
  try {
    const result = await unitService.publish(req.params.unitId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 下架单元
router.post("/units/:unitId/unpublish", async (req, res, next) => {
  try {
    const result = await unitService.unpublish(req.params.unitId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 删除单元
router.delete("/units/:unitId", async (req, res, next) => {
  try {
    await unitService.softDelete(req.params.unitId);
    res.json({ success: true, message: "单元删除成功" });
  } catch (error) {
    next(error);
  }
});

// 为单元上传素材并生成关卡
router.post(
  "/units/:unitId/generate",
  upload.array("files", 10),
  async (req, res, next) => {
    try {
      const { unitId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: "请上传素材文件" });
        return;
      }

      // 获取单元信息
      const unit = await (prisma as any).unit.findUnique({
        where: { id: unitId },
        include: { package: true }
      });

      if (!unit) {
        res.status(404).json({ error: "单元不存在" });
        return;
      }

      // 调用课程包服务上传素材，关联到单元
      const result = await coursePackageService.enqueueGenerationFromUpload({
        packageId: unit.packageId,
        files,
        triggeredById: undefined,
        unitId
      });

      res.status(201).json({
        success: true,
        job: result.job,
        assets: result.assets,
        message: `已为单元「${unit.title}」创建生成任务`
      });
    } catch (error) {
      next(error);
    }
  }
);

// 上传单元封面
router.post(
  "/units/:unitId/cover",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const { unitId } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "请上传封面图片" });
        return;
      }

      // 获取单元
      const unit = await (prisma as any).unit.findUnique({
        where: { id: unitId }
      });

      if (!unit) {
        res.status(404).json({ error: "单元不存在" });
        return;
      }

      // 上传到 Supabase Storage
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const ext = file.originalname.split(".").pop() || "jpg";
      const storagePath = `unit-covers/${unitId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("course-assets")
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        throw new Error(`封面上传失败: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("course-assets")
        .getPublicUrl(storagePath);

      const coverUrl = urlData.publicUrl;

      // 更新单元封面
      const updatedUnit = await unitService.update(unitId, { coverUrl });

      res.json({ unit: updatedUnit, coverUrl });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== 音乐管理 API ====================

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
