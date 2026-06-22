import { describe, expect, it } from "vitest";
import { createAppServerSpawnInvocation } from "../../src/server/app-server/transport";

describe("createAppServerSpawnInvocation", () => {
  it("Windows 下通过 PowerShell 启动 codex shim", () => {
    expect(createAppServerSpawnInvocation("codex", ["app-server"], "win32")).toEqual({
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "codex", "app-server"]
    });
  });

  it("非 Windows 直接启动 codex", () => {
    expect(createAppServerSpawnInvocation("codex", ["app-server"], "linux")).toEqual({
      command: "codex",
      args: ["app-server"]
    });
  });
});
