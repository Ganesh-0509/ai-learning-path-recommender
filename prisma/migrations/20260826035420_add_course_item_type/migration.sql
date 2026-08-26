-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COURSE',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "skillsTaught" TEXT NOT NULL,
    "prerequisites" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("category", "createdAt", "description", "embedding", "id", "level", "prerequisites", "skillsTaught", "title", "updatedAt") SELECT "category", "createdAt", "description", "embedding", "id", "level", "prerequisites", "skillsTaught", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_level_idx" ON "Course"("level");
CREATE INDEX "Course_category_idx" ON "Course"("category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
