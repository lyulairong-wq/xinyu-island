import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const { PrismaClient } = require("../apps/api/node_modules/@prisma/client") as typeof import("@prisma/client");

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error("E2E_DATABASE_URL is required");
const requiresExternalBeta = process.env.E2E_EXTERNAL_BETA === "1";

const prisma: PrismaClientType = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.skip(!requiresExternalBeta, "Run with npm run test:e2e:external-beta");

test("@external-beta only an invited adult can register and see the limited beta surface", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const inviteCode = `XY-E2E-${suffix.slice(-8).toUpperCase()}`;
  await prisma.inviteCode.create({
    data: {
      codeHash: createHash("sha256").update(inviteCode).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByLabel("邀请码")).toBeVisible();
  await page.getByLabel("昵称").fill("外部封测验收");
  await page.getByLabel("邮箱").fill(`external-${suffix}@example.com`);
  await page.getByLabel("密码").fill("E2E-password-1234");
  await page.getByLabel("邀请码").fill(inviteCode);
  await page.getByLabel("年龄段").selectOption("18_plus");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "创建心屿账号", exact: true }).click();

  await expect(page.getByRole("heading", { name: "聊天", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "应用", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Token", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByRole("heading", { name: "封测反馈", exact: true })).toBeVisible();
  await page.getByLabel("反馈内容").fill("外部封测自动验收反馈，不包含任何聊天或记忆正文。" );
  await page.getByRole("button", { name: "提交反馈", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已收到反馈");

  const registered = await prisma.user.findUniqueOrThrow({ where: { email: `external-${suffix}@example.com` } });
  expect(await prisma.inviteCode.count({ where: { redeemedByUserId: registered.id, redeemedAt: { not: null } } })).toBe(1);
  expect(await prisma.betaFeedback.count({ where: { userId: registered.id } })).toBe(1);
});
