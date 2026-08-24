import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, label: string) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.locator('input[name="nickname"]').fill(`验收${label}`);
  await page.locator('input[name="email"]').fill(`e2e-${suffix}@example.com`);
  await page.locator('input[name="password"]').fill("E2E-password-1234");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "创建心屿账号" }).click();
  await expect(page.getByRole("heading", { name: "聊天", exact: true })).toBeVisible();
}

async function openOfficialContact(page: Page, name: string) {
  await page.getByRole("button", { name: "联系人", exact: true }).click();
  await page.getByRole("button", { name: `与${name}聊天` }).click();
  await expect(page.getByRole("textbox", { name: "消息" })).toBeVisible();
}

test("注册同意后可建立单聊并获得 Mock 回复", async ({ page }) => {
  await register(page, "单聊");
  await openOfficialContact(page, "岚");

  await page.getByRole("textbox", { name: "消息" }).fill("这是自动验收单聊消息");
  const sendResponse = page.waitForResponse((response) => response.url().includes("/messages") && response.request().method() === "POST");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  const response = await sendResponse;
  expect(response.status()).toBe(201);

  await expect(page.getByText("这是自动验收单聊消息", { exact: true })).toBeVisible();
  await expect(page.locator(".message-bubble")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "免费", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("技能提示位于输入卡片内，结果卡片带娱乐声明", async ({ page }) => {
  await register(page, "技能");
  await openOfficialContact(page, "衡");

  await page.getByRole("button", { name: "更多功能" }).click();
  await page.getByRole("menuitem", { name: "MBTI", exact: true }).click();
  const skillForm = page.getByRole("form", { name: "MBTI最少信息" });
  const notice = skillForm.getByRole("status");
  await expect(notice).toHaveText("趣味解读，仅供娱乐参考");
  await skillForm.getByRole("textbox", { name: "你的选择" }).fill("独处，计划，想象，感受");
  const inputBox = await skillForm.getByRole("textbox", { name: "你的选择" }).boundingBox();
  const noticeBox = await notice.boundingBox();
  expect(noticeBox?.y).toBeLessThan(inputBox?.y ?? 0);
  await skillForm.getByRole("button", { name: "开始解读" }).click();

  const card = page.getByLabel("MBTI趣味解读");
  await expect(card).toBeVisible();
  await expect(card).toContainText("趣味解读，仅供娱乐参考");
});

test("讨论组按成员生成回复，并要求显式选择技能目标", async ({ page }) => {
  await register(page, "群聊");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByRole("button", { name: /创建讨论组/ }).click();
  const creator = page.getByRole("form", { name: "创建讨论组" });
  const members = creator.getByRole("checkbox");
  await members.nth(2).check();
  await members.nth(3).check();
  await creator.getByRole("button", { name: "创建讨论组", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "消息" })).toBeVisible();
  await page.getByRole("textbox", { name: "消息" }).fill("请两位分别聊聊今天的心情");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".message-bubble")).toHaveCount(3);
  await page.getByRole("button", { name: "更多功能" }).click();
  await expect(page.getByRole("menuitem", { name: "衡 · MBTI", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "星 · 星座", exact: true })).toBeVisible();
});

test("记忆按联系人保存和删除", async ({ page }) => {
  await register(page, "记忆");
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.getByPlaceholder("添加一条明确的长期记忆").fill("E2E 只保存给当前联系人");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("E2E 只保存给当前联系人", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除记忆：E2E 只保存给当前联系人" }).click();
  await expect(page.getByText("E2E 只保存给当前联系人", { exact: true })).not.toBeVisible();
});
