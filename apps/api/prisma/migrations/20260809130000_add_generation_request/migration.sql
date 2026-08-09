CREATE TABLE "GenerationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "reservedTokens" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "GenerationRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TokenAccount" ALTER COLUMN "freeLimit" SET DEFAULT 6000;
UPDATE "TokenAccount" SET "freeLimit" = 6000 WHERE "freeLimit" = 10000;

ALTER TABLE "TokenUsageRecord" ADD COLUMN "generationRequestId" TEXT;

CREATE UNIQUE INDEX "GenerationRequest_userId_requestId_key" ON "GenerationRequest"("userId", "requestId");
CREATE INDEX "GenerationRequest_userId_status_completedAt_idx" ON "GenerationRequest"("userId", "status", "completedAt");
CREATE UNIQUE INDEX "TokenUsageRecord_generationRequestId_key" ON "TokenUsageRecord"("generationRequestId");

ALTER TABLE "GenerationRequest" ADD CONSTRAINT "GenerationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsageRecord" ADD CONSTRAINT "TokenUsageRecord_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "GenerationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
