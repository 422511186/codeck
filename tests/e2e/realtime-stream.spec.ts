import { expect, test } from "@playwright/test";

test("手机端可以接收 app-server 实时事件", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("实时流测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("实时事件：实时流测试")).toBeVisible();
});
