import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["Pixel 7"],
    trace: "on-first-retry"
  },
  webServer: {
    command:
      `powershell -NoProfile -Command "$env:CODEX_WEB_ACCESS_TOKEN='sk-e2e-token'; $env:CODEX_WEB_WORKSPACE_ROOTS='C:\\Users\\huang\\workspace'; $env:CODEX_WEB_APP_SERVER_MODE='mock'; $env:PORT='${port}'; npm run dev"`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000
  }
});
