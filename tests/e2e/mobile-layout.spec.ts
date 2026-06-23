import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "示例会话" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        htmlScrollWidth: document.documentElement.scrollWidth,
        htmlClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth
      }))
    )
    .toMatchObject({
      htmlScrollWidth: expect.any(Number),
      htmlClientWidth: expect.any(Number),
      bodyScrollWidth: expect.any(Number),
      bodyClientWidth: expect.any(Number)
    });

  const sizes = await page.evaluate(() => ({
    htmlOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth
  }));
  expect(sizes.htmlOverflow).toBeLessThanOrEqual(1);
  expect(sizes.bodyOverflow).toBeLessThanOrEqual(1);
}

test("手机端主屏直接展示当前会话，历史列表通过抽屉打开", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { name: "会话内容" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "历史会话" })).toBeHidden();
  await expect(page.getByRole("button", { name: "历史" })).toBeVisible();
  await expect(page.getByRole("button", { name: "操作" })).toBeVisible();
  await expect(page.getByRole("region", { name: "会话操作" })).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await expect(page.locator("body")).not.toContainText("[object Object]");

  await page.getByRole("button", { name: "历史" }).click();
  await expect(page.getByRole("heading", { name: "历史会话" })).toBeVisible();
  await page.getByLabel("搜索历史会话").fill("示例");
  await expect(page.getByRole("button", { name: /^示例会话/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "关闭历史" }).click();
  await expect(page.getByRole("heading", { name: "历史会话" })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("手机端标题、底部导航和操作抽屉不能撑破视口", async ({ page }) => {
  await login(page);

  const viewportWidth = page.viewportSize()?.width ?? 390;
  const titleBox = await page.locator(".top-bar h1").boundingBox();
  expect(titleBox).not.toBeNull();
  expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);

  for (const name of ["Chats", "Run", "Files", "Terminal", "Settings"]) {
    const button = page.getByRole("button", { name });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
  }

  await page.getByRole("button", { name: "操作" }).click();
  await expect(page.getByRole("region", { name: "会话操作" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关闭操作" }).click();
  await expect(page.getByRole("region", { name: "会话操作" })).toBeHidden();
});

test("手机端主题切换会生效并持久化", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("主题").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("主题").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
