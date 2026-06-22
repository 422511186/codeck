import { expect, test } from "@playwright/test";

test("手机端可以确认 app-server 命令审批", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("审批测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { name: "命令审批" })).toBeVisible();
  await expect(page.getByText("npm test")).toBeVisible();

  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByRole("heading", { name: "命令审批" })).toBeHidden();
});

test("手机端可以确认文件变更审批", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByPlaceholder("给 Codex 发送消息").fill("文件审批测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { name: "文件变更审批" })).toBeVisible();
  await expect(page.getByText("需要写入 mock.txt")).toBeVisible();

  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByRole("heading", { name: "文件变更审批" })).toBeHidden();
});

test("手机端可以确认权限审批", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByPlaceholder("给 Codex 发送消息").fill("权限审批测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { name: "权限审批" })).toBeVisible();
  await expect(page.getByText("需要网络访问")).toBeVisible();

  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByRole("heading", { name: "权限审批" })).toBeHidden();
});

test("手机端可以回答 question 请求", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByPlaceholder("给 Codex 发送消息").fill("question 测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { name: "需要你回答" })).toBeVisible();
  await expect(page.getByText("请选择执行模式")).toBeVisible();

  await page.getByRole("button", { name: "快速" }).click();

  await expect(page.getByRole("heading", { name: "需要你回答" })).toBeHidden();
});

test("手机端可以确认 MCP elicitation", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByPlaceholder("给 Codex 发送消息").fill("MCP 测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { name: "MCP 请求" })).toBeVisible();
  await expect(page.getByText("请确认外部授权")).toBeVisible();

  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByRole("heading", { name: "MCP 请求" })).toBeHidden();
});
