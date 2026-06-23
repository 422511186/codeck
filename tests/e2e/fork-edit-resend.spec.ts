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

test("手机端可以执行会话命令并控制 elicitation 计数", async ({ page }) => {
  await login(page);

  await page.getByPlaceholder("会话 shell command").fill("npm test");
  await page.getByRole("button", { name: "执行会话命令" }).click();
  await expect(page.getByText("会话命令已发送：npm test")).toBeVisible();

  await page.getByRole("button", { name: "暂停 elicitation" }).click();
  await expect(page.getByText("Elicitation 已暂停：1")).toBeVisible();

  await page.getByRole("button", { name: "恢复 elicitation" }).click();
  await expect(page.getByText("Elicitation 已恢复：0")).toBeVisible();
});

test("手机端可以读取当前会话摘要", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "读取摘要" }).click();

  await expect(page.getByText(/摘要：/)).toBeVisible();
  await expect(page.getByText(/C:\\Users\\huang\\workspace/)).toBeVisible();
});

test("手机端可以取消订阅当前会话", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "取消订阅" }).click();

  await expect(page.getByText("取消订阅：unsubscribed")).toBeVisible();
});

test("手机端可以加载当前会话 turns 分页", async ({ page }) => {
  const turnPageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/codex/threads/") && request.url().includes("/turns?")) {
      turnPageRequests.push(request.url());
    }
  });
  await login(page);

  await page.getByRole("button", { name: "加载分页" }).click();

  await expect.poll(() => turnPageRequests.length).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("分页已加载")).toBeVisible();
});

test("手机端可以加载当前 turn items 分页", async ({ page }) => {
  const itemPageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/codex/threads/") && request.url().includes("/items?")) {
      itemPageRequests.push(request.url());
    }
  });
  await login(page);

  await page.getByRole("button", { name: "加载 items" }).click();

  await expect.poll(() => itemPageRequests.length).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Items 分页已加载")).toBeVisible();
});
