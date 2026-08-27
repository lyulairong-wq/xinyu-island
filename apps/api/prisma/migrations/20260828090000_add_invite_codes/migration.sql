CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteCode_codeHash_key" ON "InviteCode"("codeHash");
CREATE UNIQUE INDEX "InviteCode_redeemedByUserId_key" ON "InviteCode"("redeemedByUserId");
CREATE INDEX "InviteCode_expiresAt_redeemedAt_revokedAt_idx" ON "InviteCode"("expiresAt", "redeemedAt", "revokedAt");

ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
