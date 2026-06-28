## MODIFIED Requirements

### Requirement: Thread read
系统 SHALL 支持通过 threadId 读取会话详情，包含 timeline（用户消息、agent 消息、命令执行等）和 goal 信息。系统 MUST 将尚未 materialized 的空 thread 视为可读取会话，返回空 timeline，而不是把 app-server 的 `includeTurns` 限制暴露给用户。

#### Scenario: Read thread detail
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且目标 thread 已有可读取 turns
- **THEN** 调用 `gateway.readThread(threadId)`，返回包含 `timeline` 和 `goal` 的详情

#### Scenario: Read unmaterialized empty thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且 app-server 对 `thread/read` 的 `includeTurns: true` 返回未 materialized 错误
- **THEN** 系统 SHALL 降级读取 thread metadata，返回 `{ok: true, thread}`，其中 `thread.timeline` 为空数组、`thread.lastTurnId` 为 `null`
- **AND** 响应 MUST 保持现有 `ThreadDetail` 形状，使前端可以显示空会话并发送第一条用户消息
