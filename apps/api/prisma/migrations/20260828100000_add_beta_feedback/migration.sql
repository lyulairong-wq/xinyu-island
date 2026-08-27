CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BetaFeedback_userId_createdAt_idx" ON "BetaFeedback"("userId", "createdAt");
CREATE INDEX "BetaFeedback_category_createdAt_idx" ON "BetaFeedback"("category", "createdAt");

ALTER TABLE "BetaFeedback" ADD CONSTRAINT "BetaFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
