-- Capture manual schema changes for CoursePackage metadata and Lesson unit references.
ALTER TABLE "CoursePackage"
    ADD COLUMN "grade" TEXT,
    ADD COLUMN "publisher" TEXT,
    ADD COLUMN "semester" TEXT;

CREATE INDEX "CoursePackage_grade_idx" ON "CoursePackage"("grade");
CREATE INDEX "CoursePackage_publisher_idx" ON "CoursePackage"("publisher");

ALTER TABLE "Lesson"
    ADD COLUMN "unitName" TEXT,
    ADD COLUMN "unitNumber" INTEGER;

CREATE INDEX "Lesson_packageId_unitNumber_idx" ON "Lesson"("packageId", "unitNumber");
