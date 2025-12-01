import path from "node:path";

import { Router } from "express";

import { getEnv } from "../config/env";
import { getSupabase } from "../lib/supabase";

const router = Router();
const supabase = getSupabase();
const { SUPABASE_STORAGE_BUCKET } = getEnv();
const COVER_FOLDER = "course-covers";
const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

router.get("/course-covers/:packageId/:fileName", async (req, res, next) => {
  try {
    const { packageId, fileName } = req.params;
    console.info(`[public-assets][course-cover] 请求封面 packageId=${packageId} file=${fileName}`);

    if (!packageId || !fileName) {
      console.warn("[public-assets][course-cover] 缺少 packageId 或 fileName 参数");
      res.status(400).json({ error: "缺少封面参数" });
      return;
    }

    const storagePath = `${COVER_FOLDER}/${packageId}/${fileName}`;
    const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(storagePath);
    if (error || !data) {
      console.warn(
        `[public-assets][course-cover] 下载失败 packageId=${packageId} path=${storagePath} message=${error?.message}`
      );
      res.status(404).json({ error: "封面不存在" });
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType = MIME_MAP[path.extname(fileName).toLowerCase()] ?? "image/jpeg";
    console.info(
      `[public-assets][course-cover] 下载成功 packageId=${packageId} bytes=${buffer.length} mime=${mimeType}`
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    console.error(
      `[public-assets][course-cover] 处理异常 packageId=${req.params.packageId} message=${(error as Error).message}`
    );
    next(error);
  }
});

export default router;
