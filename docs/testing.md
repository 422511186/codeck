# 测试与人工验收

本文档记录 Codex 移动端 Web 的自动化验证和真实 Codex app-server 人工验收流程。

## 自动化验证

在项目根目录运行：

```bash
npm run verify
npm run test:e2e
npm run build
```

期望结果：

- `npm run verify` 完成 TypeScript 类型检查和全部单元测试。
- `npm run test:e2e` 使用 mock app-server 跑完手机视口 Playwright 流程。
- `npm run build` 完成 Next.js 生产构建。

E2E 默认使用 mock app-server，并在 `playwright.config.ts` 内配置：

- `CODEX_WEB_ACCESS_TOKEN=sk-e2e-token`
- `CODEX_WEB_WORKSPACE_ROOTS=C:\Users\huang\workspace`
- `CODEX_WEB_APP_SERVER_MODE=mock`

## 本次验收范围

本次完整验收覆盖移动端远程开发主链路：登录、会话、发送文本/图片、模型与思考强度、审批/question、fork/编辑重发、文件、diff、终端、设置、安全与测试。

以下能力本次只预留或保留已有基础接口，不作为验收必选项：

- 插件、插件市场、插件共享。
- 实时音频。
- MCP 的完整工具调用和资源工作流。
- 环境导入、外部 agent 配置。
- 反馈上传。

## 真实 app-server 验收

推荐先在本机局域网内验收，不要直接暴露公网。

如需运行真实 `spawn` 集成测试：

```powershell
$env:CODEX_WEB_RUN_SPAWN_INTEGRATION="1"
npm run test -- tests/integration/spawn-app-server.test.ts
```

该测试会启动真实 Codex app-server，并调用 initialize、`thread/list`、`model/list`。默认自动化测试不会运行它，避免在没有真实 Codex 登录或本机 app-server 条件时误失败。

### 1. 准备环境变量

PowerShell 示例：

```powershell
$env:CODEX_WEB_ACCESS_TOKEN="sk-替换成你的-web-登录-token"
$env:CODEX_WEB_WORKSPACE_ROOTS="C:\Users\huang\workspace"
$env:CODEX_WEB_UPLOAD_DIR="C:\Users\huang\workspace\codex-web\uploads"
$env:CODEX_WEB_AUDIT_LOG_PATH="C:\Users\huang\workspace\codex-web\logs\audit.jsonl"
$env:CODEX_WEB_BIND_HOST="0.0.0.0"
$env:CODEX_WEB_BIND_PORT="3000"
$env:CODEX_WEB_APP_SERVER_MODE="spawn"
```

说明：

- Web 登录 token 独立于模型/API key。
- 模型/API key 继续放在 Codex 自身配置或后端环境里，不进入浏览器。
- `CODEX_WEB_WORKSPACE_ROOTS` 只放你愿意让手机端操作的目录。

### 2. 启动服务

开发模式：

```powershell
npm run dev
```

生产模式：

```powershell
npm run build
npm run start
```

如果未配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时 token。临时 token 只在当前进程有效。

### 3. 手机访问

在同一局域网内打开：

```text
http://<后端机器局域网 IP>:3000
```

输入 `CODEX_WEB_ACCESS_TOKEN` 登录。

### 4. 功能验收清单

- 登录后能看到当前会话、连接状态、底部导航。
- 会话历史可以读取并切换。
- 新建会话后可以发送第一条消息。
- 可以切换模型和思考强度，并能正常发送文本。
- 可以上传图片，发送后 Codex 收到 `localImage`。
- app-server 实时事件能显示 agent 文本、reasoning、计划、命令输出、文件变更、diff、token 用量。
- 命令审批、文件审批、权限审批、question 能在手机端确认，并回传 response。
- fork 后切换到新会话。
- 编辑重发会先 rollback，再发送新输入。
- interrupt 和 steer 对当前 turn 生效。
- 会话操作可以发送 shell command，并能暂停/恢复 elicitation 计数。
- Files 面板只能读取 `CODEX_WEB_WORKSPACE_ROOTS` 内路径。
- Terminal 面板只能在 `CODEX_WEB_WORKSPACE_ROOTS` 内 cwd 执行命令。
- Settings 面板能显示模型、思考强度、审批策略、沙箱模式、remote-control 状态、账号额度和重置 credit，并能消费可用重置 credit。
- `logs/audit.jsonl` 追加记录敏感动作，且不包含原始 token、secret、password、url。

### 5. 安全检查

- 浏览器 Network 面板不应看到原始 app-server URL。
- `/api/codex/status` 不应返回 app-server token 或 URL。
- 尝试读取 workspace 外文件应返回错误。
- 尝试在 workspace 外 cwd 执行终端命令应返回错误。
- 审计日志只保存在后端机器本地，不通过 API 暴露。

## 已知边界

- 当前是个人自用模式，没有数据库、用户表和多租户隔离。
- 审计日志是本地 append-only JSONL 文件，不提供集中检索和轮转。
- 对公网开放前，需要额外配置 HTTPS、反向代理访问控制、IP allowlist 和更强认证。
