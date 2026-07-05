## Why

本次 ultrareview 发现多处高置信缺陷集中在 Web 代理安全边界、app-server 协议适配、timeline 顺序与长连接会话状态。它们会导致 workspace allowlist 被绕过、审批响应语义错误、请求在 app-server 断线后悬挂，或会话历史顺序错误并影响 rewind/fork。

## What Changes

- 强化路径与请求体校验：`terminal/exec`、`threads?cwd`、`feedback.extraLogFiles`、external agent config、Windows Sandbox setup、Skills config 等入口在代理到 app-server 前执行明确校验。
- 修正 app-server timeline bootstrap 和分页排序，保证返回给前端的 turns 始终按会话正序映射为 timeline。
- 修正 JSON-RPC 断线后的 pending request 生命周期，避免 HTTP route 永久挂起。
- 修正登录/登出相关会话边界：登录返回地址只允许站内路径，登出时关闭已认证的 timeline event stream。
- 修正 server request 与审批响应适配：支持 app-server resolved notification，动态工具响应按 `submit` / `fail` 构造，保留 `requestId` 类型一致性。
- 补充回归测试，优先覆盖安全边界、协议适配和数据顺序问题。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `audit-and-security`: 明确更多 Web 代理入口必须执行 workspace/path allowlist 与严格 body validation。
- `thread-lifecycle`: 修正 thread resume 与 turns pagination 的 timeline 顺序契约。
- `timeline-event-stream`: 明确登出清理浏览器 event stream、app-server 断线失败 pending JSON-RPC，以及 resolved request notification 转发。
- `approval-inline-cards`: 修正动态工具、question/file approval 与外部 resolved 的审批响应和展示契约。
- `auth-session`: 明确登录返回路径必须是站内路径，登出后客户端实时连接必须关闭。
- `plugin-mcp-skills`: 明确 Skills config 写入必须保留 boolean 语义并拒绝 malformed payload。
- `config-management`: 补齐配置读取 API 契约实现。
- `project-management`: 保证新增项目依赖的 `threads?cwd` 后端校验真正执行 allowlist。

## Impact

- 后端 API routes：`src/app/api/codex/**/route.ts` 中路径、配置、反馈、终端、external-agent-config、requests 等入口。
- app-server 适配层：`src/server/app-server/client.ts`、`runtime.ts`、`events.ts`、`json-rpc.ts`、`transport.ts`。
- 前端会话与事件流：`src/web/events/client.ts`、`src/web/components/AppProviders.tsx`、`src/app/settings/page.tsx`、`src/app/login/page.tsx`、审批卡相关组件。
- 测试：新增或扩展 Vitest 单测，优先覆盖每个修复的失败路径与成功路径。
