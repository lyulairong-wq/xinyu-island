CREATE TABLE "TokenAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freeLimit" INTEGER NOT NULL DEFAULT 10000,
    "freeUsed" INTEGER NOT NULL DEFAULT 0,
    "freeResetAt" TIMESTAMP(3) NOT NULL,
    "paidBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TokenAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenUsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "mode" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'estimated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenAccount_userId_key" ON "TokenAccount"("userId");
CREATE INDEX "TokenUsageRecord_userId_createdAt_idx" ON "TokenUsageRecord"("userId", "createdAt");
CREATE INDEX "TokenUsageRecord_conversationId_createdAt_idx" ON "TokenUsageRecord"("conversationId", "createdAt");
ALTER TABLE "TokenAccount" ADD CONSTRAINT "TokenAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsageRecord" ADD CONSTRAINT "TokenUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
