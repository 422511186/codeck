## MODIFIED Requirements

### Requirement: Thread compact
系统 SHALL 支持压缩空闲会话上下文，并拒绝压缩所有非空闲会话。

#### Scenario: Compact thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话处于 `idle` 状态
- **THEN** 调用 `gateway.compactThread(threadId)`，触发 `thread/compacted` 通知

#### Scenario: Reject active thread compact
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话处于运行状态
- **THEN** 系统 MUST 返回 `409`
- **AND** 系统 MUST 不调用 `gateway.compactThread(threadId)`

#### Scenario: Reject unloaded or errored thread compact
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话状态是 `notLoaded`、`systemError` 或其他非 `idle` 状态
- **THEN** 系统 MUST 返回 `409`
- **AND** 系统 MUST 不调用 `gateway.compactThread(threadId)`
