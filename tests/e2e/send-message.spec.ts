import { expect, test } from "@playwright/test";

test("手机端可以向当前会话发送文本消息", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("继续开发发送功能");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("继续开发发送功能", { exact: true })).toBeVisible();
  await expect(page.getByText("已收到：继续开发发送功能")).toBeVisible();
});
