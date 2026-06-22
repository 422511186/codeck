import { expect, test } from "@playwright/test";

test("手机端可以确认 app-server 命令审批", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("审批测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("命令审批")).toBeVisible();
  await expect(page.getByText("npm test")).toBeVisible();

  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByText("命令审批")).toBeHidden();
});
