## ADDED Requirements

### Requirement: Event stream listener gaps do not drop timeline events
浏览器 timeline event stream 客户端 SHALL 在底层 SSE 连接仍打开但当前没有页面 listener 时保护已收到的可见 timeline event。系统 MUST NOT 让浏览器已经消费的 `codex-event` 因 React effect 订阅切换、路由切换或 provider cleanup/re-subscribe 空窗而静默丢失。

#### Scenario: Event arrives while no listener is registered
- **WHEN** 底层 `EventSource` 已连接
- **AND** 当前没有任何 store listener 订阅 event stream
- **AND** 服务端发送 `agent_message_delta`、`reasoning_delta`、`tool_output_delta` 或其他可见 timeline event
- **THEN** 客户端 MUST 缓存该 event 或触发等价 gap repair
- **AND** 新 listener 注册后 MUST 应用该 event 或执行能恢复该 event 的 snapshot repair

#### Scenario: Listener buffer overflows
- **WHEN** 无 listener 期间收到的事件超过客户端可安全缓存的窗口
- **THEN** 客户端 MUST 触发 `timeline-gap` 或等价 repair 信号
- **AND** MUST NOT 将已消费但未投递的事件直接丢弃为已处理状态

### Requirement: Timeline gaps are repaired for the owning thread
服务端发送 `timeline-gap` 时 SHOULD 携带缺口所属 `threadId`。客户端收到 gap 后 MUST 只对可确定归属的 thread 执行 snapshot repair；如果无法确定 thread，客户端 MUST NOT 默认使用当前 active thread 执行破坏性 replace。

#### Scenario: Gap event includes thread id
- **WHEN** SSE endpoint 因 `Last-Event-ID` 不可恢复而发送 `timeline-gap`
- **AND** 服务端能从事件或 cursor 识别缺口所属 thread
- **THEN** gap payload MUST 包含该 `threadId`
- **AND** 客户端 MUST 为该 thread 请求 snapshot repair

#### Scenario: Gap event has unknown owner
- **WHEN** 客户端收到没有 `threadId` 且无法可靠解析归属的 `timeline-gap`
- **THEN** 客户端 MUST NOT 用 active thread 作为默认 repair 目标
- **AND** MUST 采取非破坏性降级策略，例如等待下一次可归属事件、提示连接异常或执行不覆盖具体 thread 的全局恢复

### Requirement: Timeline idempotency is scoped to history generation
客户端 SHALL 将 item revision、snapshot delta suppression 等用于忽略旧输出的状态绑定到 timeline generation 或等价历史标识。旧 generation 的 revision/suppression MUST NOT 抑制 rollback/fork 后新 generation 中同 item id 的合法输出。

#### Scenario: Reused item id after rollback
- **WHEN** thread rollback 后 generation 增加
- **AND** 新历史产生与旧历史相同 `itemId` 的 `agent_message_delta`、`reasoning_delta` 或 `tool_output_delta`
- **THEN** 客户端 MUST 按新 generation 独立判断 revision 是否 stale
- **AND** MUST NOT 因旧 generation 中更高 revision 而丢弃新 delta

#### Scenario: Snapshot suppression belongs to snapshot generation
- **WHEN** snapshot repair 记录了某 item 的 snapshot-covered 文本
- **AND** 后续收到同 item id 但属于更高 generation 或超出 snapshot sequence 覆盖范围的 delta
- **THEN** 客户端 MUST 移除旧 suppression 并保留该新 delta
- **AND** MUST 继续忽略同 generation 中确认为 snapshot 已覆盖的旧 delta

### Requirement: Rollback deleted-turn barriers are server-validated
服务端 SHALL 校验 rollback 后进入 deleted-turn barrier 的 turn id。客户端传入的 `expectedDeletedTurnIds` 只能作为提示；服务端 MUST NOT 因未经验证的客户端输入屏蔽仍属于当前 thread 历史的 turn。

#### Scenario: Expected deleted id still exists after rollback
- **WHEN** rollback 请求包含 `expectedDeletedTurnIds`
- **AND** 某个 id 在 rollback 后的 thread timeline 中仍然存在
- **THEN** 服务端 MUST NOT 将该 id 标记为 deleted turn
- **AND** 该 turn 后续合法事件 MUST NOT 被 deleted-turn barrier 屏蔽

#### Scenario: Expected live overlay turn is actually rolled back
- **WHEN** rollback 删除了一个尚未 materialized 到 snapshot 但已进入 overlay 或事件流的 live turn
- **AND** 客户端在 `expectedDeletedTurnIds` 中提供该 turn id
- **THEN** 服务端 MAY 将该 id 标记为 deleted turn
- **AND** 后续该 turn 的 late visible event MUST 被阻止进入当前 timeline
