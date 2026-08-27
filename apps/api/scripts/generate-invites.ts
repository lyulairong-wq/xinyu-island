import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const count = Number(process.argv[2] ?? "20");
const validDays = Number(process.argv[3] ?? "14");

if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
  throw new Error("Usage: npm run beta:invites -- <count 1-100> [validDays]");
}
if (!Number.isSafeInteger(validDays) || validDays < 1 || validDays > 90) {
  throw new Error("validDays must be between 1 and 90");
}

const prisma = new PrismaClient();
const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

function createInviteCode(): string {
  return `XY-${randomBytes(9).toString("base64url").toUpperCase()}`;
}

function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function main() {
  const codes = Array.from({ length: count }, createInviteCode);
  try {
    await prisma.inviteCode.createMany({
      data: codes.map((code) => ({ codeHash: hashInviteCode(code), expiresAt }))
    });

    console.log(`Generated ${codes.length} single-use invite codes. Expires: ${expiresAt.toISOString()}`);
    for (const code of codes) console.log(code);
    console.log("Store these codes securely. Raw codes are not persisted and cannot be shown again.");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
