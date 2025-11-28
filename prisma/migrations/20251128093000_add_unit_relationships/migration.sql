-- Add optional unit reference to lessons so they can be grouped inside units
ALTER TABLE "Lesson"
    ADD COLUMN "unitId" TEXT;

CREATE INDEX "Lesson_unitId_idx" ON "Lesson"("unitId");

ALTER TABLE "Lesson"
    ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Track which unit triggered a generation job (if any)
ALTER TABLE "GenerationJob"
    ADD COLUMN "unitId" TEXT;

CREATE INDEX "GenerationJob_unitId_idx" ON "GenerationJob"("unitId");

ALTER TABLE "GenerationJob"
    ADD CONSTRAINT "GenerationJob_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
