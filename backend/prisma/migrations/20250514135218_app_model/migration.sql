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
    "nwcUrl" TEXT,
    "editKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "promptSuggestions" TEXT,
    "generatingSection" TEXT,
    "systemPrompt" TEXT,
    "systemPromptSegmentNames" TEXT,
    "seed" INTEGER,
    "zapAmount" INTEGER NOT NULL DEFAULT 0,
    "fullOutput" TEXT,
    "model" TEXT NOT NULL DEFAULT 'deepseek/deepseek-chat:free'
);
INSERT INTO "new_App" ("backendPort", "backendState", "createdAt", "denoCode", "editKey", "errorMessage", "fullOutput", "generatingSection", "html", "id", "lightningAddress", "numChars", "nwcUrl", "previewKey", "prompt", "promptSuggestions", "published", "seed", "state", "systemPrompt", "systemPromptSegmentNames", "title", "updatedAt", "zapAmount") SELECT "backendPort", "backendState", "createdAt", "denoCode", "editKey", "errorMessage", "fullOutput", "generatingSection", "html", "id", "lightningAddress", "numChars", "nwcUrl", "previewKey", "prompt", "promptSuggestions", "published", "seed", "state", "systemPrompt", "systemPromptSegmentNames", "title", "updatedAt", "zapAmount" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
