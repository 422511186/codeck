## ADDED Requirements

### Requirement: 高频可见 delta 在 UI 更新前批处理
timeline event stream 客户端 SHALL 对同一 `threadId`、`turnId`、`itemId`、`kind` 和 history generation 的连续文本 delta 进行短窗口批处理，以减少可见 store 更新和 React render 次数。批处理 MUST NOT 丢失原始事件的 `eventId`、`revision`、`sequence` 或 `generation` 幂等语义。

#### Scenario: 同一 item 连续 delta 合并
- **WHEN** 客户端在一个短时间窗口内收到同一 agent item 的多个 `agent_message_delta`
- **THEN** timeline 可见文本 MAY 通过一次 store 更新追加合并后的文本
- **AND** 每个原始 `eventId` MUST 被记录为已处理

#### Scenario: Duplicate event inside batch
- **WHEN** 同一批次中出现重复 `eventId`
- **THEN** 重复事件 MUST 被忽略
- **AND** 合并后的文本 MUST NOT 包含重复 delta

#### Scenario: 不同 item 不互相合并
- **WHEN** 同一批次中包含不同 `itemId`、不同 `turnId` 或不同 generation 的 delta
- **THEN** 客户端 MUST 分别处理这些 delta
- **AND** MUST NOT 把不同 item 的文本拼接到同一 timeline entry

#### Scenario: 非文本控制事件不被延迟破坏语义
- **WHEN** 客户端收到 `timeline-gap`、`server-request`、turn lifecycle 或 settings 更新事件
- **THEN** 这些事件 MUST 按其交互语义及时处理
- **AND** MUST NOT 因文本 delta 批处理导致审批、repair 或 running 状态明显滞后

### Requirement: 批处理后的幂等规则与逐条处理一致
delta 批处理 SHALL 复用现有 duplicate suppression、snapshot delta suppression、deleted-turn barrier、stale revision 和 generation 判断。批处理只改变可见 UI commit 频率，MUST NOT 改变哪些事件被接受或拒绝。

#### Scenario: Snapshot-covered deltas in batch
- **WHEN** 一个批次包含已被 snapshot 覆盖的旧 delta 和一个新的尾部 delta
- **THEN** 客户端 MUST 忽略旧 delta
- **AND** MUST 只把可证明为新尾部的 delta 追加到 timeline

#### Scenario: Deleted turn delta in batch
- **WHEN** 一个批次包含属于已删除 turn 的可见 delta
- **THEN** 客户端 MUST 忽略该 delta
- **AND** MUST NOT 因批处理把已删除内容重新显示

### Requirement: Agent message delta 纳入服务端 timeline overlay
服务端 SHALL 将 `agent_message_delta` 聚合进 thread timeline overlay，与 reasoning、tool、file 和 diff live 输出保持一致。overlay 中的 agent 文本 SHALL 用于会话读取、resume 或 snapshot repair 的尾部窗口补全。

#### Scenario: Refresh during agent output
- **WHEN** 用户在 agent message 正在流式输出时刷新会话页
- **THEN** 服务端返回的有界 timeline snapshot MUST 包含当前已聚合的 agent message 文本
- **AND** 客户端 MUST NOT 只能依赖 SSE backlog 才能恢复当前 agent 正文

#### Scenario: Agent completion replaces overlay
- **WHEN** app-server 后续发送同一 turn 的 completed agent item
- **THEN** 服务端和前端 MUST 合并 overlay/live entry 与 completed item
- **AND** timeline MUST 只显示一条更完整的 agent message

### Requirement: Event backlog and listener buffer apply backpressure
timeline event stream 的服务端 backlog 和浏览器无 listener buffer SHALL 有明确上限。超过可恢复窗口时，系统 MUST 产生带 `threadId` 的 `timeline-gap` 或等价 repair 信号，而不是无限堆积事件或静默丢弃已消费事件。

#### Scenario: Browser listener buffer overflows with known thread
- **WHEN** 底层 EventSource 已消费某 thread 的大量可见事件但暂无 store listener
- **AND** 客户端 buffer 超过安全窗口
- **THEN** 客户端 MUST 产生归属于该 thread 的 `timeline-gap`
- **AND** 新 listener 注册后 MUST 执行该 thread 的 repair

#### Scenario: Server backlog cannot replay all deltas
- **WHEN** 客户端携带 `Last-Event-ID` 重连
- **AND** 服务端 backlog 已无法补齐该 id 之后的可见事件
- **THEN** 服务端 MUST 发送 `timeline-gap`
- **AND** gap payload SHOULD 包含缺口所属 `threadId`

### Requirement: Snapshot repair uses bounded timeline window
timeline event stream 触发的 snapshot repair SHALL 使用有界最新 timeline 窗口或等价尾部修复策略。repair MUST 保持 event id 幂等、generation barrier 和 snapshot delta suppression 行为，但 MUST NOT 默认导致长会话完整历史重新加载。

#### Scenario: Repair after recoverable UI batch
- **WHEN** 批处理期间发生可归属 timeline gap
- **THEN** 客户端 MUST flush 或丢弃对应 thread 的未提交批次
- **AND** 随后的 bounded repair MUST replace 未知尾部

#### Scenario: Repair keeps processed event ids
- **WHEN** bounded repair 完成后 SSE replay 再次发送 repair 前已处理的 `eventId`
- **THEN** 客户端 MUST 继续忽略重复事件
- **AND** MUST NOT 因 repair 缩小了 timeline 窗口而重复追加文本
