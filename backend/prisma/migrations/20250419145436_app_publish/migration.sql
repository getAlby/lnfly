-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_App" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "prompt" TEXT NOT NULL,
    "html" TEXT,
    "state" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "numChars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "lightningAddress" TEXT,
    "editKey" TEXT,
    "previewKey" TEXT
);
INSERT INTO "new_App" ("createdAt", "html", "id", "numChars", "prompt", "state", "title", "updatedAt") SELECT "createdAt", "html", "id", "numChars", "prompt", "state", "title", "updatedAt" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
