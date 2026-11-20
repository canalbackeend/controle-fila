CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NpsResponse_score_check" CHECK ("score" BETWEEN 0 AND 10)
);

CREATE INDEX "NpsResponse_tenantId_userId_createdAt_idx" ON "NpsResponse"("tenantId", "userId", "createdAt");
CREATE INDEX "NpsResponse_createdAt_idx" ON "NpsResponse"("createdAt");

ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
