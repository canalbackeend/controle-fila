ALTER TABLE "Tenant"
  ADD COLUMN "planName" TEXT,
  ADD COLUMN "kioskLimit" INTEGER CHECK ("kioskLimit" >= 0),
  ADD COLUMN "panelLimit" INTEGER CHECK ("panelLimit" >= 0),
  ADD COLUMN "suspendedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
