-- DropIndex
DROP INDEX "Conversation_userId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_userId_archivedAt_updatedAt_idx" ON "Conversation"("userId", "archivedAt", "updatedAt");
