import { Router } from "express";
import path from "node:path";
import { getSupabase } from "../lib/supabase";
import { getEnv } from "../config/env";

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
    if (!packageId || !fileName) {
      res.status(400).json({ error: "缺少封面参数" });
      return;
    }

    const storagePath = `${COVER_FOLDER}/${packageId}/${fileName}`;
    const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(storagePath);
    if (error || !data) {
      res.status(404).json({ error: "封面不存在" });
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType = MIME_MAP[path.extname(fileName).toLowerCase()] ?? "image/jpeg";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
