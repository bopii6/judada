import type { MusicTrackDetail } from "@judada/shared";
import api from "./client";

export const fetchMusicTracks = async (): Promise<MusicTrackDetail[]> => {
  const { data } = await api.get<{ tracks: MusicTrackDetail[] }>("/music/tracks");
  return data.tracks;
};
