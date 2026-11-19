ALTER TABLE "Ticket" ADD COLUMN "issueKey" TEXT;

CREATE UNIQUE INDEX "Ticket_tenantId_unitId_issueKey_key" ON "Ticket"("tenantId", "unitId", "issueKey");
