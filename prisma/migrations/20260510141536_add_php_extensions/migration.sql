-- CreateTable
CREATE TABLE "PhpExtension" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PhpVersionSupport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "extensionId" INTEGER NOT NULL,
    "phpVersion" TEXT NOT NULL,
    CONSTRAINT "PhpVersionSupport_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "PhpExtension" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialRequirement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "extensionId" INTEGER NOT NULL,
    "requirement" TEXT NOT NULL,
    CONSTRAINT "SpecialRequirement_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "PhpExtension" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PhpExtension_name_key" ON "PhpExtension"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PhpVersionSupport_extensionId_phpVersion_key" ON "PhpVersionSupport"("extensionId", "phpVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialRequirement_extensionId_requirement_key" ON "SpecialRequirement"("extensionId", "requirement");
