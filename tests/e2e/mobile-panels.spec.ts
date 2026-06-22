import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("会话内容")).toBeVisible();
}

test("手机端可以切换文件、终端、设置和 Diff 面板", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Files" }).click();
  await expect(page.getByRole("heading", { name: "文件" })).toBeVisible();
  await expect(page.getByRole("button", { name: "src" })).toBeVisible();
  await page.getByRole("button", { name: "README.md" }).click();
  await expect(page.getByText("# Codex Web")).toBeVisible();
  await expect(page.getByText("移动端 Web 工作台 mock 文件。")).toBeVisible();

  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByRole("heading", { name: "终端" })).toBeVisible();
  await page.getByPlaceholder("输入命令").fill("npm --version");
  await page.getByRole("button", { name: "运行" }).click();
  await expect(page.getByText("mock command: npm --version")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByText("gpt-5-codex")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "medium" })).toBeVisible();
  await expect(page.getByText("connected")).toBeVisible();

  await page.getByRole("button", { name: "Chats" }).click();
  await page.getByPlaceholder("给 Codex 发送消息").fill("生成 diff");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("diff --git a/mock.txt b/mock.txt")).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Diff" })).toBeVisible();
  await expect(page.getByText("diff --git a/mock.txt b/mock.txt")).toBeVisible();
});

test("手机端可以切换模型、思考强度和权限并用于后续发送", async ({ page }) => {
  const settingsRequests: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/codex/threads/") && request.url().endsWith("/settings")) {
      settingsRequests.push(request.postDataJSON() as Record<string, unknown>);
    }
  });

  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("模型").selectOption("gpt-5-mini");
  await page.getByLabel("思考强度").selectOption("high");
  await page.getByLabel("权限配置").selectOption("full-auto");
  await expect.poll(() => settingsRequests.length).toBeGreaterThanOrEqual(3);
  expect(settingsRequests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ model: "gpt-5-mini" }),
      expect.objectContaining({ reasoningEffort: "high" }),
      expect.objectContaining({ permissions: "full-auto" })
    ])
  );

  await page.getByRole("button", { name: "Chats" }).click();
  await expect(page.getByText("GPT-5 Mini")).toBeVisible();
  await expect(page.getByText("high · full-auto")).toBeVisible();

  await page.getByRole("button", { name: "新会话" }).click();
  await expect(page.getByRole("heading", { name: "新会话 full-auto" })).toBeVisible();

  await page.getByPlaceholder("给 Codex 发送消息").fill("设置切换测试");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("已收到：设置切换测试（模型 gpt-5-mini，思考 high，权限 full-auto）")).toBeVisible();
});
