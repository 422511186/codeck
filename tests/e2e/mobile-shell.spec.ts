import { expect, test } from "@playwright/test";

test("手机端登录后进入工作台", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("连接你的 Codex")).toBeVisible();

  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("新会话")).toBeVisible();
  await expect(page.getByText("Chats")).toBeVisible();
  await expect(page.getByText("Terminal")).toBeVisible();
});
