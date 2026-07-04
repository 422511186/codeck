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

## 长会话性能回归验证

长会话和流式输出性能不绑定 CI 机器上的具体毫秒数，使用可重复的数量级预算验证：

```bash
npm run test -- tests/unit/codex-client.test.ts tests/unit/web-thread-endpoints.test.ts tests/unit/web-store-events.test.ts tests/unit/web-events-client.test.ts tests/unit/web-timeline.test.tsx tests/unit/web-cards.test.tsx
```

当前关键指标：

- 首屏读取：普通 `readThread` 不使用 `thread/read includeTurns=true` 拉全量历史，而是读取 metadata 后调用 `thread/turns/list`，默认 `limit: 30`、`sortDirection: "desc"`、`itemsView: "full"`，并保留继续向上分页的 cursor。
- 流式 delta：同一 `threadId + turnId + itemId + kind + generation` 的短窗口文本 delta 合并后再进入可见 UI；测试中 10ms 窗口内同 item 两段文本只产生一个 `codex-event-batch`，重复 `eventId` 不重复追加。
- Store 复杂度：测试构造 1200 条历史 entry、追加 200 次 live 文本、再合并 40 条分页 entry，断言 normalize 次数不超过 2、索引构建 entry 数不超过 1400、线性扫描不超过 3000、等价输出候选检查不超过 2000。
- Timeline 挂载：长 timeline 初始挂载的 `[data-timeline-row='true']` 不超过 80，历史 Markdown 不同步生成全量高亮/复制按钮。
- 长内容 DOM：命令输出、工具结果、reasoning 和 diff 默认有界预览，完整内容通过展开或复制路径访问，不进入首屏主 timeline DOM。

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
- 如果本机已经有多个 app-server 进程，先不要直接清理。需要复用时优先改为 `external` 并显式指定同一个 `CODEX_WEB_APP_SERVER_URL`；本机开发想自动复用时使用 `spawn-or-connect` 和固定 `CODEX_WEB_APP_SERVER_PORT`。

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
- app-server lifecycle 状态只包含 `mode`、`state`、是否复用、是否由当前进程拥有、pid 是否已知、错误类别等安全字段，不包含原始 app-server URL 或 token。

### 4. app-server 复用验收

推荐先验收 `external`：

```powershell
codex app-server --listen ws://127.0.0.1:31317
$env:CODEX_WEB_APP_SERVER_MODE="external"
$env:CODEX_WEB_APP_SERVER_URL="ws://127.0.0.1:31317"
npm run dev
```

再启动第二个 Web 后端并使用相同 URL，两个 Web 后端都应只连接该 app-server，不应再启动额外 app-server 子进程。

本机自动复用验收：

```powershell
$env:CODEX_WEB_APP_SERVER_MODE="spawn-or-connect"
$env:CODEX_WEB_APP_SERVER_HOST="127.0.0.1"
$env:CODEX_WEB_APP_SERVER_PORT="31317"
$env:CODEX_WEB_APP_SERVER_STATE_DIR="$env:TEMP\codex-web-app-server"
npm run dev
```

期望行为：

- 固定端口已有可用 app-server 时直接复用，`/api/codex/status` 中 `reusedExisting` 为 `true`。
- 固定端口未监听时，只有一个 Web 后端获得启动权并 spawn；其它 Web 后端等待后复用。
- 端口被非 app-server 服务占用或握手失败时，返回明确错误，不会换随机端口。
- 正常退出时，当前 Web 后端拥有的子进程会被关闭，元数据会被清理。

### 5. 安全检查

- 原始 app-server URL 不通过状态 API 暴露。
- 尝试读取 workspace 外文件应返回错误。
- 尝试在 workspace 外 cwd 执行终端命令应返回错误。
- 审计日志只保存在后端机器本地，不通过 API 暴露。

## 已知边界

- 当前是个人自用模式，没有数据库、用户表和多租户隔离。
- 审计日志是本地 append-only JSONL 文件，不提供集中检索和轮转。
- 对公网开放前，需要额外配置 HTTPS、反向代理访问控制、IP allowlist 和更强认证。
