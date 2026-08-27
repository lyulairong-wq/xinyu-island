import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.E2E_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL is required; this test must run through scripts/e2e/run.mjs");
}

const isolatedDatabaseUrl = "postgresql://xinyu_e2e:xinyu_e2e@127.0.0.1:15433/xinyu_e2e?schema=public";

if (databaseUrl !== isolatedDatabaseUrl) {
  throw new Error("Refusing to run M4 E2E outside the local disposable PostgreSQL database");
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function register(page: Page, input: { email: string; nickname: string }) {
  await page.goto("/");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.locator('input[name="nickname"]').fill(input.nickname);
  await page.locator('input[name="email"]').fill(input.email);
  await page.locator('input[name="password"]').fill("E2E-password-1234");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "创建心屿账号", exact: true }).click();
  await expect(page.getByRole("heading", { name: "聊天", exact: true })).toBeVisible();
}

test("注销账号会保留错误密码会话，并立即级联删除所有个人数据且允许同邮箱重新注册", async ({ page, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `m4-${suffix}@example.com`;
  await register(page, { email, nickname: "M4 验收" });

  const oldToken = await page.evaluate(() => window.localStorage.getItem("xinyu_access_token"));
  expect(oldToken).toBeTruthy();

  const originalUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  const contact = await prisma.privateContact.create({
    data: { userId: originalUser.id, name: "M4 私有联系人", skillCodes: ["mbti"], primarySkill: "mbti" }
  });
  const conversation = await prisma.conversation.create({
    data: { userId: originalUser.id, contactId: contact.id, kind: "single", contactSnapshot: { name: contact.name } }
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, role: "user", content: "这是一条待级联删除的验收消息" }
  });
  await prisma.contactMemory.create({
    data: { userId: originalUser.id, contactId: contact.id, fact: "只属于原账号的验收记忆" }
  });
  const generation = await prisma.generationRequest.create({
    data: {
      userId: originalUser.id,
      conversationId: conversation.id,
      requestId: `m4-${suffix}`,
      mode: "free",
      status: "completed",
      reservedTokens: 12,
      completedAt: new Date()
    }
  });
  await prisma.tokenUsageRecord.create({
    data: {
      userId: originalUser.id,
      conversationId: conversation.id,
      generationRequestId: generation.id,
      mode: "free",
      bucket: "free",
      inputTokens: 4,
      outputTokens: 8,
      totalTokens: 12
    }
  });
  expect(await prisma.privateContact.count({ where: { userId: originalUser.id } })).toBe(1);
  expect(await prisma.conversation.count({ where: { userId: originalUser.id } })).toBe(1);
  expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(1);
  expect(await prisma.contactMemory.count({ where: { userId: originalUser.id } })).toBe(1);
  expect(await prisma.tokenAccount.count({ where: { userId: originalUser.id } })).toBe(1);
  expect(await prisma.generationRequest.count({ where: { userId: originalUser.id } })).toBe(1);
  expect(await prisma.tokenUsageRecord.count({ where: { userId: originalUser.id } })).toBe(1);

  await expect(page.getByRole("button", { name: "我的", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByRole("heading", { name: "协议和隐私", exact: true })).toBeVisible();

  await page.getByLabel("当前密码").fill("wrong-password");
  await page.locator('.confirmation-panel input[type="checkbox"]').check();
  await page.getByRole("button", { name: "立即注销账号", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();

  expect(await prisma.user.count({ where: { id: originalUser.id } })).toBe(1);
  const stillAuthenticated = await request.get("http://127.0.0.1:4100/api/v1/me", {
    headers: { Authorization: `Bearer ${oldToken}` }
  });
  expect(stillAuthenticated.status()).toBe(200);

  await page.getByLabel("当前密码").fill("E2E-password-1234");
  await page.getByRole("button", { name: "立即注销账号", exact: true }).click();
  await expect(page.getByText("账号已注销，相关个人数据已删除。", { exact: true })).toBeVisible();

  expect(await prisma.user.count({ where: { id: originalUser.id } })).toBe(0);
  expect(await prisma.userSession.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.consentRecord.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.privateContact.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.conversation.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(0);
  expect(await prisma.contactMemory.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.tokenAccount.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.generationRequest.count({ where: { userId: originalUser.id } })).toBe(0);
  expect(await prisma.tokenUsageRecord.count({ where: { userId: originalUser.id } })).toBe(0);

  const staleTokenProfile = await request.get("http://127.0.0.1:4100/api/v1/me", {
    headers: { Authorization: `Bearer ${oldToken}` }
  });
  expect(staleTokenProfile.status()).toBe(401);

  await register(page, { email, nickname: "M4 新账号" });
  const replacementUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(replacementUser.id).not.toBe(originalUser.id);
  expect(await prisma.conversation.count({ where: { userId: replacementUser.id } })).toBe(0);
  expect(await prisma.contactMemory.count({ where: { userId: replacementUser.id } })).toBe(0);
  expect(await prisma.generationRequest.count({ where: { userId: replacementUser.id } })).toBe(0);
  expect(await prisma.tokenUsageRecord.count({ where: { userId: replacementUser.id } })).toBe(0);
});
