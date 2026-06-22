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
  await expect(page.getByRole("button", { name: "查看 Diff" })).toBeVisible();
});

test("手机端可以 interrupt 和 steer 当前 turn", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Interrupt" }).click();
  await page.getByPlaceholder("追加指令").fill("请继续补充");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("请继续补充", { exact: true })).toBeVisible();
  await expect(page.getByText("已追加：请继续补充")).toBeVisible();
});

test("手机端可以设置和清除会话目标", async ({ page }) => {
  await login(page);

  await page.getByPlaceholder("设置会话目标").fill("手机端完整开发");
  await page.getByPlaceholder("Token 预算").fill("9000");
  await page.getByRole("button", { name: "设为目标" }).click();

  await expect(page.getByText("目标：手机端完整开发")).toBeVisible();
  await expect(page.getByText("预算 9000")).toBeVisible();

  await page.getByRole("button", { name: "清除目标" }).click();

  await expect(page.getByText("目标：手机端完整开发")).not.toBeVisible();
});

test("手机端可以压缩当前会话上下文", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "压缩上下文" }).click();

  await expect(page.getByText("上下文已压缩")).toBeVisible();
});

test("手机端可以启动未提交改动代码审查", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "审查改动" }).click();

  await expect(page.getByText("已开始审查未提交改动")).toBeVisible();
  await expect(page.getByText("代码审查：未提交改动")).toBeVisible();
});

test("手机端可以切换记忆模式并重置记忆", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "启用记忆" }).click();
  await expect(page.getByText("记忆已启用")).toBeVisible();

  await page.getByRole("button", { name: "禁用记忆" }).click();
  await expect(page.getByText("记忆已禁用")).toBeVisible();

  await page.getByRole("button", { name: "重置记忆" }).click();
  await expect(page.getByText("记忆已重置")).toBeVisible();
});
