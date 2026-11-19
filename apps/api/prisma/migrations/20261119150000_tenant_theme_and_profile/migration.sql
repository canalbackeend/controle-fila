ALTER TABLE "Tenant" ADD COLUMN "theme" JSONB NOT NULL DEFAULT '{"preset":"blue"}';
ALTER TABLE "User" ADD COLUMN "credentialsChangedAt" TIMESTAMP(3);
