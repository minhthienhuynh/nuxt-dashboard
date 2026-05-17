-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Website" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'php-fpm',
    "port" INTEGER NOT NULL DEFAULT 80,
    "documentRoot" TEXT NOT NULL,
    "phpVersion" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "buildHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Website" ("buildHash", "createdAt", "documentRoot", "domain", "id", "name", "phpVersion", "port", "sslEnabled", "updatedAt") SELECT "buildHash", "createdAt", "documentRoot", "domain", "id", "name", "phpVersion", "port", "sslEnabled", "updatedAt" FROM "Website";
DROP TABLE "Website";
ALTER TABLE "new_Website" RENAME TO "Website";
CREATE UNIQUE INDEX "Website_domain_key" ON "Website"("domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
