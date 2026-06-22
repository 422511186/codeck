import { describe, expect, it } from "vitest";
import { createAppServerGateway } from "../../src/server/app-server/runtime";

const runSpawnIntegration = process.env.CODEX_WEB_RUN_SPAWN_INTEGRATION === "1" ? describe : describe.skip;

runSpawnIntegration("真实 spawn app-server 集成测试", () => {
  it(
    "能启动 app-server 并读取基础数据",
    async () => {
      const gateway = createAppServerGateway({
        mode: "spawn",
        codexBin: process.env.CODEX_WEB_CODEX_BIN || "codex",
        host: "127.0.0.1",
        port: 31379
      });

      try {
        await gateway.ensureReady();
        expect(gateway.getStatus().state).toBe("ready");
        await expect(gateway.listThreads({ limit: 1 })).resolves.toEqual(
          expect.objectContaining({
            threads: expect.any(Array)
          })
        );
        await expect(gateway.listModels()).resolves.toEqual(expect.any(Array));
      } finally {
        gateway.close();
      }
    },
    30_000
  );
});
