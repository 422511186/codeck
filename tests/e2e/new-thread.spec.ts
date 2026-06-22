import { expect, test } from "@playwright/test";

test("手机端可以新建会话并发送第一条消息", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("历史会话")).toBeVisible();

  await page.getByRole("button", { name: "新会话" }).click();
  await expect(page.getByRole("heading", { name: "新会话", level: 1 })).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("从新会话开始");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByLabel("会话内容").getByText("从新会话开始", { exact: true })).toBeVisible();
  await expect(page.getByText("已收到：从新会话开始")).toBeVisible();
});
