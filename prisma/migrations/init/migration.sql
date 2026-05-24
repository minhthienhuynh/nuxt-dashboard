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

-- CreateTable
CREATE TABLE "Website" (
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

-- CreateTable
CREATE TABLE "WebsitePhpExtension" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "websiteId" INTEGER NOT NULL,
    "extensionId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WebsitePhpExtension_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebsitePhpExtension_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "PhpExtension" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProxyConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'caddy',
    "httpPort" INTEGER NOT NULL DEFAULT 80,
    "httpsPort" INTEGER NOT NULL DEFAULT 443,
    "adminPort" INTEGER NOT NULL DEFAULT 8080,
    "domain" TEXT NOT NULL DEFAULT '*.test',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultImage" TEXT,
    "defaultPorts" TEXT NOT NULL DEFAULT '[]',
    "hasHealthcheck" BOOLEAN NOT NULL DEFAULT false,
    "hasPersistence" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InfrastructureService" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceTypeId" INTEGER NOT NULL,
    "containerName" TEXT NOT NULL,
    "imageOverride" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InfrastructureService_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceEnvVar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ServiceEnvVar_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "InfrastructureService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServicePort" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "hostPort" TEXT NOT NULL,
    "containerPort" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'tcp',
    CONSTRAINT "ServicePort_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "InfrastructureService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceVolume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    CONSTRAINT "ServiceVolume_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "InfrastructureService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PhpExtension_name_key" ON "PhpExtension"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PhpVersionSupport_extensionId_phpVersion_key" ON "PhpVersionSupport"("extensionId", "phpVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialRequirement_extensionId_requirement_key" ON "SpecialRequirement"("extensionId", "requirement");

-- CreateIndex
CREATE UNIQUE INDEX "Website_domain_key" ON "Website"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePhpExtension_websiteId_extensionId_key" ON "WebsitePhpExtension"("websiteId", "extensionId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_key_key" ON "ServiceType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureService_serviceTypeId_containerName_key" ON "InfrastructureService"("serviceTypeId", "containerName");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEnvVar_serviceId_key_key" ON "ServiceEnvVar"("serviceId", "key");
