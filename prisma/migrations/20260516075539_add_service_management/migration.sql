-- AlterTable
ALTER TABLE "Website" ADD COLUMN "buildHash" TEXT;

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
    "status" TEXT NOT NULL DEFAULT 'stopped',
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
CREATE UNIQUE INDEX "ServiceType_key_key" ON "ServiceType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureService_serviceTypeId_containerName_key" ON "InfrastructureService"("serviceTypeId", "containerName");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEnvVar_serviceId_key_key" ON "ServiceEnvVar"("serviceId", "key");
