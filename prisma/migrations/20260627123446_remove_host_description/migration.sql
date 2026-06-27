/*
  Warnings:

  - You are about to drop the column `description` on the `Host` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "os" TEXT,
    "groupId" TEXT,
    "identityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Host_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Host_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Host" ("address", "createdAt", "groupId", "id", "identityId", "label", "os", "port", "updatedAt") SELECT "address", "createdAt", "groupId", "id", "identityId", "label", "os", "port", "updatedAt" FROM "Host";
DROP TABLE "Host";
ALTER TABLE "new_Host" RENAME TO "Host";
CREATE INDEX "Host_groupId_idx" ON "Host"("groupId");
CREATE INDEX "Host_identityId_idx" ON "Host"("identityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
