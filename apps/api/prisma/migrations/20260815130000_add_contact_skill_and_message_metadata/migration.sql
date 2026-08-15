ALTER TABLE "PrivateContact" ADD COLUMN "skillCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PrivateContact" ADD COLUMN "primarySkill" TEXT;

ALTER TABLE "Message" ADD COLUMN "metadata" JSONB;
