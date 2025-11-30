-- Add columns for tracking lesson source material metadata
ALTER TABLE "Lesson"
    ADD COLUMN "sourceAssetId" TEXT,
    ADD COLUMN "sourceAssetName" TEXT,
    ADD COLUMN "sourceAssetOrder" INTEGER;
