-- Remove BPM and gapOptions fields from MusicTrack table
ALTER TABLE "MusicTrack" DROP COLUMN IF EXISTS "bpm";
ALTER TABLE "MusicTrack" DROP COLUMN IF EXISTS "gapOptions";