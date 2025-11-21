import { MusicPhrase, MusicGapOptions } from "@judada/shared";
import * as tencentcloud from "tencentcloud-sdk-nodejs";
import { getEnv } from "../config/env";

const { asr } = tencentcloud;

let asrClient: InstanceType<typeof asr.v20190614.Client> | null = null;

const getAsrClient = () => {
  if (asrClient) return asrClient;
  const env = getEnv();
  asrClient = new asr.v20190614.Client({
    credential: {
      secretId: env.TENCENT_SECRET_ID,
      secretKey: env.TENCENT_SECRET_KEY
    },
    region: env.TENCENT_ASR_REGION,
    profile: {
      httpProfile: {
        endpoint: "asr.tencentcloudapi.com",
        proxy: "" // Disable proxy to avoid ECONNREFUSED if system proxy is set
      }
    }
  });
  return asrClient;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isTransientError = (error: unknown) => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as any)?.message === "string"
          ? (error as any).message
          : "";
  if (!message) return false;
  return (
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENETUNREACH") ||
    message.includes("timeout") ||
    message.includes("ECONNREFUSED")
  );
};

export interface TranscriptionResult {
  phrases: MusicPhrase[];
  gapOptions: MusicGapOptions;
  raw?: unknown;
}

export interface TranscriptionOutcome {
  success: boolean;
  data?: TranscriptionResult | null;
  error?: string;
}

interface TranscribeOptions {
  sourceType: 0 | 1; // 0: Url, 1: Data
  url?: string;
  data?: string;
  dataLen?: number;
}

const transcribe = async (options: TranscribeOptions): Promise<TranscriptionOutcome> => {
  const env = getEnv();
  const client = getAsrClient();

  const runTranscription = async () => {
    const createParams: any = {
      EngineModelType: env.TENCENT_ASR_ENGINE,
      ChannelNum: 1,
      ResTextFormat: 3,
      SourceType: options.sourceType,
      FilterPunc: 0,
      FilterModal: 0,
      ConvertNumMode: 1,
      SpeakerDiarization: 0
    };

    if (options.sourceType === 1) {
      createParams.Data = options.data;
      createParams.DataLen = options.dataLen;
    } else {
      createParams.Url = options.url;
    }

    let taskId: number | null = null;
    const createRetryLimit = 3;
    for (let attempt = 1; attempt <= createRetryLimit; attempt += 1) {
      try {
        const createResp = await client.CreateRecTask(createParams);
        taskId = createResp?.Data?.TaskId ?? null;
        if (!taskId) throw new Error("Failed to create Tencent ASR task");
        break;
      } catch (error) {
        if (attempt === createRetryLimit || !isTransientError(error)) {
          throw error;
        }
        await wait(3000);
      }
    }

    if (!taskId) {
      throw new Error("Failed to create Tencent ASR task");
    }

    let attempts = 0;
    const maxAttempts = 60; // Increased wait time for URL download
    const intervalMs = 2000;
    let finalResult: unknown = null;

    while (attempts < maxAttempts) {
      attempts += 1;
      let statusResp: any = null;
      try {
        statusResp = await client.DescribeTaskStatus({ TaskId: taskId });
      } catch (error) {
        if (isTransientError(error)) {
          await wait(intervalMs);
          continue;
        }
        throw error;
      }
      const status = statusResp?.Data?.StatusStr;
      if (status === "success") {
        // Use ResultDetail for structured data (ResTextFormat=3)
        finalResult = statusResp?.Data?.ResultDetail;
        if (!Array.isArray(finalResult) || finalResult.length === 0) {
          finalResult = statusResp?.Data?.Result;
        }
        console.log("[music-transcription] ASR Result (Raw):", JSON.stringify(finalResult, null, 2));
        break;
      }
      if (status === "failed") {
        throw new Error(statusResp?.Data?.ErrorMsg ?? "Tencent ASR task failed");
      }
      await wait(intervalMs);
    }

    if (!finalResult) {
      return null;
    }

    // If finalResult is already an object/array (ResultDetail), use it directly.
    // If it's a string (Result), try to parse it.
    const parsed = typeof finalResult === "string" ? safeJsonParse(finalResult) : finalResult;
    return normalizeTranscription(parsed);
  };

  const overallRetries = 2;
  for (let attempt = 1; attempt <= overallRetries; attempt += 1) {
    try {
      const data = await runTranscription();
      return { success: true, data };
    } catch (error) {
      if (attempt === overallRetries || !isTransientError(error)) {
        console.error("[music-transcription] Tencent ASR failed", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
      await wait(5000 * attempt);
    }
  }
  return { success: false, error: "ASR retries exhausted" };
};

export const transcribeAudioFromBuffer = async (audioBuffer: Buffer): Promise<TranscriptionOutcome> => {
  return transcribe({
    sourceType: 1,
    data: audioBuffer.toString("base64"),
    dataLen: audioBuffer.length
  });
};

export const transcribeAudioFromUrl = async (url: string): Promise<TranscriptionOutcome> => {
  return transcribe({
    sourceType: 0,
    url
  });
};

const safeJsonParse = (payload: string) => {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const normalizeTranscription = (data: any): TranscriptionResult => {
  const detail = Array.isArray(data?.detail)
    ? data.detail
    : Array.isArray(data)
      ? data
      : [];

  const phrases: MusicPhrase[] = detail
    .map((segment: any) => {
      // Handle various ASR response formats including Tencent Cloud ResultDetail
      const start = Math.max(0, Math.round(segment.start_time ?? segment.bg ?? segment.StartMs ?? 0));
      const endCandidate = Math.round(segment.end_time ?? segment.ed ?? segment.EndMs ?? start + 1500);
      const end = endCandidate > start ? endCandidate : start + 1500;
      const text = (segment.onebest ?? segment.final ?? segment.result ?? segment.text ?? segment.FinalSentence ?? "").trim();
      if (!text) return null;
      return {
        start,
        end,
        en: text,
        zh: segment.trans ?? text,
        tip: segment.words?.length ? `关注 ${segment.words[0].word}` : undefined
      } as MusicPhrase;
    })
    .filter((p: MusicPhrase | null): p is MusicPhrase => p !== null);

  return {
    phrases,
    gapOptions: {},
    raw: data
  };
};

const buildGapOptions = (phrases: MusicPhrase[]): MusicGapOptions => {
  const fallback = ["baby", "shark", "family", "run", "safe", "hunt", "away", "love", "sing", "play"];
  const options: MusicGapOptions = {};

  let index = 1;
  for (const phrase of phrases) {
    if (index > 5) break;
    const tokens = phrase.en
      .split(/\s+/)
      .map(token => token.replace(/[^a-zA-Z]/g, "").toLowerCase())
      .filter(Boolean);
    if (!tokens.length) continue;
    const keyword = tokens[Math.min(tokens.length - 1, Math.floor(tokens.length / 2))];
    const variantSet = new Set<string>([keyword]);
    let fallbackIndex = index;
    while (variantSet.size < 3) {
      variantSet.add(fallback[fallbackIndex % fallback.length]);
      fallbackIndex += 1;
    }
    options[index.toString()] = Array.from(variantSet);
    index += 1;
  }

  return options;
};
