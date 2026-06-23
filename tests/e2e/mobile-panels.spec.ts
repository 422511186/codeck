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
  await expect(page.locator(".file-preview textarea")).toHaveValue("# Codex Web\n\n移动端 Web 工作台 mock 文件。");
  await page.locator(".file-preview textarea").fill("# 已保存\n\n来自手机端 E2E。");
  await page.getByRole("button", { name: "保存文件" }).click();
  await expect(page.getByText("文件已保存")).toBeVisible();
  await expect(page.locator(".file-preview textarea")).toHaveValue("# 已保存\n\n来自手机端 E2E。");
  await page.getByLabel("新目录").fill("docs");
  await page.getByRole("button", { name: "创建目录" }).click();
  await expect(page.getByRole("button", { name: "docs" })).toBeVisible();
  await page.getByLabel("复制到").fill("README.copy.md");
  await page.getByRole("button", { name: "复制" }).click();
  await expect(page.getByRole("button", { name: "README.copy.md" })).toBeVisible();
  await page.getByRole("button", { name: "README.copy.md" }).click();
  await page.getByRole("button", { name: "查看元数据" }).click();
  await expect(page.getByText("类型")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "文件" })).toBeVisible();
  await page.getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("路径已删除")).toBeVisible();
  await expect(page.getByRole("button", { name: "README.copy.md" })).toHaveCount(0);

  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByRole("heading", { name: "终端" })).toBeVisible();
  await page.getByPlaceholder("输入命令").fill("npm --version");
  await page.getByRole("button", { name: "运行" }).click();
  await expect(page.getByText("mock command: npm --version")).toBeVisible();
  await page.getByRole("button", { name: "启动会话" }).click();
  await expect(page.getByText("mock process: npm --version")).toBeVisible();
  await page.getByPlaceholder("输入 stdin").fill("继续");
  await page.getByRole("button", { name: "发送输入" }).click();
  await expect(page.getByText("stdin: 继续")).toBeVisible();
  await page.getByRole("button", { name: "终止会话" }).click();
  await expect(page.getByText("已退出 143")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByText("gpt-5-codex")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "medium" })).toBeVisible();
  await expect(page.getByText("connected")).toBeVisible();
  await expect(page.getByText("ChatGPT dev@example.com")).toBeVisible();
  await expect(page.getByText("pro", { exact: true })).toBeVisible();
  await expect(page.getByText("不需要")).toBeVisible();
  await page.getByRole("button", { name: "ChatGPT 登录" }).click();
  await expect(page.getByText("https://auth.openai.com/mock-codex")).toBeVisible();
  await page.getByRole("button", { name: "取消登录" }).click();
  await expect(page.getByText("登录已取消：canceled")).toBeVisible();
  await page.getByLabel("OpenAI API Key").fill("sk-e2e-account");
  await page.getByRole("button", { name: "API Key 登录" }).click();
  await expect(page.getByRole("definition").filter({ hasText: "API Key" })).toBeVisible();
  await page.getByRole("button", { name: "退出账号" }).click();
  await expect(page.getByText("未登录")).toBeVisible();
  await page.getByRole("button", { name: "ChatGPT 登录" }).click();
  await expect(page.getByText("ChatGPT dev@example.com")).toBeVisible();
  await page.getByRole("button", { name: "读取用量" }).click();
  await expect(page.getByText("123456")).toBeVisible();
  await expect(page.getByText("2026-06-23")).toBeVisible();
  await page.getByRole("button", { name: "发送额度提醒" }).click();
  await expect(page.getByText("提醒结果：sent")).toBeVisible();
  await page.getByRole("button", { name: "发送用量限制提醒" }).click();
  await expect(page.getByText("提醒结果：sent")).toBeVisible();
  await expect(page.getByText("Codex 42%")).toBeVisible();
  await expect(page.getByText("命名空间工具 / 图像生成")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "手机浏览器" })).toBeVisible();
  await expect(page.getByText("2 个服务 / 3 个工具")).toBeVisible();
  await page.getByRole("button", { name: "刷新 filesystem" }).click();
  await expect(page.getByText("filesystem 已刷新")).toBeVisible();
  await page.getByRole("button", { name: "登录 github" }).click();
  await expect(page.getByText("https://example.com/mcp/github/oauth")).toBeVisible();
  await page.getByRole("button", { name: "读取资源 README" }).click();
  await expect(page.getByText("来自 MCP 资源。")).toBeVisible();
  await expect(page.getByText("Code / Ask")).toBeVisible();
  await expect(page.getByText("1 个启用 / 2 个 Skills")).toBeVisible();
  await expect(page.getByText("openai-docs / repo-helper")).toBeVisible();
  await expect(page.getByText("1 个启用 / 1 个 Hooks")).toBeVisible();
  await expect(page.getByText("post-tool-use-format").first()).toBeVisible();
  await expect(page.getByText("npm run format")).toBeVisible();
  await expect(page.getByText("Hook 警告：hook 即将迁移")).toBeVisible();
  await expect(page.getByText("1 个已安装 / 2 个插件")).toBeVisible();
  await expect(page.getByText("浏览器工具 / review-pack")).toBeVisible();

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

test("设置面板会响应 app-server 集成状态更新", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Codex 42%")).toBeVisible();

  await page.evaluate(async () => {
    const response = await fetch("/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "mock-thread-1",
        text: "settings refresh",
        model: "gpt-5-codex",
        reasoningEffort: "medium",
        permissions: "default"
      })
    });
    if (!response.ok) {
      throw new Error("无法触发设置刷新");
    }
  });

  await expect(page.getByText("Codex 64%")).toBeVisible();
});

test("设置面板可以管理远程控制配对和客户端", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "撤销 手机浏览器" })).toBeVisible();

  await page.getByRole("button", { name: "开始配对" }).click();
  await expect(page.getByText("123-456")).toBeVisible();
  await expect(page.getByText("pair-code-1")).toBeVisible();

  await page.getByRole("button", { name: "刷新配对状态" }).click();
  await expect(page.getByText("配对已领取")).toBeVisible();

  await page.getByRole("button", { name: "撤销 手机浏览器" }).click();
  await expect(page.getByText("无客户端")).toBeVisible();

  await page.getByRole("button", { name: "关闭远控" }).click();
  await expect(page.getByText("disabled")).toBeVisible();

  await page.getByRole("button", { name: "启用远控" }).click();
  await expect(page.getByText("connected")).toBeVisible();
});

test("设置面板可以查看、安装和卸载插件", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();

  await page.getByRole("button", { name: "详情 浏览器工具" }).click();
  await expect(page.getByText("用于移动端验证网页和截图。")).toBeVisible();
  await expect(page.getByText("Skills 1 / Hooks 1 / Apps 1")).toBeVisible();
  await expect(page.getByText("MCP browser")).toBeVisible();

  await page.getByRole("button", { name: "安装 浏览器工具" }).click();
  await expect(page.getByText("安装结果：ON_USE")).toBeVisible();

  await page.getByRole("button", { name: "卸载 浏览器工具" }).click();
  await expect(page.getByText("插件已卸载：browser-tools")).toBeVisible();
});

test("设置面板可以管理 Skills 配置和读取插件 Skill", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();

  await page.getByPlaceholder("额外 Skill 根目录").fill("C:\\Users\\huang\\workspace\\skills");
  await page.getByRole("button", { name: "设置 Skill 根目录" }).click();
  await expect(page.getByText("Skill 根目录已更新")).toBeVisible();

  await page.getByRole("button", { name: "禁用 openai-docs" }).click();
  await expect(page.getByText("openai-docs 已禁用")).toBeVisible();

  await page.getByRole("button", { name: "详情 浏览器工具" }).click();
  await page.getByRole("button", { name: "读取 Skill browser:control" }).click();
  await expect(page.getByText("# browser:control")).toBeVisible();
  await expect(page.getByText("控制浏览器。")).toBeVisible();
});
