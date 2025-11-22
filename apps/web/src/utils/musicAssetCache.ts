import type { MusicTrackDetail } from "@judada/shared";

const audioCache = new Map<string, string>();
const coverCache = new Map<string, string>();
const pendingAudio = new Map<string, Promise<string>>();
const pendingCover = new Map<string, Promise<string>>();

const cacheBlob = async (url: string, bucket: Map<string, string>, pending: Map<string, Promise<string>>) => {
    if (!url) return url;
    if (bucket.has(url)) return bucket.get(url)!;
    if (pending.has(url)) return pending.get(url)!;

    const task = fetch(url)
        .then(async response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch asset ${url}`);
            }
            return response.blob();
        })
        .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            bucket.set(url, objectUrl);
            pending.delete(url);
            return objectUrl;
        })
        .catch(error => {
            pending.delete(url);
            console.warn("[AssetCache] failed to cache", url, error);
            throw error;
        });

    pending.set(url, task);
    return task;
};

export const warmMusicAssets = async (tracks: MusicTrackDetail[], limit = 4) => {
    const subset = tracks.slice(0, limit);
    const jobs: Promise<unknown>[] = [];

    for (const track of subset) {
        if (track.coverUrl && !coverCache.has(track.coverUrl)) {
            jobs.push(cacheBlob(track.coverUrl, coverCache, pendingCover).catch(() => undefined));
        }
        if (track.audioUrl && !audioCache.has(track.audioUrl)) {
            jobs.push(cacheBlob(track.audioUrl, audioCache, pendingAudio).catch(() => undefined));
        }
    }

    if (jobs.length) {
        await Promise.allSettled(jobs);
    }
};

export const getCachedCoverUrl = (url?: string | null) => {
    if (!url) return url ?? undefined;
    return coverCache.get(url) ?? url ?? undefined;
};

export const getCachedAudioUrl = (url?: string | null) => {
    if (!url) return url ?? undefined;
    return audioCache.get(url) ?? url ?? undefined;
};
