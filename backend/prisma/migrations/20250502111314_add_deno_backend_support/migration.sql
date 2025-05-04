-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_App" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "prompt" TEXT NOT NULL,
    "html" TEXT,
    "denoCode" TEXT,
    "state" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "backendState" TEXT NOT NULL DEFAULT 'STOPPED',
    "backendPort" INTEGER,
    "numChars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "lightningAddress" TEXT,
    "editKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "promptSuggestions" TEXT
);
INSERT INTO "new_App" ("createdAt", "editKey", "errorMessage", "html", "id", "lightningAddress", "numChars", "previewKey", "prompt", "promptSuggestions", "published", "state", "title", "updatedAt") SELECT "createdAt", "editKey", "errorMessage", "html", "id", "lightningAddress", "numChars", "previewKey", "prompt", "promptSuggestions", "published", "state", "title", "updatedAt" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
