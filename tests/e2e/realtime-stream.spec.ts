import { expect, test } from "@playwright/test";

test("手机端可以接收 app-server 实时事件", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("实时流测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("思考：实时流测试")).toBeVisible();
  await expect(page.getByText("计划：整理请求并生成回复")).toBeVisible();
  await expect(page.getByText("命令输出：mock 完成")).toBeVisible();
  await expect(page.getByText("diff --git a/mock.txt b/mock.txt")).toBeVisible();
  await expect(page.getByText("文件输出：mock.txt 已更新")).toBeVisible();
  await expect(page.getByText("Token 用量：总计 128，输入 48，输出 64，推理 16，上下文 200000")).toBeVisible();
  await expect(page.getByText("实时事件：实时流测试")).toBeVisible();
});
