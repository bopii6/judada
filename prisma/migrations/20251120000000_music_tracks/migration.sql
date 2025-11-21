-- CreateEnum
CREATE TYPE "MusicTrackStatus" AS ENUM ('draft', 'processing', 'published', 'archived');

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "artist" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "status" "MusicTrackStatus" NOT NULL DEFAULT 'draft',
    "bpm" INTEGER,
    "durationMs" INTEGER,
    "audioStoragePath" TEXT NOT NULL,
    "audioMimeType" TEXT,
    "audioFileSize" INTEGER,
    "words" JSONB,
    "phrases" JSONB,
    "gapOptions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicTrack_slug_key" ON "MusicTrack"("slug");

-- CreateIndex
CREATE INDEX "MusicTrack_status_idx" ON "MusicTrack"("status");
