import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("会话内容")).toBeVisible();
}

async function expectHealthyMobilePage(page: import("@playwright/test").Page) {
  await expect(page.locator("main.workbench")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "移动端导航" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
  await expect.poll(async () => (await page.locator("body").innerText()).trim().length).toBeGreaterThan(50);
}

test("手机端关键页面截图视觉审计", async ({ page }) => {
  test.setTimeout(60_000);

  const screenshotDir = path.join(process.cwd(), "test-results", "visual-audit");
  await mkdir(screenshotDir, { recursive: true });

  await login(page);
  await expectHealthyMobilePage(page);
  await page.screenshot({ path: path.join(screenshotDir, "01-chats.png"), fullPage: true });

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByText("MCP 预留：2 个服务 / 3 个工具")).toBeVisible();
  await expect(page.getByText("插件预留：1 个已安装 / 2 个插件")).toBeVisible();
  await expectHealthyMobilePage(page);
  await page.screenshot({ path: path.join(screenshotDir, "02-settings.png"), fullPage: true });

  await page.getByRole("button", { name: "Files" }).click();
  await expect(page.getByRole("heading", { name: "文件" })).toBeVisible();
  await expectHealthyMobilePage(page);
  await page.screenshot({ path: path.join(screenshotDir, "03-files.png"), fullPage: true });

  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByRole("heading", { name: "终端" })).toBeVisible();
  await expectHealthyMobilePage(page);
  await page.screenshot({ path: path.join(screenshotDir, "04-terminal.png"), fullPage: true });

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Diff" })).toBeVisible();
  await expectHealthyMobilePage(page);
  await page.screenshot({ path: path.join(screenshotDir, "05-run.png"), fullPage: true });
});
