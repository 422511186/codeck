## Why

移动端 Web 已能接收 app-server 的 `item/tool/requestUserInput`，但实际交互中 question 被当成普通审批处理：前端只发送 `{decision: "approve"}`，app-server 需要的却是 `{answers: ...}`，导致 `failed to deserialize ToolRequestUserInputResponse: missing field answers`。第一次 resolve 失败后 pending request 又被删除，用户再次点击会看到“找不到待处理请求”，提问流程卡死。

同时，Build/Default 模式下普通澄清问题不应该暴露 `request_user_input is unavailable in Default mode` 这类内部工具错误；移动端应把 Plan 专用结构化提问和普通文字提问区分清楚，让用户能理解并完成交互。

## What Changes

- question pending request SHALL 渲染为适合提问的内嵌卡片，显示问题文本、选项描述，并让用户直接选择具体选项，而不是只有「同意 / 拒绝」。
- 前端 resolve question SHALL 发送被选中的 option value，由后端按 request kind 构造 app-server 需要的 `{answers: {[questionId]: {answers: [value]}}}`。
- 后端 resolve SHALL 只在 `peer.respondToServerRequest` 成功后删除 pending request；如果 app-server 拒绝响应或网络失败，pending request MUST 保留以便用户重试。
- question 的 option 解析 SHALL 同时兼容 `id`、`label` 和缺省 id 的选项；空选项时 SHALL 提供清晰的不可操作状态或文本回复路径，而不是提交无效 response。
- Build/Default 模式下 agent 的普通澄清提问 SHALL 作为普通 assistant 文本显示；如果 app-server 返回 `request_user_input is unavailable in Default mode`，Web UI MUST 不把它当成需要 resolve 的 pending question。
- 补充单元测试和浏览器验证，覆盖 Plan question 卡片展示、选择后 response 结构、resolve 失败重试、以及 Build 普通问句不出现 pending 卡片。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `approval-inline-cards`: 明确 `question` 卡片必须渲染选项并提交用户选择，不再复用普通审批的 approve/deny 双按钮。
- `audit-and-security`: 明确 server request resolve 的响应构造、失败保留 pending request、以及 question response 的准确 JSON 形状。

## Impact

- 影响 `src/web/components/cards/ApprovalCard.tsx` 的 question 渲染与交互。
- 影响 `src/web/components/Timeline.tsx` 和 `src/app/threads/[threadId]/page.tsx` 中 resolve 回调的参数语义。
- 影响 `src/web/api/endpoints.ts` 的 `resolveRequest` 调用约定，或新增更语义化的 response builder。
- 影响 `src/server/app-server/pending-requests.ts` 的 `questionOptions`、`questionId`、`buildPendingServerRequestResponse` 行为。
- 影响 `src/server/app-server/runtime.ts` 的 `resolveServerRequest` 删除 pending request 的时机。
- 需要补充 `pending-requests.test.ts`、`app-server-runtime.test.ts`、`web-approval-card.test.tsx` 或 `web-thread-page.test.tsx` 覆盖。
