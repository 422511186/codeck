# 测试与人工验收

本文档记录 Codex Web 后端的自动化验证和真实 Codex app-server 人工验收流程。当前仓库不包含前端页面、UI 原型、视觉审计或浏览器 E2E 测试。

## 自动化验证

在项目根目录运行：

```bash
npm run verify
```

期望结果：

- `npm run typecheck` 完成 TypeScript 类型检查。
- `npm run test` 跑完后端单元测试。
- 默认不会运行真实 Codex app-server 集成测试，避免在没有真实 Codex 登录或本机 app-server 条件时误失败。

## 真实 app-server 验收

推荐先在本机局域网内验收，不要直接暴露公网。

如需运行真实 `spawn` 集成测试：

```powershell
$env:CODEX_WEB_RUN_SPAWN_INTEGRATION="1"
npm run test -- tests/integration/spawn-app-server.test.ts
```

该测试会启动真实 Codex app-server，并调用 initialize、`thread/list`、`model/list`。

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
- 模型/API key 继续放在 Codex 自身配置或后端环境里。
- `CODEX_WEB_WORKSPACE_ROOTS` 只放你愿意让后端操作的目录。

### 2. 启动服务

```powershell
npm run dev
```

如果未配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时 token。临时 token 只在当前进程有效。

### 3. API 验收清单

- `/api/health` 返回健康状态。
- `/api/codex/status` 不返回 app-server token 或 URL。
- 会话列表、新建会话、读取会话、turns、turn items、模型列表等 API 能通过后端访问 Codex app-server。
- 文本、图片、审批响应、question response、fork、rollback、interrupt、steer、新建会话等动作能写入审计日志。
- Files API 只能读取 `CODEX_WEB_WORKSPACE_ROOTS` 内路径。
- Terminal/Process API 只能在 `CODEX_WEB_WORKSPACE_ROOTS` 内 cwd 执行命令。
- WebSocket 能转发 app-server 实时事件。
- `logs/audit.jsonl` 追加记录敏感动作，且不包含原始 token、secret、password、url。

### 4. 安全检查

- 原始 app-server URL 不通过状态 API 暴露。
- 尝试读取 workspace 外文件应返回错误。
- 尝试在 workspace 外 cwd 执行终端命令应返回错误。
- 审计日志只保存在后端机器本地，不通过 API 暴露。

## 已知边界

- 当前是个人自用模式，没有数据库、用户表和多租户隔离。
- 审计日志是本地 append-only JSONL 文件，不提供集中检索和轮转。
- 对公网开放前，需要额外配置 HTTPS、反向代理访问控制、IP allowlist 和更强认证。
