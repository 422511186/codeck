import { describe, expect, it } from "vitest";
import { createAppServerGateway } from "../../src/server/app-server/runtime";

describe("createAppServerGateway", () => {
  it("mock 模式可以初始化并返回移动端基础数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });

    await gateway.ensureReady();

    expect(gateway.getStatus().state).toBe("ready");
    await expect(gateway.listThreads({ limit: 10 })).resolves.toMatchObject({
      threads: [
        {
          id: "mock-thread-1",
          title: "示例会话",
          status: "idle"
        }
      ],
      nextCursor: null
    });
    await expect(gateway.listModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gpt-5-codex",
          label: "GPT-5 Codex",
          isDefault: true
        })
      ])
    );
  });

  it("off 模式会保留 disabled 状态并拒绝请求", async () => {
    const gateway = createAppServerGateway({ mode: "off" });

    expect(gateway.getStatus()).toEqual({ state: "disabled" });
    await expect(gateway.listThreads()).rejects.toThrow("app-server 已关闭");
  });

  it("mock 模式发送消息时会广播规范化 realtime 事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "实时流测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-live-4",
        delta: "实时事件：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-reasoning-4",
        delta: "思考：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-plan-4",
        delta: "计划：整理请求并生成回复"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-command-4",
        delta: "命令输出：mock 完成"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        diff: "diff --git a/mock.txt b/mock.txt"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-file-4",
        delta: "文件输出：mock.txt 已更新"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        totalTokens: 128,
        inputTokens: 48,
        outputTokens: 64,
        reasoningOutputTokens: 16,
        modelContextWindow: 200000
      }
    });
  });

  it("mock 模式收到 server request 时会进入 pending 队列并广播给浏览器", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "审批测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(gateway.listPendingServerRequests()).toHaveLength(1);
    expect(events).toContainEqual({
      type: "server-request",
      request: expect.objectContaining({
        requestId: 1,
        kind: "command_approval",
        title: "命令审批",
        description: "npm test"
      })
    });

    await gateway.resolveServerRequest(1, { decision: "accept" });

    expect(gateway.listPendingServerRequests()).toEqual([]);
    expect(events).toContainEqual({ type: "server-request-resolved", requestId: 1 });
  });

  it("mock 模式支持 fork、rollback、interrupt 和 steer", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const forked = await gateway.forkThread("mock-thread-1");
    expect(forked.id).not.toBe("mock-thread-1");

    await gateway.startTurn({ threadId: forked.id, text: "需要回滚" });
    const rolledBack = await gateway.rollbackThread(forked.id, 1);
    expect(rolledBack.timeline.some((item) => item.text.includes("需要回滚"))).toBe(false);

    await expect(gateway.interruptTurn(forked.id, rolledBack.lastTurnId || "mock-turn-1")).resolves.toBeUndefined();
    await expect(
      gateway.steerTurn({ threadId: forked.id, expectedTurnId: rolledBack.lastTurnId || "mock-turn-1", text: "请继续" })
    ).resolves.toMatchObject({ turnId: expect.any(String) });
  });

  it("mock 模式支持文件、终端和设置面板所需数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual([
      {
        name: "src",
        path: "C:\\Users\\huang\\workspace\\src",
        isDirectory: true,
        isFile: false
      },
      {
        name: "README.md",
        path: "C:\\Users\\huang\\workspace\\README.md",
        isDirectory: false,
        isFile: true
      }
    ]);
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.md",
      text: "# Codex Web\n\n移动端 Web 工作台 mock 文件。"
    });
    await expect(gateway.getMetadata("C:\\Users\\huang\\workspace\\README.md")).resolves.toMatchObject({
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      createdAtMs: expect.any(Number),
      modifiedAtMs: expect.any(Number)
    });
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 已保存\n\n来自移动端。");
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.md",
      text: "# 已保存\n\n来自移动端。"
    });
    await gateway.createDirectory("C:\\Users\\huang\\workspace\\docs");
    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual(
      expect.arrayContaining([
        {
          name: "docs",
          path: "C:\\Users\\huang\\workspace\\docs",
          isDirectory: true,
          isFile: false
        }
      ])
    );
    await gateway.copyPath("C:\\Users\\huang\\workspace\\README.md", "C:\\Users\\huang\\workspace\\README.copy.md");
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.copy.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.copy.md",
      text: "# 已保存\n\n来自移动端。"
    });
    await gateway.removePath("C:\\Users\\huang\\workspace\\README.copy.md");
    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          path: "C:\\Users\\huang\\workspace\\README.copy.md"
        })
      ])
    );
    await expect(gateway.execCommand({ command: ["npm", "--version"], cwd: "C:\\Users\\huang\\workspace" })).resolves.toEqual({
      exitCode: 0,
      stdout: "mock command: npm --version\ncwd: C:\\Users\\huang\\workspace",
      stderr: ""
    });
    await expect(gateway.searchFiles({ query: "app", roots: ["C:\\Users\\huang\\workspace"] })).resolves.toEqual([
      {
        root: "C:\\Users\\huang\\workspace",
        path: "src\\app.ts",
        fullPath: "C:\\Users\\huang\\workspace\\src\\app.ts",
        fileName: "app.ts",
        matchType: "file",
        score: 100,
        indices: [0, 1, 2]
      }
    ]);
    await expect(gateway.readSettings()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      loadedThreadIds: ["mock-thread-1"],
      experimentalFeatures: [
        {
          name: "appshots",
          stage: "beta",
          displayName: "Appshots",
          description: "自动保存移动端应用截图",
          announcement: "Appshots 已可在移动端试用",
          enabled: false,
          defaultEnabled: false
        }
      ],
      authStatus: {
        authMethod: "chatgpt",
        hasAuthToken: false,
        requiresOpenaiAuth: false
      },
      remoteControlStatus: "connected",
      remoteControlServerName: "mock",
      remoteControlInstallationId: "mock-installation",
      remoteControlEnvironmentId: "mock-env",
      account: {
        type: "chatgpt",
        email: "dev@example.com",
        planType: "pro",
        requiresOpenaiAuth: false
      },
      rateLimit: {
        limitId: "codex",
        limitName: "Codex",
        usedPercent: 42,
        windowDurationMins: 300,
        resetsAt: 1_800_000_000
      },
      providerCapabilities: {
        namespaceTools: true,
        imageGeneration: true,
        webSearch: false
      },
      remoteControlClients: [
        {
          clientId: "mock-phone",
          displayName: "手机浏览器",
          deviceType: "phone",
          platform: "web",
          lastSeenAt: 1_800_000_001
        }
      ],
      mcpServers: [
        {
          name: "filesystem",
          authStatus: "bearerToken",
          toolCount: 2,
          resourceCount: 1,
          resourceTemplateCount: 0,
          resources: [{ uri: "file:///README.md", name: "README", mimeType: "text/markdown" }]
        },
        {
          name: "github",
          authStatus: "notLoggedIn",
          toolCount: 1,
          resourceCount: 0,
          resourceTemplateCount: 0,
          resources: []
        }
      ],
      collaborationModes: [
        { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
        { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
      ],
      permissionProfiles: [
        { id: "default", label: "default", description: "默认权限配置" },
        { id: "read-only", label: "read-only", description: "只读工作区" },
        { id: "full-auto", label: "full-auto", description: "允许自动执行" }
      ],
      skills: [
        {
          cwd: "C:\\Users\\huang\\workspace",
          name: "openai-docs",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        },
        {
          cwd: "C:\\Users\\huang\\workspace",
          name: "repo-helper",
          description: "项目内辅助技能",
          shortDescription: null,
          scope: "repo",
          enabled: false
        }
      ],
      skillErrors: [],
      hooks: [
        {
          cwd: "C:\\Users\\huang\\workspace",
          key: "post-tool-use-format",
          eventName: "postToolUse",
          handlerType: "command",
          matcher: "Edit",
          command: "npm run format",
          source: "project",
          sourcePath: "C:\\Users\\huang\\workspace\\.codex\\hooks.json",
          pluginId: null,
          enabled: true,
          trustStatus: "trusted",
          statusMessage: "格式化文件"
        }
      ],
      hookWarnings: [{ cwd: "C:\\Users\\huang\\workspace", message: "hook 即将迁移" }],
      hookErrors: [],
      plugins: [
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "browser-tools",
          name: "browser-tools",
          displayName: "浏览器工具",
          shortDescription: "控制浏览器",
          installed: true,
          enabled: true,
          availability: "AVAILABLE",
          sourceType: "local"
        },
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "review-pack",
          name: "review-pack",
          displayName: null,
          shortDescription: null,
          installed: false,
          enabled: false,
          availability: "DISABLED_BY_ADMIN",
          sourceType: "remote"
        }
      ],
      pluginMarketplaceErrors: []
    });
  });

  it("mock 模式支持监听文件变化并停止监听", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();

    await expect(gateway.watchPath("C:\\Users\\huang\\workspace")).resolves.toEqual({
      watchId: "mobile-watch-1",
      path: "C:\\Users\\huang\\workspace"
    });
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 触发监听");

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "fs_changed",
        watchId: "mobile-watch-1",
        paths: ["C:\\Users\\huang\\workspace\\README.md"]
      }
    });

    events.length = 0;
    await expect(gateway.unwatchPath("mobile-watch-1")).resolves.toBeUndefined();
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 停止监听后不广播");

    expect(events).toEqual([]);
  });

  it("mock 模式支持交互式终端会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const session = await gateway.startProcessSession({
      command: ["npm", "test"],
      cwd: "C:\\Users\\huang\\workspace"
    });

    expect(session).toMatchObject({
      cwd: "C:\\Users\\huang\\workspace",
      command: ["npm", "test"],
      exitCode: null,
      running: true
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("mock process: npm test"),
      running: true
    });

    await gateway.writeProcessStdin(session.processHandle, "继续\n");
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("stdin: 继续")
    });

    await gateway.resizeProcessSession(session.processHandle, 100, 30);
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("PTY 100x30")
    });

    await gateway.killProcessSession(session.processHandle);
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      exitCode: 143,
      running: false
    });
  });

  it("mock 模式支持 command exec 会话控制", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const session = await gateway.startCommandExecSession({
      command: ["node", "-i"],
      cwd: "C:\\Users\\huang\\workspace"
    });

    expect(session).toMatchObject({
      cwd: "C:\\Users\\huang\\workspace",
      command: ["node", "-i"],
      exitCode: null,
      running: true
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("mock command exec: node -i"),
      running: true
    });

    await gateway.writeCommandExecStdin(session.processHandle, "继续\n");
    await gateway.resizeCommandExecSession(session.processHandle, 100, 30);
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("stdin: 继续"),
      running: true
    });

    await gateway.terminateCommandExecSession(session.processHandle);
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      exitCode: 143,
      running: false
    });
  });

  it("mock 模式支持管理会话后台终端", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listThreadBackgroundTerminals({ threadId: "mock-thread-1" })).resolves.toEqual({
      terminals: [
        {
          itemId: "mock-bg-item-1",
          processId: "mock-bg-1",
          command: "npm run dev",
          cwd: "C:\\Users\\huang\\workspace",
          osPid: 4242,
          cpuPercent: 1.5,
          rssKb: 2048
        }
      ],
      nextCursor: null
    });
    await expect(gateway.terminateThreadBackgroundTerminal("mock-thread-1", "mock-bg-1")).resolves.toEqual({
      terminated: true
    });
    await expect(gateway.listThreadBackgroundTerminals({ threadId: "mock-thread-1" })).resolves.toEqual({
      terminals: [],
      nextCursor: null
    });
    await expect(gateway.cleanThreadBackgroundTerminals("mock-thread-1")).resolves.toBeUndefined();
  });

  it("mock 模式支持 turns 和 items 分页读取", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listThreadTurns({ threadId: "mock-thread-1", limit: 1 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
    await expect(gateway.listThreadTurnItems({ threadId: "mock-thread-1", turnId: "mock-turn-1", limit: 2 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
  });

  it("mock 模式支持搜索会话历史", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await expect(gateway.searchThreads({ searchTerm: "示例", limit: 10 })).resolves.toMatchObject({
      threads: expect.arrayContaining([
        expect.objectContaining({
          id: "mock-thread-1",
          title: "示例会话",
          preview: expect.stringContaining("示例")
        })
      ]),
      nextCursor: null
    });
  });

  it("mock 模式支持 resume 会话并返回初始 timeline", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.resumeThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "示例会话",
      lastTurnId: "mock-turn-1",
      timeline: expect.arrayContaining([
        expect.objectContaining({ role: "user", text: "帮我看看当前项目" }),
        expect.objectContaining({ role: "agent", text: "我已经连上 Codex app-server，可以读取历史和模型。" })
      ])
    });
  });

  it("mock 模式支持设置和清除会话目标", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.setThreadGoal({ threadId: "mock-thread-1", objective: "手机端完整目标", tokenBudget: 9000 })
    ).resolves.toMatchObject({
      objective: "手机端完整目标",
      status: "active",
      tokenBudget: 9000
    });
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      goal: expect.objectContaining({ objective: "手机端完整目标", tokenBudget: 9000 })
    });

    await expect(gateway.clearThreadGoal("mock-thread-1")).resolves.toBeUndefined();
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({ goal: null });
  });

  it("mock 模式支持上下文压缩并广播事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.compactThread("mock-thread-1");

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "context_compacted",
        threadId: "mock-thread-1",
        turnId: "mock-turn-1"
      }
    });
  });

  it("mock 模式支持启动未提交改动代码审查", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.startReview("mock-thread-1")).resolves.toEqual({
      turnId: "mock-review-2",
      reviewThreadId: "mock-thread-1"
    });
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({ role: "tool", text: "代码审查：未提交改动" }),
        expect.objectContaining({ role: "agent", text: "已开始审查未提交改动" })
      ])
    });
  });

  it("mock 模式支持管理远程控制配对和客户端", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.startRemoteControlPairing()).resolves.toMatchObject({
      pairingCode: "pair-code-1",
      manualPairingCode: "123-456",
      environmentId: "mock-env"
    });
    await expect(
      gateway.readRemoteControlPairingStatus({ pairingCode: "pair-code-1", manualPairingCode: "123-456" })
    ).resolves.toEqual({ claimed: true });

    await expect(gateway.revokeRemoteControlClient("mock-env", "mock-phone")).resolves.toBeUndefined();
    await expect(gateway.readSettings()).resolves.toMatchObject({
      remoteControlClients: []
    });

    await expect(gateway.disableRemoteControl()).resolves.toMatchObject({ status: "disabled", environmentId: null });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      remoteControlStatus: "disabled",
      remoteControlEnvironmentId: null
    });

    await expect(gateway.enableRemoteControl()).resolves.toMatchObject({ status: "connected", environmentId: "mock-env" });
  });

  it("mock 模式支持读取、安装和卸载插件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.readPlugin({
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        pluginName: "browser-tools"
      })
    ).resolves.toMatchObject({
      id: "browser-tools",
      displayName: "浏览器工具",
      skillCount: 1,
      hookCount: 1,
      appCount: 1,
      mcpServers: ["browser"]
    });
    await expect(
      gateway.installPlugin({
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        pluginName: "browser-tools"
      })
    ).resolves.toMatchObject({
      authPolicy: "ON_USE",
      appsNeedingAuth: [expect.objectContaining({ id: "browser-app", name: "Browser" })]
    });
    await expect(gateway.uninstallPlugin("browser-tools")).resolves.toBeUndefined();
  });

  it("mock 模式支持读取 Apps 列表", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listApps()).resolves.toEqual({
      apps: [
        {
          id: "browser-app",
          name: "Browser",
          description: "浏览器应用",
          category: "tool",
          developer: "OpenAI",
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
          pluginDisplayNames: ["浏览器工具"]
        }
      ],
      nextCursor: null
    });
  });

  it("mock 模式支持读取配置要求和管理 Windows Sandbox", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getConfigRequirements()).resolves.toEqual({
      allowedApprovalPolicies: ["untrusted"],
      allowedSandboxModes: ["workspace-write"],
      allowedWindowsSandboxImplementations: ["unelevated"],
      allowedPermissionProfiles: { default: true, "full-auto": true },
      defaultPermissions: "default",
      allowManagedHooksOnly: false,
      allowAppshots: true,
      allowRemoteControl: true,
      featureRequirements: { skills: true, plugins: true }
    });
    await expect(gateway.getWindowsSandboxReadiness()).resolves.toEqual({ status: "updateRequired" });
    await expect(gateway.startWindowsSandboxSetup({ mode: "unelevated", cwd: "C:\\Users\\huang\\workspace" })).resolves.toEqual({
      started: true
    });
    await expect(gateway.getWindowsSandboxReadiness()).resolves.toEqual({ status: "ready" });
  });

  it("mock 模式支持切换实验功能", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.setExperimentalFeatureEnablement("appshots", true)).resolves.toBeUndefined();
    await expect(gateway.readSettings()).resolves.toMatchObject({
      experimentalFeatures: [expect.objectContaining({ name: "appshots", enabled: true })]
    });
  });

  it("mock 模式支持写入全局配置并刷新设置", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.writeConfigBatch([
        { keyPath: "model", value: "gpt-5-mini" },
        { keyPath: "model_reasoning_effort", value: "high" },
        { keyPath: "approval_policy", value: "on-request" },
        { keyPath: "sandbox_mode", value: "read-only" }
      ])
    ).resolves.toMatchObject({
      status: "written",
      filePath: "C:\\Users\\huang\\.codex\\config.toml"
    });

    await expect(gateway.readSettings()).resolves.toMatchObject({
      model: "gpt-5-mini",
      reasoningEffort: "high",
      approvalPolicy: "on-request",
      sandboxMode: "read-only"
    });
  });

  it("mock 模式支持读取插件 Skill、设置额外根目录和写入 Skill 配置", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.readPluginSkill({
        remoteMarketplaceName: "个人插件市场",
        remotePluginId: "remote-browser-tools",
        skillName: "browser:control"
      })
    ).resolves.toEqual({ contents: "# browser:control\n\n控制浏览器。" });
    await expect(gateway.setSkillsExtraRoots(["C:\\Users\\huang\\workspace\\skills"])).resolves.toBeUndefined();
    await expect(gateway.writeSkillConfig({ name: "openai-docs", enabled: false })).resolves.toEqual({
      effectiveEnabled: false
    });
  });

  it("mock 模式支持刷新 MCP、启动 OAuth 登录和读取资源", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.refreshMcpServer("filesystem")).resolves.toBeUndefined();
    await expect(gateway.loginMcpServer("github")).resolves.toEqual({
      authorizationUrl: "https://example.com/mcp/github/oauth"
    });
    await expect(
      gateway.readMcpResource({ server: "filesystem", uri: "file:///README.md", threadId: "mock-thread-1" })
    ).resolves.toEqual({
      contents: [{ uri: "file:///README.md", mimeType: "text/markdown", text: "# README\n\n来自 MCP 资源。" }]
    });
  });

  it("mock 模式支持切换记忆模式和重置记忆", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.setThreadMemoryMode("mock-thread-1", "enabled")).resolves.toBeUndefined();
    await expect(gateway.resetMemory()).resolves.toBeUndefined();
  });

  it("mock 模式支持管理 Codex 账号登录状态", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getAuthStatus()).resolves.toEqual({
      authMethod: "chatgpt",
      hasAuthToken: false,
      requiresOpenaiAuth: false
    });
    await expect(gateway.loginWithChatGpt()).resolves.toEqual({
      type: "chatgpt",
      loginId: "mock-login-1",
      authUrl: "https://auth.openai.com/mock-codex"
    });
    await expect(gateway.loginWithApiKey("sk-test")).resolves.toEqual({ type: "apiKey" });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      account: { type: "apiKey", requiresOpenaiAuth: false }
    });
    await expect(gateway.cancelAccountLogin("mock-login-1")).resolves.toEqual({ status: "canceled" });
    await expect(gateway.logoutAccount()).resolves.toBeUndefined();
    await expect(gateway.getAuthStatus()).resolves.toEqual({
      authMethod: null,
      hasAuthToken: false,
      requiresOpenaiAuth: true
    });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      account: { type: "none", email: null, planType: null, requiresOpenaiAuth: true }
    });
  });

  it("mock 模式支持读取账号 token 用量和发送加购提醒", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getAccountTokenUsage()).resolves.toEqual({
      summary: {
        lifetimeTokens: 123456,
        peakDailyTokens: 45678,
        longestRunningTurnSec: 321,
        currentStreakDays: 7,
        longestStreakDays: 21
      },
      dailyUsageBuckets: [{ startDate: "2026-06-23", tokens: 1200 }]
    });
    await expect(gateway.sendAddCreditsNudgeEmail("usage_limit")).resolves.toEqual({ status: "sent" });
  });

  it("mock 模式支持重命名当前会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const thread = await gateway.setThreadName("mock-thread-1", "手机端新标题");

    expect(thread.title).toBe("手机端新标题");
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "手机端新标题"
    });
  });

  it("mock 模式支持读取会话摘要", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getConversationSummary({ conversationId: "mock-thread-1" })).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "这是用于移动端联调的示例会话",
      status: "summary"
    });
  });

  it("mock 模式支持取消订阅会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.unsubscribeThread("mock-thread-1")).resolves.toEqual({ status: "unsubscribed" });
  });

  it("mock 模式支持归档、恢复归档和删除会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();
    const newThread = await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await gateway.archiveThread(newThread.id);
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: newThread.id })])
    });
    await expect(gateway.unarchiveThread(newThread.id)).resolves.toMatchObject({
      id: newThread.id
    });
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.arrayContaining([expect.objectContaining({ id: newThread.id })])
    });

    await gateway.deleteThread("mock-thread-1");
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: "mock-thread-1" })])
    });
  });
});
