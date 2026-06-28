## Context

移动端 Web 目前已经实现了 app-server `server-request` 的接收、内存 pending Map、WebSocket 推送、timeline 内嵌卡片和 `/api/codex/requests/{requestId}/resolve`。现有实现把 `item/tool/requestUserInput` 归一化为 `question`，但前端仍使用普通审批卡片的「拒绝 / 同意」双按钮，提交的是 `{decision: "approve" | "deny"}`。app-server 对 `request_user_input` 的响应 schema 要求顶层包含 `answers`，因此真实验证中出现 `failed to deserialize ToolRequestUserInputResponse: missing field answers`。

另一个连带问题是 `AppServerGateway.resolveServerRequest()` 调用 `peer.respondToServerRequest()` 后才删除 pending request，表面上顺序正确，但前端传错 response 时首次请求在 app-server 侧可能已消耗或清理请求，前端又会重复调用同一个 requestId，用户看到“找不到待处理请求”。本次设计需要让前端只提交有效 question answer，并让失败状态在 UI 上可理解、可重试。

相关约束：

- 项目只做移动端 Web，question 卡片必须适合手机触控。
- 不改变 app-server 协议；Web 只做适配。
- 不新增跨会话 inbox；仍在对应会话 timeline 内嵌处理。
- Build/Default 模式普通澄清问题应走普通 assistant 文本，不应通过 Plan 专用结构化 question 工具。
- 审计日志仍记录 `request.resolve`，但不扩大本次脱敏策略。

## Goals / Non-Goals

**Goals:**

- question pending request 在 timeline 中显示问题、选项和描述，用户能直接选择答案。
- question resolve 使用后端基于 request kind 构造出的 `{answers: ...}`，不再把 `approve/deny` 发给 app-server。
- resolve 失败时 UI 显示错误并恢复可操作；后端不要因为失败而错误广播 resolved。
- 进入会话或 WebSocket 重连后仍能拉取当前 thread 的未处理 question。
- Build/Default 下普通文字提问不被误判为需要 resolve 的 question；若 agent 自行说明工具不可用，前端只按普通 Markdown 显示。

**Non-Goals:**

- 不改变 Plan/Build collaboration mode 的整体协议。
- 不让 Build/Default 模式强行启用 `request_user_input` 工具。
- 不实现自由文本回答 question 的完整表单体系；本次优先支持 app-server 已发来的选项式问题。
- 不新增跨会话审批中心。
- 不重构所有审批卡片视觉风格。

## Decisions

### Decision 1: 让 question 卡片使用选项按钮，而不是 approve/deny 双按钮

`ApprovalCard` 需要按 `approval.kind` 分支渲染。`question` 使用 `approval.description` 作为主问题文本，使用 `approval.options` 渲染一组按钮。按钮 label 使用 option label，description 以小字展示；点击时把 option value 交给 resolve 回调。

选择这个方案的原因：

- 与 app-server `request_user_input` 语义一致，用户选择的是答案，不是同意某个审批。
- 后端已有 `buildPendingServerRequestResponse(request, value)` 能把 value 变成 `{answers: ...}`。
- 移动端交互清晰，避免用户不知道「同意」对应哪个选项。

备选方案：

- 保持「同意 / 拒绝」，在后端把 approve 映射到第一个选项。这个方案会误选，且无法表达多个选项。
- 增加弹窗选择。这个违反现有 timeline 内嵌卡片方向，也不适合当前移动端约束。

### Decision 2: resolve API 接受语义值，由后端统一构造响应

当前 `/api/codex/requests/{requestId}/resolve` 直接把 body.response 透传给 gateway。本次应保留兼容能力，但前端常规路径改为提交 `{value}` 或更语义化的选择值，然后后端通过 pending request 查找 kind 并调用 `buildPendingServerRequestResponse()`。如果 body 已提供完整 `response`，可以继续保留为低层逃生路径，但 UI 不再使用它。

选择这个方案的原因：

- response schema 属于 app-server 适配层知识，不应散落在 React 组件里。
- 命令、权限、MCP、dynamic tool 和 question 都已有统一 builder。
- 后续 app-server schema 变化时改服务端即可。

### Decision 3: resolve 成功后才删除 pending request 和广播 resolved

`resolveServerRequest` 的删除时机必须严格在 `peer.respondToServerRequest()` resolve 之后。如果 respond 抛错，pending Map 保留该 request，API 返回错误，前端卡片显示错误并恢复按钮。这样用户可以重试，或者刷新后重新拉取 pending request。

如果 app-server 本身在收到无效响应后已经消耗了 request，Web 侧无法恢复 app-server 状态；但只要前端不再发送无效 response，这条路径应只保留为网络/外部异常兜底。

### Decision 4: Build/Default 普通澄清问题不进入 pending request 机制

`request_user_input is unavailable in Default mode` 是 agent/tool 层错误，不是 Web pending request。Web 不应为这类文本创建卡片；它只应展示 agent 的普通 Markdown。真正需要卡片的是 app-server 发来的 `server-request` 事件。

这个决定也意味着：如果用户希望结构化选项问题，应切到 Plan；如果在 Build 中需要澄清，agent 应直接用自然语言发问。

## Risks / Trade-offs

- [Risk] app-server question options schema 可能有多题、多选、Other、secret 等扩展。→ Mitigation: 本次先支持当前单题选项式 schema；测试覆盖 id/label fallback，并在 UI 对空选项显示不可提交状态。
- [Risk] 低层 resolve API 同时支持 `response` 和 `value` 可能产生歧义。→ Mitigation: 明确优先级：有 `response` 时视为完整响应；否则使用 `value` 经 builder 构造。前端只走 `value`。
- [Risk] 失败后 pending 保留可能导致用户重复提交同一个已经被 app-server 消耗的 request。→ Mitigation: 如果 app-server 返回“找不到请求”类错误，前端显示错误；下一次 server-request-resolved 或 turn 完成时禁用卡片。
- [Risk] question 卡片选项过多导致手机屏幕拥挤。→ Mitigation: 按纵向按钮列表渲染，按钮文本允许换行，不使用横向挤压布局。

## Migration Plan

无需数据迁移。实现时先补 failing tests：question 卡片应提交选项值、resolve route 应把 value 转为 `{answers: ...}`、respond 失败时 pending 不删除。随后做最小实现并运行单元测试、类型检查和浏览器验证。

回滚时可恢复原 ApprovalCard 和 resolve route 行为，但会重新暴露 question 无法回答的问题。

## Open Questions

- 是否需要支持 question 的自由文本 Other 输入？当前先作为后续增强。
- 是否需要把 app-server “工具不可用”错误文案做前端专门提示？当前保持普通 Markdown 渲染，不做错误分类。
