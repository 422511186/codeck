import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/integration/**/*.test.ts"],
    restoreMocks: true,
    globals: true,
    setupFiles: ["./tests/setup.ts"]
  }
});
