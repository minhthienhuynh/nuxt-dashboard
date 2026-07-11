/*
  Warnings:

  - You are about to drop the column `hostId` on the `Snippet` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SnippetHost" (
    "snippetId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,

    PRIMARY KEY ("snippetId", "hostId"),
    CONSTRAINT "SnippetHost_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SnippetHost_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Snippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Snippet" ("command", "createdAt", "id", "label", "updatedAt") SELECT "command", "createdAt", "id", "label", "updatedAt" FROM "Snippet";
DROP TABLE "Snippet";
ALTER TABLE "new_Snippet" RENAME TO "Snippet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SnippetHost_hostId_idx" ON "SnippetHost"("hostId");
