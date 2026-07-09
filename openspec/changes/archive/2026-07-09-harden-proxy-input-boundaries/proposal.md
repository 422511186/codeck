## Why

当前 Web 代理层仍存在若干输入边界不一致：部分 JSON route 将 malformed JSON 误报为 502，部分 route 吞掉 JSON 解析失败后继续调用 app-server，少数本机路径输入未经过 workspace allowlist，图片预览范围也超出文档承诺。与此同时，app-server JSON-RPC 连接对损坏帧缺少隔离，可能把上游异常扩散到 Node 进程。

本变更用于把这些边界收敛到既有安全规格：客户端请求错误返回 400 且不触发 app-server 副作用，本机路径输入必须经过 allowlist，图片预览只读取明确允许的来源，上游协议异常应被转化为可诊断连接错误。

## What Changes

- 统一 `/api/codex/*` JSON body 解析策略：JSON 解析失败、非对象 body、字段类型错误和必填字段缺失均返回 HTTP 400。
- 移除 `request.json().catch(() => ({}))` 这类吞错模式，确保 malformed JSON 不会清空配置、安装插件或触发其它 app-server 调用。
- 对 `plugin/installed` 代理入口的 `cwds` 逐项执行 workspace allowlist 校验后再透传给 app-server。
- 收紧图片预览读取范围，仅允许 `CODEX_WEB_WORKSPACE_ROOTS` 和 `CODEX_WEB_UPLOAD_DIR`，不再默认允许整个系统临时目录。
- 为 app-server JSON-RPC WebSocket 消息解析增加异常隔离：非法 JSON 帧应关闭当前连接、拒绝 pending request，并进入可诊断错误或断开状态，而不是抛出未捕获异常。
- 补充覆盖上述场景的单元测试和 route 级测试，优先验证“不调用 app-server”的负向行为。

## Capabilities

### New Capabilities

### Modified Capabilities
- `audit-and-security`: 明确 JSON body route 的 malformed JSON 处理必须覆盖所有 `/api/codex/*` JSON 入口，包括旧 route 和使用吞错 fallback 的 route；补充 plugin installed cwd 属于代理路径输入。
- `plugin-mcp-skills`: 明确读取已安装插件时的 `cwds` 是 repo-scoped 工作目录输入，必须在调用 app-server 前校验。
- `turn-interaction`: 明确图片预览接口的可读根目录只包含 workspace roots 和 uploadDir，不默认包含系统 tmpdir。
- `app-server-lifecycle`: 明确 app-server JSON-RPC 消息解析失败时的连接隔离和诊断行为。

## Impact

- 影响 API routes：`src/app/api/codex/**/route.ts` 中使用 JSON body 的入口，重点包括 `turns/start`、`threads/start`、`process/spawn`、`command-exec/*`、`fs/*`、`requests/*/resolve`、`skills/extra-roots`、`plugins/*`。
- 影响安全 helper：`src/app/api/codex/_route-helpers.ts` 可能需要扩展 JSON 读取和数组/路径校验工具。
- 影响路径策略调用：`/api/codex/plugins/installed` 需要使用 `assertRuntimePathAllowed` 或等价 helper 校验 `cwds`。
- 影响图片预览：`src/server/image-preview.ts` 不再默认把 `tmpdir()` 加入允许根。
- 影响 app-server transport：`src/server/app-server/transport.ts` / `json-rpc.ts` 需要处理 malformed JSON-RPC 消息。
- 测试影响：新增或更新 route helper、API route、安全边界、图片预览和 app-server transport 相关 Vitest 用例。
