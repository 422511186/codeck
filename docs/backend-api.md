# 后端 API 文档

本文档描述 Codex 移动端 Web 后端对浏览器暴露的 HTTP API 和 WebSocket 事件通道。

当前后端是个人自用模式：浏览器只访问本项目的 Web 后端；真正的 Codex 执行、会话、文件、终端、审批和设置能力由后端代理到本机 Codex app-server。

## 基础约定

基础地址：

```text
http://<后端机器 IP>:3000
```

认证方式：

- 登录接口校验 `CODEX_WEB_ACCESS_TOKEN` 或启动时生成的临时 token。
- 登录成功后后端写入签名 session cookie。
- 除 `/api/health`、`/api/auth/login`、`/api/auth/session` 外，所有 `/api/codex/*` 接口都要求携带有效 cookie。

统一成功响应：

```json
{
  "ok": true
}
```

统一失败响应：

```json
{
  "ok": false,
  "error": "错误说明"
}
```

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `200` | 请求成功 |
| `400` | 请求体或参数不合法 |
| `401` | 未登录或 session 失效 |
| `404` | 目标资源不存在 |
| `502` | 后端代理 Codex app-server 失败 |

安全边界：

- 工作区路径受 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 限制。
- 图片上传目录额外允许作为 `localImage` 来源。
- 敏感操作会写入审计日志，例如发送消息、上传图片、执行终端命令、审批响应、fork、rollback、interrupt、steer、新建会话等。

## 健康检查与登录

### `GET /api/health`

用于检查 Web 后端是否存活。

响应：

```json
{
  "ok": true,
  "appServer": "not_connected"
}
```

### `POST /api/auth/login`

使用 Web 登录 token 创建 session cookie。

请求体：

```json
{
  "token": "web-access-token"
}
```

成功响应：

```json
{
  "ok": true
}
```

失败响应：`401`

```json
{
  "ok": false
}
```

### `GET /api/auth/session`

读取当前浏览器 session 状态。

响应示例：

```json
{
  "authenticated": true
}
```

## WebSocket 事件

### `GET /ws`

浏览器事件流。连接时必须携带登录 cookie。

连接建立后后端会先发送：

```json
{
  "type": "hello",
  "status": "connected"
}
```

随后发送 app-server 健康状态：

```json
{
  "type": "health",
  "appServer": "ready"
}
```

运行中会继续转发 Codex app-server 通知和待确认请求。前端应按 `type` 分发：

| `type` | 用途 |
| --- | --- |
| `hello` | WebSocket 已连接 |
| `health` | app-server 当前状态 |
| `codex-event` | Codex 通知事件，例如 turn、item、diff、terminal 输出 |
| `server-request` | 需要用户确认的审批或 question |
| `server-request-resolved` | 待确认请求已被处理 |

`codex-event.event.kind` 当前可能值：

```text
agent_message_delta
reasoning_delta
plan_delta
command_output_delta
file_output_delta
turn_diff_updated
context_compacted
token_usage_updated
warning
settings_invalidated
thread_goal_updated
thread_goal_cleared
fs_changed
file_search_session_updated
file_search_session_completed
realtime_started
realtime_transcript_delta
realtime_transcript_done
realtime_output_audio_delta
realtime_error
realtime_closed
external_agent_config_import_completed
```

`server-request.request.kind` 当前可能值：

```text
command_approval
file_approval
permissions_approval
question
mcp_elicitation
dynamic_tool
unknown
```

## app-server 状态与模型

### `GET /api/codex/status`

读取后端到 Codex app-server 的连接状态。

响应：

```json
{
  "ok": true,
  "appServer": {
    "state": "ready",
    "mode": "spawn-or-connect",
    "managedByCurrentProcess": false,
    "reusedExisting": true,
    "pidKnown": false
  }
}
```

`appServer` 可能包含 `mode`、`state`、`managedByCurrentProcess`、`reusedExisting`、`pidKnown`、`errorKind` 和 `cleanupState` 等安全诊断字段。响应不得包含原始 app-server URL、token 或认证信息；错误时 `message` 也会做连接串脱敏。

### `GET /api/codex/models`

读取可用模型列表。

响应字段：

| 字段 | 含义 |
| --- | --- |
| `id` | 模型 ID |
| `label` | 展示名称 |
| `isDefault` | 是否默认 |
| `supportedReasoningEfforts` | 支持的推理强度 |
| `inputModalities` | 支持输入模态 |

## 会话 API

### `GET /api/codex/threads`

读取会话列表或搜索会话。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `cursor` | string | 分页游标 |
| `search` / `q` | string | 搜索关键字 |
| `archived` | boolean | 是否读取归档会话 |

响应：

```json
{
  "ok": true,
  "threads": [],
  "nextCursor": null
}
```

### `POST /api/codex/threads/start`

新建会话。

请求体：

```json
{
  "cwd": "C:/Users/huang/workspace/project",
  "workspaceRoots": ["C:/Users/huang/workspace"],
  "model": "gpt-5-codex",
  "permissions": "workspace-write"
}
```

响应：

```json
{
  "ok": true,
  "thread": {}
}
```

### `GET /api/codex/threads/:threadId`

读取会话详情。

### `POST /api/codex/threads/:threadId/resume`

恢复/加载会话，并从 app-server 读取运行上下文。

### `POST /api/codex/threads/:threadId/archive`

归档会话。

### `POST /api/codex/threads/:threadId/unarchive`

恢复归档会话。

### `POST /api/codex/threads/:threadId/delete`

删除会话。

### `POST /api/codex/threads/:threadId/fork`

从当前会话 fork 新会话。

### `POST /api/codex/threads/:threadId/rollback`

回滚会话末尾 turn，用于“编辑重发”前撤回旧上下文。

请求体：

```json
{
  "numTurns": 1
}
```

`numTurns` 可省略，默认回滚 `1` 个 turn。

响应：

```json
{
  "ok": true,
  "thread": {}
}
```

### `POST /api/codex/threads/:threadId/name`

重命名会话。

请求体：

```json
{
  "name": "新的会话标题"
}
```

### `POST /api/codex/threads/:threadId/settings`

更新会话级设置。

常用请求体：

```json
{
  "model": "gpt-5-codex",
  "reasoningEffort": "medium",
  "permissions": "workspace-write"
}
```

### `POST /api/codex/threads/:threadId/metadata`

更新会话 metadata，例如 git 信息。

请求体：

```json
{
  "gitInfo": {
    "sha": "abc123",
    "branch": "main",
    "originUrl": "https://..."
  }
}
```

### `POST /api/codex/threads/:threadId/compact`

触发上下文压缩。

### `POST /api/codex/threads/:threadId/review`

启动 review。

### `POST /api/codex/threads/:threadId/unsubscribe`

取消订阅会话。

### `POST /api/codex/threads/:threadId/shell-command`

向会话发送 shell command。

请求体：

```json
{
  "command": "npm run test"
}
```

### `POST /api/codex/threads/:threadId/memory`

设置会话 memory 模式。

请求体：

```json
{
  "mode": "auto"
}
```

### `POST /api/codex/threads/:threadId/goal`

设置会话目标。

请求体：

```json
{
  "objective": "完成移动端登录流程",
  "tokenBudget": 12000
}
```

### `DELETE /api/codex/threads/:threadId/goal`

清除会话目标。

### `POST /api/codex/threads/:threadId/items/inject`

向会话注入原始 items。

请求体：

```json
{
  "items": []
}
```

### `POST /api/codex/threads/:threadId/guardian/approve-denied-action`

批准 Guardian 拦截动作。

请求体：

```json
{
  "event": {}
}
```

## Realtime 会话 API

这些接口用于从手机浏览器控制某个 thread 的 realtime 会话。相关增量事件仍通过 `/ws` 的 `codex-event` 下发。

### `GET /api/codex/realtime/voices`

读取可用 realtime voice。

响应：

```json
{
  "ok": true,
  "voices": {
    "v1": ["alloy"],
    "v2": ["cedar"],
    "defaultV1": "alloy",
    "defaultV2": "cedar"
  }
}
```

### `POST /api/codex/threads/:threadId/realtime/start`

启动 thread realtime 会话。

请求体：

```json
{
  "outputModality": "text",
  "architecture": "realtimeapi",
  "model": "gpt-4o-realtime-preview",
  "includeStartupContext": true,
  "prompt": "用中文回答",
  "version": "v2",
  "voice": "cedar"
}
```

`outputModality` 必填，只能是 `text` 或 `audio`。其他字段可省略。

响应：

```json
{
  "ok": true,
  "result": {
    "started": true
  }
}
```

### `POST /api/codex/threads/:threadId/realtime/append-text`

向 realtime 会话追加文本输入。

请求体：

```json
{
  "text": "继续解释这个错误",
  "role": "user"
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "accepted": true
  }
}
```

`role` 只能是 `user` 或 `developer`，与 app-server generated 协议保持一致。

### `POST /api/codex/threads/:threadId/realtime/append-audio`

向 realtime 会话追加音频 chunk。`audio.data` 使用 base64 文本。

请求体：

```json
{
  "audio": {
    "data": "base64-audio",
    "sampleRate": 24000,
    "numChannels": 1,
    "samplesPerChannel": 1200,
    "itemId": "optional-item-id"
  }
}
```

响应同文本追加，成功时返回 `{ "ok": true, "result": { "accepted": true } }`。

### `POST /api/codex/threads/:threadId/realtime/append-speech`

向 realtime 会话追加要朗读的文本。

请求体：

```json
{
  "text": "请朗读这句话"
}
```

响应同文本追加，成功时返回 `{ "ok": true, "result": { "accepted": true } }`。

### `POST /api/codex/threads/:threadId/realtime/stop`

停止 thread realtime 会话。

响应：

```json
{
  "ok": true,
  "result": {
    "stopped": true
  }
}
```

## Turn 与消息 API

### `POST /api/codex/turns/start`

发送用户消息并启动新 turn。

请求体：

```json
{
  "threadId": "thread-id",
  "text": "帮我修复这个问题",
  "imagePaths": ["C:/.../uploads/image.png"],
  "model": "gpt-5-codex",
  "reasoningEffort": "medium",
  "permissions": "workspace-write"
}
```

注意：

- `threadId` 必填。
- `text` 必须非空。
- `imagePaths` 必须来自上传目录或允许的工作区路径。

响应：

```json
{
  "ok": true,
  "turnId": "turn-id",
  "thread": {}
}
```

### `POST /api/codex/turns/:threadId/interrupt`

中断当前 turn。

请求体：

```json
{
  "turnId": "turn-id"
}
```

### `POST /api/codex/turns/:threadId/steer`

向运行中的 turn 追加 steer 指令。

请求体：

```json
{
  "expectedTurnId": "turn-id",
  "text": "改成只处理移动端"
}
```

### `GET /api/codex/threads/:threadId/turns`

读取会话 timeline。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `limit` | number | 返回数量 |
| `cursor` | string | 分页游标 |

### `GET /api/codex/threads/:threadId/turns/:turnId/items`

读取某个 turn 的 items 分页。

查询参数同上。

## 审批与 question

### `GET /api/codex/requests`

读取待处理的 app-server 请求，例如命令审批、文件审批、权限审批、question。

响应：

```json
{
  "ok": true,
  "requests": []
}
```

### `POST /api/codex/requests/:requestId/resolve`

确认或拒绝一个待处理请求。

请求体：

```json
{
  "response": {}
}
```

`response` 结构取决于请求类型，前端应使用 `GET /api/codex/requests` 或 WebSocket `server-request` 事件中的 schema 渲染确认 UI。

## 图片上传

### `POST /api/codex/uploads/images`

上传图片并返回本机暂存路径，供 `POST /api/codex/turns/start` 的 `imagePaths` 使用。

请求格式：`multipart/form-data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `image` | File | 图片文件 |

响应：

```json
{
  "ok": true,
  "image": {
    "path": "C:/.../uploads/xxx.png",
    "mimeType": "image/png",
    "size": 12345
  }
}
```

## 文件 API

所有路径都受 workspace allowlist 限制。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/fs/directory?path=...` | 读取目录 |
| `POST` | `/api/codex/fs/directory` | 创建目录，body: `{ "path": "..." }` |
| `GET` | `/api/codex/fs/file?path=...` | 读取文件文本 |
| `PUT` | `/api/codex/fs/file` | 写入文件，body: `{ "path": "...", "text": "..." }` |
| `GET` | `/api/codex/fs/metadata?path=...` | 读取文件元数据 |
| `POST` | `/api/codex/fs/remove` | 删除路径，body: `{ "path": "..." }` |
| `POST` | `/api/codex/fs/copy` | 复制路径，body: `{ "sourcePath": "...", "destinationPath": "..." }` |
| `POST` | `/api/codex/fs/watch` | 监听路径，body: `{ "path": "..." }` |
| `POST` | `/api/codex/fs/unwatch` | 停止监听，body: `{ "watchId": "..." }` |
| `POST` | `/api/codex/fs/search` | 模糊搜索文件，body: `{ "query": "...", "roots": ["..."] }` |
| `POST` | `/api/codex/fs/search-session` | 创建搜索 session，body: `{ "roots": ["..."] }` |
| `PUT` | `/api/codex/fs/search-session` | 更新搜索 session，body: `{ "sessionId": "...", "query": "..." }` |
| `DELETE` | `/api/codex/fs/search-session` | 停止搜索 session，body: `{ "sessionId": "..." }` |

## 终端与命令 API

### 一次性命令

`POST /api/codex/terminal/exec`

请求体：

```json
{
  "command": ["npm", "run", "test"],
  "cwd": "C:/Users/huang/workspace/project",
  "timeoutMs": 30000
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

### command-exec 会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/codex/command-exec/spawn` | 启动 command exec，body: `{ "command": ["npm","run","dev"], "cwd": "..." }` |
| `GET` | `/api/codex/command-exec/:processId` | 读取会话状态和输出 |
| `POST` | `/api/codex/command-exec/:processId/stdin` | 写入 stdin，body: `{ "text": "..." }` |
| `POST` | `/api/codex/command-exec/:processId/resize` | 调整尺寸，body: `{ "cols": 80, "rows": 24 }` |
| `POST` | `/api/codex/command-exec/:processId/terminate` | 终止会话 |

### process 会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/codex/process/spawn` | 启动 process，body: `{ "command": ["bash"], "cwd": "..." }` |
| `GET` | `/api/codex/process/:processHandle` | 读取 process 状态和输出 |
| `POST` | `/api/codex/process/:processHandle/stdin` | 写入 stdin |
| `POST` | `/api/codex/process/:processHandle/resize` | 调整 pty 尺寸 |
| `POST` | `/api/codex/process/:processHandle/kill` | 结束 process |

### 会话后台终端

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/threads/:threadId/background-terminals` | 列出后台终端 |
| `POST` | `/api/codex/threads/:threadId/background-terminals/:processId/terminate` | 终止后台终端 |
| `POST` | `/api/codex/threads/:threadId/background-terminals/clean` | 清理后台终端 |

## Git 与摘要

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/conversation-summary?threadId=...` | 读取会话摘要 |
| `GET` | `/api/codex/git/diff-to-remote?cwd=...` | 读取当前工作区相对远端 diff |

## 设置、账号与配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/settings` | 读取设置总览，包括模型、权限、账号、MCP、技能、插件、远程控制 |
| `GET` | `/api/codex/account/auth-status` | 读取 Codex 账号登录状态 |
| `POST` | `/api/codex/account/login/chatgpt` | 发起 ChatGPT 登录 |
| `POST` | `/api/codex/account/login/api-key` | 使用 API key 登录，body: `{ "apiKey": "..." }` |
| `POST` | `/api/codex/account/login/:loginId/cancel` | 取消登录流程 |
| `POST` | `/api/codex/account/logout` | 退出 Codex 账号 |
| `GET` | `/api/codex/account/token-usage` | 读取 token 用量 |
| `POST` | `/api/codex/account/rate-limit-reset-credit/consume` | 消费额度重置 credit |
| `POST` | `/api/codex/account/add-credits-nudge` | 发送加购提醒，body: `{ "creditType": "credits" }` |
| `GET` | `/api/codex/config/requirements` | 读取配置要求 |
| `POST` | `/api/codex/config/value` | 写入单个配置值 |
| `POST` | `/api/codex/config/batch` | 批量写入配置 |
| `POST` | `/api/codex/experimental-features/enablement` | 开关实验功能 |
| `POST` | `/api/codex/memory/reset` | 重置全局 memory |

## 环境、反馈与 external agent config

这些接口会代理到 Codex app-server 的对应协议。新增环境、导入配置和上传反馈都会写入审计日志。

### `POST /api/codex/environment/add`

把一个可执行环境注册给 app-server。

请求体：

```json
{
  "environmentId": "env-1",
  "execServerUrl": "http://127.0.0.1:4242"
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "added": true
  }
}
```

### `POST /api/codex/external-agent-config/detect`

检测可迁移的 external agent config。

请求体：

```json
{
  "includeHome": true,
  "cwds": ["C:/Users/huang/workspace/project"]
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "items": []
  }
}
```

### `POST /api/codex/external-agent-config/import`

导入检测到的 external agent config。

请求体：

```json
{
  "migrationItems": [
    {
      "itemType": "AGENTS_MD",
      "description": "导入项目 AGENTS.md",
      "cwd": "C:/Users/huang/workspace/project",
      "details": null
    }
  ]
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "importId": "import-id"
  }
}
```

导入完成后，`/ws` 会收到 `external_agent_config_import_completed` 事件，事件中包含成功项和失败项摘要。

### `POST /api/codex/feedback/upload`

上传用户反馈。`classification` 必填，其他字段可选。

请求体：

```json
{
  "classification": "bug",
  "reason": "移动端无法继续会话",
  "threadId": "thread-id",
  "includeLogs": true,
  "extraLogFiles": [],
  "tags": {
    "surface": "mobile-web"
  }
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "threadId": "thread-id"
  }
}
```

## Marketplace 与插件分享

Marketplace 写操作和 plugin share 写操作都会写入审计日志。列表接口返回的数据保持 app-server 结果的移动端 JSON 形态，前端应按空列表、错误和分页状态做容错展示。

### Marketplace

| 方法 | 路径 | 关键请求体 | 响应 |
| --- | --- | --- | --- |
| `POST` | `/api/codex/marketplace/add` | `{ "source": "https://...", "refName": "main", "sparsePaths": [] }` | `{ "ok": true, "result": { "marketplaceName": "...", "installedRoot": "...", "alreadyAdded": false } }` |
| `POST` | `/api/codex/marketplace/remove` | `{ "marketplaceName": "personal" }` | `{ "ok": true, "result": { "marketplaceName": "...", "installedRoot": "..." } }` |
| `POST` | `/api/codex/marketplace/upgrade` | `{ "marketplaceName": "personal" }`，可省略表示升级默认范围 | `{ "ok": true, "result": { "selectedMarketplaces": [], "upgradedRoots": [], "errors": [] } }` |

### 插件安装结果与分享

| 方法 | 路径 | 关键请求体 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/codex/plugins/installed` | `{ "cwds": [], "installSuggestionPluginNames": [] }` | 查询插件安装结果、marketplace 数据和加载错误 |
| `POST` | `/api/codex/plugins/share/save` | `{ "pluginPath": "...", "remotePluginId": "...", "discoverability": "PRIVATE", "shareTargets": [] }` | 保存插件分享，返回 `remotePluginId` 和 `shareUrl` |
| `POST` | `/api/codex/plugins/share/update-targets` | `{ "remotePluginId": "...", "discoverability": "PRIVATE", "shareTargets": [] }` | 更新分享目标和可发现性 |
| `GET` | `/api/codex/plugins/share/list` | 无 | 列出当前账号可见的 plugin share |
| `POST` | `/api/codex/plugins/share/checkout` | `{ "remotePluginId": "..." }` | checkout 远程分享插件到本机 marketplace |
| `POST` | `/api/codex/plugins/share/delete` | `{ "remotePluginId": "..." }` | 删除远程 plugin share |

## Remote Control

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/codex/remote-control/enable` | 启用 remote-control |
| `POST` | `/api/codex/remote-control/disable` | 禁用 remote-control |
| `POST` | `/api/codex/remote-control/pairing` | 开始配对 |
| `POST` | `/api/codex/remote-control/pairing/status` | 查询配对状态 |
| `POST` | `/api/codex/remote-control/clients/:clientId/revoke` | 撤销客户端 |

## MCP、插件、技能与应用

这些接口目前作为基础能力或预留入口存在，移动端 UI 可按 Codex 能力可用性决定是否展示。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/apps` | 列出 app-server apps |
| `POST` | `/api/codex/mcp/resources/read` | 读取 MCP resource |
| `POST` | `/api/codex/mcp/tools/call` | 调用已配置 MCP server 的 tool |
| `POST` | `/api/codex/mcp/servers/:serverName/login` | 发起 MCP server OAuth 登录 |
| `POST` | `/api/codex/mcp/servers/:serverName/refresh` | 刷新 MCP server |
| `POST` | `/api/codex/plugins/:pluginName` | 读取插件详情 |
| `POST` | `/api/codex/plugins/:pluginName/install` | 安装插件 |
| `POST` | `/api/codex/plugins/:pluginName/uninstall` | 卸载插件 |
| `POST` | `/api/codex/plugin-skills/:skillName` | 读取插件 skill 内容 |
| `POST` | `/api/codex/skills/config` | 写入 skill 配置 |
| `POST` | `/api/codex/skills/extra-roots` | 设置额外 skill roots |

### `POST /api/codex/mcp/tools/call`

受控调用 MCP tool。`threadId`、`server` 和 `tool` 必填，`arguments` 与 `meta` 必须是 JSON 值。

请求体：

```json
{
  "threadId": "thread-id",
  "server": "filesystem",
  "tool": "read_file",
  "arguments": {
    "path": "README.md"
  }
}
```

响应：

```json
{
  "ok": true,
  "result": {
    "content": [],
    "structuredContent": null,
    "isError": false,
    "meta": null
  }
}
```

## Windows Sandbox

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/codex/windows-sandbox/readiness` | 读取 Windows Sandbox 准备状态 |
| `POST` | `/api/codex/windows-sandbox/setup` | 启动 Windows Sandbox 设置 |

## 前端推荐调用顺序

首次打开：

1. `GET /api/auth/session`
2. 未登录时调用 `POST /api/auth/login`
3. 登录后建立 `/ws`
4. `GET /api/codex/status`
5. `GET /api/codex/threads`
6. `GET /api/codex/settings`
7. `GET /api/codex/models`

发送文字消息：

1. 必要时 `POST /api/codex/threads/start`
2. `POST /api/codex/turns/start`
3. 通过 `/ws` 接收增量事件
4. 必要时轮询 `GET /api/codex/threads/:threadId/turns`

发送图片：

1. `POST /api/codex/uploads/images`
2. 把返回的 `image.path` 放入 `POST /api/codex/turns/start` 的 `imagePaths`

审批/question：

1. 从 `/ws` 接收 `server-request`
2. 或调用 `GET /api/codex/requests`
3. 用户选择后调用 `POST /api/codex/requests/:requestId/resolve`

编辑重发：

1. `POST /api/codex/threads/:threadId/rollback`
2. 用编辑后的内容调用 `POST /api/codex/turns/start`
