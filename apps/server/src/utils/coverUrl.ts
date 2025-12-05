import { getEnv } from "../config/env";
import { getSupabase } from "../lib/supabase";

const { SUPABASE_STORAGE_BUCKET, SUPABASE_URL } = getEnv();
const supabaseHost = new URL(SUPABASE_URL).host;
const STORAGE_PATH_REGEX = /\/object\/(?:sign|public)\/([^/]+)\/(.+)/;
const supabaseClient = getSupabase();

type CoverUrlCacheEntry = {
  url: string;
  expiresAt: number;
};

const coverUrlCache = new Map<string, CoverUrlCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache

const extractStoragePath = (rawUrl?: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.host !== supabaseHost) {
      return null;
    }
    const match = parsed.pathname.match(STORAGE_PATH_REGEX);
    if (!match) {
      return null;
    }
    const bucketFromUrl = match[1];
    if (bucketFromUrl !== SUPABASE_STORAGE_BUCKET) {
      return null;
    }
    return decodeURIComponent(match[2]);
  } catch {
    // 不是一个绝对 URL，可能已经是存储路径
    const normalized = rawUrl.replace(/^\/+/, "");
    if (normalized.startsWith("packages/")) {
      return normalized;
    }
    return null;
  }
};

export const ensureCourseCoverUrl = async (rawUrl?: string | null): Promise<string | null> => {
  const storagePath = extractStoragePath(rawUrl);
  if (!storagePath) {
    return rawUrl ?? null;
  }

  const cacheKey = storagePath;
  const cached = coverUrlCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  try {
    const { data, error } = await supabaseClient.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (error || !data?.signedUrl) {
      console.warn(`[cover-url] 重新签名失败 path=${storagePath} error=${error?.message ?? "unknown"}`);
      return rawUrl ?? null;
    }

    const signedUrl = data.signedUrl;
    coverUrlCache.set(cacheKey, {
      url: signedUrl,
      expiresAt: now + CACHE_TTL_MS
    });
    return signedUrl;
  } catch (error) {
    console.error("[cover-url] 生成签名 URL 异常", error);
    return rawUrl ?? null;
  }
};
