import type { Express } from "express";
import path from "node:path";
import type { IAudioMetadata } from "music-metadata";
import { Prisma, MusicTrackStatus } from "@prisma/client";

// 本地类型定义，避免共享包导入问题
export interface MusicWord {
  time: number;
  duration: number;
  text: string;
  hint?: string;
  guide?: string;
}

export interface MusicPhrase {
  start: number;
  end: number;
  en: string;
  zh?: string;
  tip?: string;
}
import { getPrisma } from "../lib/prisma";
import { getSupabase } from "../lib/supabase";
import { getEnv } from "../config/env";
import { slugify } from "../utils/slugify";
import { HttpError } from "../utils/errors";
import { transcribeAudioFromUrl } from "./musicTranscription.service";

const prisma = getPrisma();
const AUDIO_ROOT_FOLDER = "music";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

interface CreateTrackInput {
  file: Express.Multer.File;
  title?: string | null;
  artist?: string | null;
  description?: string | null;
}

interface UpdateTrackInput {
  title?: string;
  artist?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  status?: MusicTrackStatus;
  words?: MusicWord[];
  phrases?: MusicPhrase[];
}

const sanitizeJson = (value: unknown): Prisma.InputJsonValue | null =>
  value === undefined ? null : (value as Prisma.InputJsonValue);

const toWordArray = (value: Prisma.JsonValue | null): MusicWord[] => {
  if (Array.isArray(value)) {
    return value as unknown as MusicWord[];
  }
  return [];
};

const toPhraseArray = (value: Prisma.JsonValue | null): MusicPhrase[] => {
  if (Array.isArray(value)) {
    return value as unknown as MusicPhrase[];
  }
  return [];
};


const serializeMetadata = (metadata: IAudioMetadata | null) => {
  if (!metadata) return null;
  return {
    format: {
      duration: metadata.format.duration,
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      numberOfChannels: metadata.format.numberOfChannels,
      codec: metadata.format.codec
    },
    tags: {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      albumartist: metadata.common.albumartist,
      genre: metadata.common.genre,
      year: metadata.common.year,
      track: metadata.common.track?.no
    }
  };
};

const fetchSignedUrl = async (storagePath: string | null) => {
  if (!storagePath) return null;
  const { SUPABASE_STORAGE_BUCKET } = getEnv();
  const supabase = getSupabase();
  const { error, data } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
};

const ensureUniqueSlug = async (title: string) => {
  const base = slugify(title);
  let candidate = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.musicTrack.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
};

const normalizeMimeType = (file: Express.Multer.File) => {
  if (file.mimetype) return file.mimetype;
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".aac") return "audio/aac";
  return "application/octet-stream";
};

const formatTrackResponse = async (track: Prisma.MusicTrackGetPayload<Record<string, never>>) => {
  const audioUrl = await fetchSignedUrl(track.audioStoragePath);
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    artist: track.artist,
    description: track.description,
    coverUrl: track.coverUrl,
    status: track.status,
    durationMs: track.durationMs,
    audioUrl,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    publishedAt: track.publishedAt,
    words: toWordArray(track.words),
    phrases: toPhraseArray(track.phrases),
    metadata: track.metadata ?? null
  };
};

export const musicTrackService = {
  listForAdmin: async () => {
    const tracks = await prisma.musicTrack.findMany({
      orderBy: { createdAt: "desc" }
    });
    return Promise.all(tracks.map(formatTrackResponse));
  },

  getForAdmin: async (id: string) => {
    const track = await prisma.musicTrack.findUnique({ where: { id } });
    if (!track) {
      throw new HttpError(404, "音乐曲目不存在");
    }
    return formatTrackResponse(track);
  },

  createFromUpload: async ({ file, title, artist, description }: CreateTrackInput) => {
    if (!file || !file.buffer || !file.buffer.length) {
      throw new HttpError(400, "请上传有效的音频文件");
    }
    const mimeType = normalizeMimeType(file);
    if (!mimeType.startsWith("audio/")) {
      throw new HttpError(400, "仅支持上传音频文件（MP3/WAV/AAC）");
    }

    const metadata = await getMusicMetadataModule()
      .then(module => module.parseBuffer(file.buffer, mimeType))
      .catch(() => null);
    const inferredTitle = title?.trim() || metadata?.common.title || path.parse(file.originalname).name;
    const inferredArtist = artist?.trim() || metadata?.common.artist || null;
    const resolvedSlug = await ensureUniqueSlug(inferredTitle);

    const safeBase = slugify(path.parse(file.originalname).name) || resolvedSlug;
    const ext = path.extname(file.originalname) || ".mp3";
    const fileName = `${Date.now()}-${safeBase}${ext}`;
    const storagePath = `${AUDIO_ROOT_FOLDER}/${resolvedSlug}/${fileName}`;

    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const supabase = getSupabase();
    const uploadResult = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, file.buffer, { contentType: mimeType, upsert: false });

    if (uploadResult.error) {
      throw new HttpError(500, `上传音频失败：${uploadResult.error.message}`);
    }

    let autoPhrases: MusicPhrase[] = [];
    let transcriptionRaw: unknown = null;

    // Use signed URL for ASR to avoid payload size limits
    const signedUrl = await fetchSignedUrl(storagePath);
    if (!signedUrl) {
      console.warn("[music-track] Failed to generate signed URL for ASR");
    } else {
      console.log("[music-track] Starting ASR with signed URL:", signedUrl);
      const transcription = await transcribeAudioFromUrl(signedUrl);

      if (!transcription.success) {
        console.error("[music-track] ASR failed:", transcription.error);
        throw new HttpError(500, `语音识别失败：${transcription.error}`);
      } else if (!transcription.data?.phrases?.length) {
        console.warn("[music-track] ASR succeeded but returned no phrases. Raw:", transcription.data?.raw);
        throw new HttpError(400, "语音识别完成但未提取到歌词，请确认音频清晰度或语言是否匹配");
      } else {
        console.log("[music-track] ASR succeeded with", transcription.data.phrases.length, "phrases");
        autoPhrases = transcription.data.phrases;
        transcriptionRaw = transcription.data.raw;
      }
    }

    const metadataPayload: Record<string, unknown> = serializeMetadata(metadata) ?? {};
    if (transcriptionRaw) {
      metadataPayload.autoTranscription = transcriptionRaw;
    }
    const metadataValue = Object.keys(metadataPayload).length ? metadataPayload : null;

    const created = await prisma.musicTrack.create({
      data: {
        title: inferredTitle,
        slug: resolvedSlug,
        artist: inferredArtist,
        description: description ?? null,
        durationMs: metadata?.format.duration ? Math.round(metadata.format.duration * 1000) : null,
        status: MusicTrackStatus.draft,
        audioStoragePath: storagePath,
        audioMimeType: mimeType,
        audioFileSize: file.size,
        metadata: metadataValue ? sanitizeJson(metadataValue) : null,
        words: [],
        phrases: autoPhrases ? sanitizeJson(autoPhrases) : null
      }
    });

    return formatTrackResponse(created);
  },

  updateTrack: async (id: string, payload: UpdateTrackInput) => {
    const existing = await prisma.musicTrack.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "音乐曲目不存在");
    }

    const nextStatus = payload.status ?? existing.status;
    const shouldPublish = existing.status !== MusicTrackStatus.published && nextStatus === MusicTrackStatus.published;
    const shouldUnpublish =
      existing.status === MusicTrackStatus.published && nextStatus !== MusicTrackStatus.published;

    const updated = await prisma.musicTrack.update({
      where: { id },
      data: {
        title: payload.title ?? existing.title,
        artist: payload.artist ?? null,
        description: payload.description ?? null,
        coverUrl: payload.coverUrl ?? null,
        status: nextStatus,
        words: payload.words ? sanitizeJson(payload.words) : null,
        phrases: payload.phrases ? sanitizeJson(payload.phrases) : null,
        publishedAt: shouldPublish ? new Date() : shouldUnpublish ? null : existing.publishedAt
      }
    });

    return formatTrackResponse(updated);
  },

  listPublished: async () => {
    const tracks = await prisma.musicTrack.findMany({
      where: { status: MusicTrackStatus.published },
      orderBy: { createdAt: "desc" }
    });
    return Promise.all(tracks.map(formatTrackResponse));
  },

  getPublishedBySlug: async (slug: string) => {
    const track = await prisma.musicTrack.findFirst({
      where: {
        slug,
        status: MusicTrackStatus.published
      }
    });
    if (!track) {
      throw new HttpError(404, "音乐关卡不存在或未发布");
    }
    return formatTrackResponse(track);
  },

  deleteTrack: async (id: string) => {
    const existing = await prisma.musicTrack.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "音乐曲目不存在");
    }

    // If the track is published, don't allow deletion
    if (existing.status === MusicTrackStatus.published) {
      throw new HttpError(400, "已上架的曲目不能删除，请先下架");
    }

    await prisma.musicTrack.delete({ where: { id } });
  }
};
let musicMetadataModulePromise: Promise<typeof import("music-metadata")> | null = null;
const getMusicMetadataModule = () => {
  if (!musicMetadataModulePromise) {
    musicMetadataModulePromise = import("music-metadata");
  }
  return musicMetadataModulePromise;
};
