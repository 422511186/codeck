## MODIFIED Requirements

### Requirement: Thread read
系统 SHALL 支持通过 threadId 读取会话详情，包含 timeline（用户消息、agent 消息、命令执行等）和 goal 信息。系统 MUST 将尚未 materialized 的空 thread 视为可读取会话，返回空 timeline，而不是把 app-server 的 `includeTurns` 限制暴露给用户。为了支持消息级时间线操作，timeline item MUST 携带足够的 turn 元数据，使前端能够识别 item 所属 turn。运行中 thread 的 `readThread` SHALL 作为初始化、显式刷新、事件流断线修复和 rollback/fork 返回详情的 snapshot API；客户端 MUST NOT 把它作为正常运行中输出的高频 polling 主路径。

#### Scenario: Read thread detail
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且目标 thread 已有可读取 turns
- **THEN** 调用 `gateway.readThread(threadId)`，返回包含 `timeline` 和 `goal` 的详情
- **AND** 每个由 turn 展开的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识
- **AND** 由 realtime overlay 补入或替换的 timeline item 也 MUST 保留所属 `turnId`

#### Scenario: Read unmaterialized empty thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且 app-server 对 `thread/read` 的 `includeTurns: true` 返回未 materialized 错误
- **THEN** 系统 SHALL 降级读取 thread metadata，返回 `{ok: true, thread}`，其中 `thread.timeline` 为空数组、`thread.lastTurnId` 为 `null`
- **AND** 响应 MUST 保持现有 `ThreadDetail` 形状，使前端可以显示空会话并发送第一条用户消息

#### Scenario: Read is not high-frequency running polling
- **WHEN** thread 处于 running 状态且 timeline event stream 可用
- **THEN** 客户端 MUST NOT 每隔固定短周期调用 `readThread` 获取完整 timeline
- **AND** `readThread` MAY 仅用于首屏 snapshot、手动刷新、事件流缺口修复或最终 reconcile

### Requirement: Thread rollback
系统 SHALL 支持回滚会话指定数量的 turns。rollback 返回的会话详情 SHALL 表示回滚后的 thread history，前端用于消息级回滚时 MUST 用该详情替换本地 timeline。rollback 成功后，系统 MUST 清理或失效被删除 turns 的 realtime overlay、事件缓存和 late event，使这些 turns 不会再次出现在当前 thread timeline。

#### Scenario: Rollback thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/rollback` 并提供 `numTurns`
- **THEN** 调用 `gateway.rollbackThread(threadId, numTurns)`，返回回滚后的会话详情
- **AND** 返回的 timeline MUST 不包含被删除 turns 的 overlay item

#### Scenario: Rollback response replaces client timeline
- **WHEN** 前端为了消息级「回滚到这里」调用 rollback 且请求成功
- **THEN** 前端 MUST 使用返回的会话详情替换当前 thread timeline
- **AND** MUST NOT 使用保留旧尾部条目的 merge 策略
- **AND** MUST NOT 使用 rollback 前本地 entries 切片作为 timeline fallback

#### Scenario: Rollback only changes history
- **WHEN** 系统执行 thread rollback
- **THEN** rollback MUST 只修改 thread history
- **AND** MUST NOT 自动还原 agent 已经写入本地工作区的文件变更

#### Scenario: Late events after rollback
- **WHEN** rollback 成功后收到属于已删除 turn 的 realtime 事件
- **THEN** 系统 MUST 忽略该事件或标记为过期
- **AND** 后续 `readThread` MUST NOT 通过 overlay 把该事件重新追加到 timeline

## ADDED Requirements

### Requirement: Turn start does not require immediate full thread read for streaming
系统 SHALL 支持启动 turn 后通过 timeline event stream 展示运行中输出。`turn/start` Web API MAY 返回轻量 `{turnId}` 或包含权威 thread detail，但客户端 MUST NOT 依赖该响应后的全量 `readThread` 作为实时输出主路径。

#### Scenario: Start turn returns before full timeline materialization
- **WHEN** 用户发送消息且 `turn/start` 成功
- **THEN** API MUST 返回可关联后续事件的 `turnId`
- **AND** 运行中 agent/reasoning/tool 输出 MUST 通过 timeline event stream 到达

#### Scenario: Start turn snapshot does not duplicate event stream
- **WHEN** `turn/start` 响应包含 thread detail
- **AND** 同一 turn 的 delta 也通过事件流到达
- **THEN** 前端 MUST 基于事件 identity、item revision 或等价机制去重
- **AND** MUST NOT 重复追加同一段输出文本
