import { expect, test } from "@playwright/test";

test("手机端登录后进入工作台", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("连接你的 Codex")).toBeVisible();

  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("历史会话")).toBeVisible();
  await expect(page.getByText("当前会话")).toBeVisible();
  await expect(page.getByText("GPT-5 Codex")).toBeVisible();
  await expect(page.getByText("会话内容")).toBeVisible();
  await expect(page.getByText("Chats")).toBeVisible();
  await expect(page.getByText("Terminal")).toBeVisible();
});

test("手机端可以从历史列表切换会话", async ({ page }) => {
  const resumeRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/codex/threads/") && request.url().endsWith("/resume")) {
      resumeRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("历史会话")).toBeVisible();
  await page.getByTitle("新会话").click();
  await expect(page.locator("h1").filter({ hasText: /新会话/ })).toBeVisible();

  await page.getByRole("button", { name: /^示例会话 这是用于移动端联调的示例会话/ }).click();
  await expect(page.getByRole("heading", { name: "示例会话" })).toBeVisible();
  expect(resumeRequests.length).toBeGreaterThan(0);
});

test("手机端可以搜索历史会话", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("历史会话")).toBeVisible();
  await page.getByLabel("搜索历史会话").fill("示例");
  await expect(page.getByRole("button", { name: /^示例会话/ }).first()).toBeVisible();

  await page.getByLabel("搜索历史会话").fill("不存在的会话");
  await expect(page.getByRole("button", { name: /^示例会话/ })).toHaveCount(0);
  await expect(page.getByText("没有匹配的会话")).toBeVisible();
});

test("手机端可以重命名、归档和删除会话", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByTitle("新会话").click();
  await page.getByPlaceholder("重命名会话").fill("手机重命名");
  await page.getByRole("button", { name: "改名" }).click();
  await expect(page.getByRole("heading", { name: "手机重命名" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^手机重命名/ })).toBeVisible();

  await page.getByRole("button", { name: "归档" }).click();
  await expect(page.getByRole("button", { name: /^手机重命名/ })).toHaveCount(0);

  await page.getByTitle("新会话").click();
  await page.getByPlaceholder("重命名会话").fill("手机删除");
  await page.getByRole("button", { name: "改名" }).click();
  await expect(page.getByRole("button", { name: /^手机删除/ })).toBeVisible();

  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("button", { name: /^手机删除/ })).toHaveCount(0);
});
