ALTER TABLE "User" ADD COLUMN "defaultMemoryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "memoryEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PrivateContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "tone" TEXT,
    "persona" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrivateContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL DEFAULT 'normal',
    "source" TEXT NOT NULL DEFAULT 'user_explicit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateContact_userId_updatedAt_idx" ON "PrivateContact"("userId", "updatedAt");
CREATE INDEX "ContactMemory_userId_contactId_updatedAt_idx" ON "ContactMemory"("userId", "contactId", "updatedAt");
ALTER TABLE "PrivateContact" ADD CONSTRAINT "PrivateContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactMemory" ADD CONSTRAINT "ContactMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
