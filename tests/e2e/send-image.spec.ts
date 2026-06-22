import { expect, test } from "@playwright/test";

test("手机端可以上传图片并作为 localImage 发送", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("会话内容")).toBeVisible();

  await page.getByLabel("选择图片").setInputFiles({
    name: "shot.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-png")
  });
  await page.getByPlaceholder("给 Codex 发送消息").fill("看这张图");
  await expect(page.getByText("1 张")).toBeVisible();
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("[图片]")).toBeVisible();
  await expect(page.getByText("已收到：看这张图")).toBeVisible();
});
