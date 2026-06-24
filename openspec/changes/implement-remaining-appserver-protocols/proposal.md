## Why

当前移动端 Web 后端已经代理了大多数 Codex app-server `ClientRequest` method，但仍有 20 个 method 通过覆盖率测试的排除规则临时跳过。继续保留这些缺口会让后端能力、移动端设置页/插件页和生成协议定义之间长期不一致，也会让后续接入 app-server 新能力时难以判断真实完成度。

## What Changes

- 补齐当前被 `tests/unit/protocol-coverage.test.ts` 排除的剩余 app-server method 代理能力，并让覆盖率测试不再依赖这些临时排除项。
- 为环境接入、external agent config、feedback、marketplace、plugin share、MCP tool call 和 thread realtime 建立移动端 Web 可调用的后端契约。
- 在 `CodexAppServerClient`、`AppServerGateway`、mock runtime、HTTP route 和后端 API 文档中保持同一套命名、参数校验、返回结构和错误处理习惯。
- 保持移动端 Web 产品方向：新增 API 只服务手机浏览器需要的能力，不引入电脑端布局或桌面专用 UI。
- 不修改机器生成的 app-server 协议文件；实现层只消费已有 generated TypeScript 类型。

## Capabilities

### New Capabilities
- `appserver-remaining-protocols`: 定义移动端 Web 后端对剩余 app-server `ClientRequest` method 的代理覆盖要求，包括 `environment/add`、`externalAgentConfig/detect`、`externalAgentConfig/import`、`feedback/upload`、`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`mcpServer/tool/call`、`plugin/installed`、`plugin/share/*` 和 `thread/realtime/*`。

### Modified Capabilities
（无）

## Impact

- 影响 `src/server/app-server/client.ts`、`src/server/app-server/runtime.ts`、`src/shared/codex.ts` 和相关 `src/app/api/codex/**/route.ts`。
- 影响 mock app-server 行为、单元测试、集成测试和 `docs/backend-api.md` 中的后端 API 说明。
- 需要复核 `tests/unit/protocol-coverage.test.ts` 的排除规则，确保剩余 method 接入后覆盖率测试能直接暴露新增缺口。
- 不增加新的外部服务依赖；继续使用现有 app-server JSON-RPC transport、Next route handler、Vitest 和 generated TS 类型。
