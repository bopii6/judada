-- Prisma Migration: add roundTitle column to Lesson
ALTER TABLE "Lesson"
ADD COLUMN "roundTitle" TEXT;
