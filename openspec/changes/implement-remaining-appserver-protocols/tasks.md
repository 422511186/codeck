## 1. 基线与测试先行

- [x] 1.1 盘点 20 个剩余 method 对应的 generated params/response 类型，记录需要导入的类型和移动端 view 字段
- [x] 1.2 为 `tests/unit/protocol-coverage.test.ts` 添加失败用例或收紧排除规则，证明剩余 method 未接入时测试会失败
- [x] 1.3 为 `CodexAppServerClient` 新增 method 名称转发测试，覆盖环境、external agent config、feedback、marketplace、plugin share、MCP tool call 和 realtime 分组
- [x] 1.4 为 mock gateway 新增行为测试，覆盖每组新增 method 的确定性响应
- [x] 1.5 为新增 HTTP route 规划成功、未认证、参数非法和 app-server 错误路径测试

## 2. Shared Types 与 Typed Client

- [x] 2.1 在 `src/shared/codex.ts` 中新增移动端输入和响应 view 类型，避免 route 直接泄漏完整 generated 类型
- [x] 2.2 在 `src/server/app-server/client.ts` 导入剩余 method 的 generated params/response 类型
- [x] 2.3 在 `CodexAppServerClient` 中实现 `environment/add`、`externalAgentConfig/detect`、`externalAgentConfig/import` 和 `feedback/upload` 的 typed 方法与 view 转换
- [x] 2.4 在 `CodexAppServerClient` 中实现 `marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`plugin/installed` 和 `plugin/share/*` 的 typed 方法与 view 转换
- [x] 2.5 在 `CodexAppServerClient` 中实现 `mcpServer/tool/call` 的 typed 方法与结果/错误转换
- [x] 2.6 在 `CodexAppServerClient` 中实现 `thread/realtime/start`、`appendAudio`、`appendText`、`appendSpeech`、`stop` 和 `listVoices` 的 typed 方法与 view 转换

## 3. Gateway、Mock 与事件流

- [x] 3.1 在 `AppServerGateway` 暴露所有新增 client 方法，并保持 `ensureReady()` 调用边界一致
- [x] 3.2 在 `MockAppServerPeer` 中实现环境、external agent config 和 feedback method 的确定性 mock 响应
- [x] 3.3 在 `MockAppServerPeer` 中实现 marketplace、plugin installed 和 plugin share method 的确定性 mock 响应
- [x] 3.4 在 `MockAppServerPeer` 中实现 MCP tool call 的成功和错误 mock 响应
- [x] 3.5 在 `MockAppServerPeer` 中实现 realtime session 状态、voice 列表、append 输入和 stop 行为
- [x] 3.6 扩展 `src/server/app-server/events.ts`，归一化 realtime notification 和 external agent config import completion notification
- [x] 3.7 补充事件流测试，确认新增 notification 会通过 `/ws` 的 `codex-event` 形态下发

## 4. HTTP API、认证与审计

- [x] 4.1 新增环境和 external agent config API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.2 新增 feedback upload API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.3 新增 marketplace add/remove/upgrade API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.4 新增 plugin installed 与 plugin share save/updateTargets/list/checkout/delete API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.5 新增 MCP tool call API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.6 新增 thread realtime start/appendAudio/appendText/appendSpeech/stop/listVoices API route，执行 session 认证、请求体校验、audit 和 gateway 调用
- [x] 4.7 确认所有新增 route 的失败响应沿用 `{ ok: false, error }`，成功响应沿用 `{ ok: true, ... }`

## 5. 文档、覆盖率与验证

- [x] 5.1 更新 `docs/backend-api.md`，用中文补充新增 API 的路径、用途、关键请求体和响应形状
- [x] 5.2 移除或缩小 `tests/unit/protocol-coverage.test.ts` 中针对本次 20 个 method 的临时排除规则
- [x] 5.3 运行并修复 `npm run typecheck`
- [x] 5.4 运行并修复 `npm run test`
- [x] 5.5 运行 `openspec status --change "implement-remaining-appserver-protocols"`，确认 OpenSpec 任务账本可被 apply 阶段读取
