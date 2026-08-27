import { expect, test } from "@playwright/test";

const requiresRealModel = process.env.E2E_REQUIRE_REAL_MODEL === "1";

test.describe("M6 real model integration", () => {
  test.skip(!requiresRealModel, "Run through npm run test:e2e:real-model with an explicitly configured local model");

  test("@real-model 免费对话不得静默降级为 Mock", async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await page.goto("/");
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await page.locator('input[name="nickname"]').fill("真实模型验收");
    await page.locator('input[name="email"]').fill(`real-model-${suffix}@example.com`);
    await page.locator('input[name="password"]').fill("E2E-password-1234");
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
    await page.getByRole("button", { name: "创建心屿账号", exact: true }).click();

    await page.getByRole("button", { name: "联系人", exact: true }).click();
    await page.getByRole("button", { name: "与岚聊天" }).click();
    await page.getByRole("textbox", { name: "消息" }).fill("请用一句话陪我聊聊天。 ");

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("/messages") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.provider).toBe("local");
    expect(body.degraded).toBe(true);
    await expect(page.getByText("当前使用免费开源模型回复，仅供娱乐参考。", { exact: true })).toBeVisible();
  });
});
