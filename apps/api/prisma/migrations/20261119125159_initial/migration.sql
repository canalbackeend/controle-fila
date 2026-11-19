-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'ATTENDANT');

-- CreateEnum
CREATE TYPE "CallMode" AS ENUM ('TICKET', 'NAME');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'PREFERENTIAL', 'PRIORITY80');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'CALLED', 'IN_SERVICE', 'FINISHED', 'FORWARDED', 'NO_SHOW', 'CANCELED');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('ISSUED', 'CALLED', 'RECALLED', 'STARTED', 'FORWARDED', 'QUEUED', 'FINISHED', 'NO_SHOW', 'CANCELED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('PANEL', 'KIOSK');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('TIP', 'NOTICE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "resetTime" TEXT NOT NULL DEFAULT '00:00',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATTENDANT',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "preferentialPrefix" TEXT NOT NULL,
    "priority80Prefix" TEXT NOT NULL,
    "callMode" "CallMode" NOT NULL DEFAULT 'TICKET',
    "ratioNormal" INTEGER NOT NULL DEFAULT 2,
    "ratioPreferential" INTEGER NOT NULL DEFAULT 1,
    "stageOrder" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounterSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "serviceIds" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CounterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "issuedServiceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "customerName" TEXT,
    "publicToken" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "counterId" TEXT,
    "targetCounterId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "userId" TEXT,
    "counterId" TEXT,
    "fromServiceId" TEXT,
    "toServiceId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueSequence" (
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "turn" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QueueSequence_pkey" PRIMARY KEY ("tenantId","unitId","serviceId","businessDate")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "pairingCodeHash" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelConfig" (
    "deviceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weights" JSONB NOT NULL DEFAULT '{"NOTICE":50,"NEWS":30,"WEATHER":20,"TIP":20}',
    "cardSeconds" INTEGER NOT NULL DEFAULT 10,
    "newsCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT NOT NULL DEFAULT 'São Paulo',
    "callDisplaySeconds" INTEGER NOT NULL DEFAULT 5,
    "ticker" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PanelConfig_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" "CardType" NOT NULL,
    "imageUrl" TEXT,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "global" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "city" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("city")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_tenantId_id_key" ON "Unit"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Service_tenantId_id_key" ON "Service"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Service_tenantId_unitId_name_key" ON "Service"("tenantId", "unitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_tenantId_id_key" ON "Counter"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_tenantId_unitId_number_key" ON "Counter"("tenantId", "unitId", "number");

-- CreateIndex
CREATE INDEX "CounterSession_tenantId_userId_endedAt_idx" ON "CounterSession"("tenantId", "userId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_publicToken_key" ON "Ticket"("publicToken");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_unitId_serviceId_businessDate_status_queued_idx" ON "Ticket"("tenantId", "unitId", "serviceId", "businessDate", "status", "queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_tenantId_id_key" ON "Ticket"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_unitId_issuedServiceId_businessDate_number_key" ON "Ticket"("unitId", "issuedServiceId", "businessDate", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_unitId_businessDate_code_key" ON "Ticket"("unitId", "businessDate", "code");

-- CreateIndex
CREATE INDEX "TicketEvent_tenantId_unitId_at_idx" ON "TicketEvent"("tenantId", "unitId", "at");

-- CreateIndex
CREATE INDEX "TicketEvent_tenantId_ticketId_at_idx" ON "TicketEvent"("tenantId", "ticketId", "at");

-- CreateIndex
CREATE INDEX "Device_tenantId_unitId_type_idx" ON "Device"("tenantId", "unitId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tenantId_id_key" ON "Device"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PanelConfig_tenantId_deviceId_key" ON "PanelConfig"("tenantId", "deviceId");

-- CreateIndex
CREATE INDEX "Card_tenantId_active_idx" ON "Card"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_url_key" ON "FeedSource"("url");

-- CreateIndex
CREATE INDEX "NewsItem_category_publishedAt_idx" ON "NewsItem"("category", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_sourceId_externalId_key" ON "NewsItem"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterSession" ADD CONSTRAINT "CounterSession_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterSession" ADD CONSTRAINT "CounterSession_tenantId_counterId_fkey" FOREIGN KEY ("tenantId", "counterId") REFERENCES "Counter"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_tenantId_ticketId_fkey" FOREIGN KEY ("tenantId", "ticketId") REFERENCES "Ticket"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelConfig" ADD CONSTRAINT "PanelConfig_tenantId_deviceId_fkey" FOREIGN KEY ("tenantId", "deviceId") REFERENCES "Device"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
