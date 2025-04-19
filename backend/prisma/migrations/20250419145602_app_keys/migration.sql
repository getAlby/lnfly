/*
  Warnings:

  - Made the column `editKey` on table `App` required. This step will fail if there are existing NULL values in that column.
  - Made the column `previewKey` on table `App` required. This step will fail if there are existing NULL values in that column.

*/
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
    "editKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL
);
INSERT INTO "new_App" ("createdAt", "editKey", "html", "id", "lightningAddress", "numChars", "previewKey", "prompt", "published", "state", "title", "updatedAt") SELECT "createdAt", COALESCE("editKey", "legacy_edit_key"), "html", "id", "lightningAddress", "numChars", COALESCE("editKey", "legacy_preview_key"), "prompt", "published", "state", "title", "updatedAt" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
