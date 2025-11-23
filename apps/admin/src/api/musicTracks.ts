import type { MusicTrackDetail, MusicTrackSummary } from "@judada/shared";
import { apiFetch } from "./http";

export interface UploadMusicTrackPayload {
  file: File;
  title?: string;
  titleCn?: string;
  artist?: string;
  description?: string;
}

export interface UpdateMusicTrackPayload {
  title?: string;
  titleCn?: string | null;
  artist?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  status?: MusicTrackDetail["status"];
  words?: MusicTrackDetail["words"];
  phrases?: MusicTrackDetail["phrases"];
}

export const fetchMusicTracks = async () => {
  const response = await apiFetch<{ tracks: MusicTrackSummary[] }>("/admin/music-tracks");
  return response.tracks;
};

export const fetchMusicTrackDetail = async (id: string) => {
  const response = await apiFetch<{ track: MusicTrackDetail }>(`/admin/music-tracks/${id}`);
  return response.track;
};

export const uploadMusicTrack = async (payload: UploadMusicTrackPayload) => {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.title) formData.append("title", payload.title);
  if (payload.titleCn) formData.append("titleCn", payload.titleCn);
  if (payload.artist) formData.append("artist", payload.artist);
  if (payload.description) formData.append("description", payload.description);

  const response = await apiFetch<{ track: MusicTrackDetail }>("/admin/music-tracks", {
    method: "POST",
    body: formData
  });
  return response.track;
};

export const updateMusicTrack = async (id: string, payload: UpdateMusicTrackPayload) => {
  const response = await apiFetch<{ track: MusicTrackDetail }>(`/admin/music-tracks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  return response.track;
};

export const deleteMusicTrack = async (id: string) => {
  await apiFetch(`/admin/music-tracks/${id}`, {
    method: "DELETE"
  });
};

// LRC歌词解析接口
export const parseLrcFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch<{
    success: boolean;
    phrases: Array<{
      start: number;
      end: number;
      english: string;
      chinese: string;
    }>;
    total: number;
  }>("/admin/parse-lrc", {
    method: "POST",
    body: formData
  });

  return response;
};
