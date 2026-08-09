CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationMember_conversationId_contactId_key" ON "ConversationMember"("conversationId", "contactId");
CREATE INDEX "ConversationMember_conversationId_sortOrder_idx" ON "ConversationMember"("conversationId", "sortOrder");
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
