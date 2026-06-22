import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("会话内容")).toBeVisible();
}

test("手机端可以 fork 当前会话并切换到新 thread", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Fork" }).click();

  await expect(page.getByRole("heading", { name: /fork/ })).toBeVisible();
});

test("手机端可以 rollback 后编辑重发", async ({ page }) => {
  await login(page);

  await page.getByPlaceholder("编辑重发").fill("编辑后的消息");
  await page.getByRole("button", { name: "重发" }).click();

  await expect(page.getByText("编辑后的消息", { exact: true })).toBeVisible();
  await expect(page.getByText("已收到：编辑后的消息")).toBeVisible();
});

test("手机端可以 interrupt 和 steer 当前 turn", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Interrupt" }).click();
  await page.getByPlaceholder("追加指令").fill("请继续补充");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("请继续补充", { exact: true })).toBeVisible();
  await expect(page.getByText("已追加：请继续补充")).toBeVisible();
});
