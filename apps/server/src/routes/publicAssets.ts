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

type CoverCacheEntry = {
  buffer: Buffer;
  mimeType: string;
  bytes: number;
  expiresAt: number;
  lastAccessed: number;
};

const COVER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const COVER_CACHE_MAX_ITEMS = 200;
const COVER_CACHE_MAX_BYTES = 25 * 1024 * 1024; // ~25MB
const COVER_CACHE_MAX_SINGLE_ENTRY = 8 * 1024 * 1024; // skip very large files

const coverCache = new Map<string, CoverCacheEntry>();
let cachedBytes = 0;

const evictExpiredEntries = () => {
  const now = Date.now();
  for (const [key, entry] of coverCache.entries()) {
    if (entry.expiresAt <= now) {
      coverCache.delete(key);
      cachedBytes -= entry.bytes;
    }
  }
};

const evictIfNeeded = () => {
  if (cachedBytes <= COVER_CACHE_MAX_BYTES && coverCache.size <= COVER_CACHE_MAX_ITEMS) {
    return;
  }
  const candidates = [...coverCache.entries()].sort(
    (a, b) => a[1].lastAccessed - b[1].lastAccessed
  );
  for (const [key, entry] of candidates) {
    coverCache.delete(key);
    cachedBytes -= entry.bytes;
    if (cachedBytes <= COVER_CACHE_MAX_BYTES && coverCache.size <= COVER_CACHE_MAX_ITEMS) {
      break;
    }
  }
};

const getCacheKey = (packageId: string, fileName: string) => `${packageId}/${fileName}`;

const readFromCache = (key: string) => {
  evictExpiredEntries();
  const entry = coverCache.get(key);
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  return entry;
};

const writeToCache = (key: string, buffer: Buffer, mimeType: string) => {
  if (buffer.byteLength > COVER_CACHE_MAX_SINGLE_ENTRY) return;
  const now = Date.now();
  const existing = coverCache.get(key);
  if (existing) {
    cachedBytes -= existing.bytes;
  }
  coverCache.set(key, {
    buffer,
    mimeType,
    bytes: buffer.byteLength,
    lastAccessed: now,
    expiresAt: now + COVER_CACHE_TTL_MS
  });
  cachedBytes += buffer.byteLength;
  evictIfNeeded();
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

    const cacheKey = getCacheKey(packageId, fileName);
    const cached = readFromCache(cacheKey);
    if (cached) {
      console.info(
        `[public-assets][course-cover] 命中缓存 packageId=${packageId} file=${fileName} bytes=${cached.bytes}`
      );
      res.setHeader("Content-Type", cached.mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", cached.bytes.toString());
      res.send(cached.buffer);
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

    const mimeType = MIME_MAP[path.extname(fileName).toLowerCase()] ?? "image/jpeg";
    const buffer = Buffer.from(await data.arrayBuffer());
    writeToCache(cacheKey, buffer, mimeType);
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
