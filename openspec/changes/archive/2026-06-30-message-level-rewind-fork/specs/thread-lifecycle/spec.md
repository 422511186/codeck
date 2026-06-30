## MODIFIED Requirements

### Requirement: Thread read
系统 SHALL 支持通过 threadId 读取会话详情，包含 timeline（用户消息、agent 消息、命令执行等）和 goal 信息。系统 MUST 将尚未 materialized 的空 thread 视为可读取会话，返回空 timeline，而不是把 app-server 的 `includeTurns` 限制暴露给用户。为了支持消息级时间线操作，timeline item MUST 携带足够的 turn 元数据，使前端能够识别 item 所属 turn。

#### Scenario: Read thread detail
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且目标 thread 已有可读取 turns
- **THEN** 调用 `gateway.readThread(threadId)`，返回包含 `timeline` 和 `goal` 的详情
- **AND** 每个由 turn 展开的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识

#### Scenario: Read unmaterialized empty thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且 app-server 对 `thread/read` 的 `includeTurns: true` 返回未 materialized 错误
- **THEN** 系统 SHALL 降级读取 thread metadata，返回 `{ok: true, thread}`，其中 `thread.timeline` 为空数组、`thread.lastTurnId` 为 `null`
- **AND** 响应 MUST 保持现有 `ThreadDetail` 形状，使前端可以显示空会话并发送第一条用户消息

### Requirement: Thread resume with latest turns
系统 SHALL 支持恢复已存在的会话，默认获取最近 30 条 turns（倒序）。恢复结果中的 timeline item MUST 保留所属 turn 元数据，以支持历史消息级操作。

#### Scenario: Resume thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/resume`
- **THEN** 调用 `gateway.resumeThread(threadId)`，返回会话详情
- **AND** 返回的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识

### Requirement: Thread fork
系统 SHALL 支持从现有会话分叉新会话。Fork 本身 SHALL 创建完整分支；消息级 Fork 若需要从历史 user message 分支，客户端或 Web API 层 MUST 在新 thread 上继续执行 rollback，使新 thread 截断到目标 user message 所属 turn 之前。

#### Scenario: Fork thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/fork`
- **THEN** 调用 `gateway.forkThread(threadId)`，返回分叉后的新会话详情

#### Scenario: Fork then rollback for message action
- **WHEN** 用户通过消息级「从这里 Fork」指定历史 user message
- **THEN** 系统 MUST 先创建新 thread
- **AND** MUST 在新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST NOT 修改原 thread history

### Requirement: Thread rollback
系统 SHALL 支持回滚会话指定数量的 turns。rollback 返回的会话详情 SHALL 表示回滚后的 thread history，前端用于消息级回滚时 MUST 用该详情替换本地 timeline。

#### Scenario: Rollback thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/rollback` 并提供 `numTurns`
- **THEN** 调用 `gateway.rollbackThread(threadId, numTurns)`，返回回滚后的会话详情

#### Scenario: Rollback response replaces client timeline
- **WHEN** 前端为了消息级「回滚到这里」调用 rollback 且请求成功
- **THEN** 前端 MUST 使用返回的会话详情替换当前 thread timeline
- **AND** MUST NOT 使用保留旧尾部条目的 merge 策略

#### Scenario: Rollback only changes history
- **WHEN** 系统执行 thread rollback
- **THEN** rollback MUST 只修改 thread history
- **AND** MUST NOT 自动还原 agent 已经写入本地工作区的文件变更
