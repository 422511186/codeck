# timeline-event-stream Specification

## Purpose
TBD - created by archiving change fix-timeline-stream-consistency. Update Purpose after archive.
## Requirements
### Requirement: Timeline event stream is the realtime source
系统 SHALL 提供面向浏览器的 timeline 增量事件流，用于传递运行中 thread 的 agent message、reasoning、tool、diff、system、error 和 turn lifecycle 事件。系统 SHALL 暴露 SSE endpoint 作为移动 Web 的 timeline event stream 主入口；若同时保留 WebSocket 作为兼容或内部通道，暴露给前端 store 的事件语义 MUST 与本规范一致。

#### Scenario: Running output arrives through event stream
- **WHEN** thread 处于 running 状态且 app-server 产生可见输出
- **THEN** 浏览器 MUST 通过 timeline event stream 收到对应增量事件
- **AND** 系统 MUST NOT 依赖高频 `readThread` polling 才能显示该输出

#### Scenario: HTTP controls remain separate
- **WHEN** 用户发送消息、审批请求、interrupt、rewind 或 fork
- **THEN** 客户端 MUST 继续使用对应 HTTP API 提交控制动作
- **AND** timeline event stream SHALL 只负责服务端到浏览器的状态和输出通知

#### Scenario: SSE endpoint is available
- **WHEN** 浏览器打开会话页并需要接收 running timeline 输出
- **THEN** 客户端 MUST 能连接服务端提供的 SSE timeline event endpoint
- **AND** 该 endpoint MUST 使用 `text/event-stream` 语义持续发送 timeline events

### Requirement: Timeline events carry stable identity and turn metadata
每个会影响 timeline 可见内容的事件 SHALL 携带稳定身份，至少包括 `eventId`、`kind` 以及可用于排序或幂等的 `seq`、`offset`、`revision` 或等价字段。属于某个 thread 的事件 MUST 携带 `threadId`。属于某个 turn 或 item 的事件 MUST 额外携带 `turnId` 和 `itemId`；非 turn-scoped 的 thread/global 事件 MUST 明确标记为不参与 rewind/fork turn 计数。

#### Scenario: Live event can be mapped to a turn
- **WHEN** 浏览器收到 agent、reasoning、tool、diff 或 item completion 事件
- **THEN** 生成或更新的 timeline entry MUST 保留该事件的 `turnId`
- **AND** 后续 rewind/fork 计算 MUST 能识别该 entry 所属 turn

#### Scenario: Thread-level event does not pollute turn counting
- **WHEN** 浏览器收到 warning、settings、connection 或其他没有自然 turn 的 thread/global event
- **THEN** 该事件 MUST 保留稳定 `eventId`
- **AND** 若渲染为 timeline entry，entry MUST 标记为不参与 rewind/fork 的 turn 距离计算
- **AND** 系统 MUST NOT 为了满足 turn 元数据要求伪造会污染历史操作的 `turnId`

#### Scenario: Duplicate event is ignored
- **WHEN** 浏览器因重连、补发或双通道竞态重复收到同一 `eventId`
- **THEN** 前端 MUST 忽略重复事件
- **AND** MUST NOT 再次追加相同文本 delta

#### Scenario: Snapshot-covered delta is not appended again
- **WHEN** 前端已经通过 snapshot 或 item completion 拥有某 item 的完整文本
- **AND** 之后收到较旧的 delta 事件
- **THEN** 前端 MUST 根据事件顺序或 revision 忽略该 delta
- **AND** MUST NOT 产生重复输出

### Requirement: Event stream supports reconnect and repair
timeline event stream SHALL 支持断线重连。客户端可使用 `Last-Event-ID` 或等价游标请求补发；若补发范围不可用，系统 MUST 明确触发 snapshot repair。

#### Scenario: Reconnect with recoverable cursor
- **WHEN** 事件流断开后浏览器携带最后处理的 event id 重连
- **THEN** 服务端 MUST 补发该 id 之后仍在缓存窗口内的事件
- **AND** 前端 MUST 按幂等规则应用补发事件

#### Scenario: Reconnect gap requires snapshot repair
- **WHEN** 服务端无法根据客户端游标补齐缺失事件
- **THEN** 客户端 MUST 执行一次 `readThread` 或等价 snapshot repair
- **AND** repair 结果 MUST replace 当前 thread timeline，而不是保留未知旧尾部

### Requirement: Deleted turn events are ignored after rewind or fork rollback
当 thread rollback、message rewind 或 fork rollback 删除某些 turns 后，服务端和前端 SHALL 阻止这些 turns 的 overlay 或 late event 再次进入 timeline。

#### Scenario: Late event for deleted turn
- **WHEN** rollback 成功后又收到属于已删除 turn 的 agent/reasoning/tool delta
- **THEN** 服务端 MUST 不把该事件写入当前 thread overlay
- **AND** 前端 MUST 忽略该事件
- **AND** timeline MUST NOT 重新显示被 rewind 的旧内容

#### Scenario: Event stream revision advances after rollback
- **WHEN** thread rollback 或 fork rollback 成功
- **THEN** 后续事件 MUST 携带可区分新历史的 revision、generation 或等价标识
- **AND** 客户端 MUST 用该标识拒绝旧历史中的 late event

### Requirement: Timeline events carry history generation
timeline event stream SHALL 为每个会影响可见 timeline 的事件携带当前 thread history generation。rollback、message rewind、fork rollback 或 snapshot repair 确认历史被替换后，服务端 SHALL 推进对应 thread 的 generation；客户端 MUST 记录当前 generation 并拒绝低于当前 generation 的可见事件。

#### Scenario: Late event from previous generation is ignored
- **WHEN** thread rollback 成功并推进 generation
- **AND** 浏览器之后收到旧 generation 的 agent、reasoning、tool、diff 或 item completion 事件
- **THEN** 前端 MUST 忽略该事件
- **AND** timeline MUST NOT 重新显示已删除尾部内容

#### Scenario: New generation event is accepted
- **WHEN** rollback 后用户重新发送消息并产生新 generation 的事件
- **THEN** 前端 MUST 接受新 generation 事件
- **AND** 新输出 MUST 追加到 rollback 后的 timeline

### Requirement: Event replay is idempotent after snapshot repair
timeline event stream replay、浏览器自动重连补发和 snapshot repair SHALL 使用同一幂等规则。客户端已经通过 snapshot 拥有的文本或 item completion MUST NOT 被后续旧 delta 再次追加；无法证明 delta 是新尾部时，客户端 MUST 忽略该 delta 或触发新的 snapshot repair。

#### Scenario: Replayed middle delta is ignored
- **WHEN** snapshot repair 已把 item 文本替换为 `hello world`
- **AND** 后续补发 delta 为 `world`
- **THEN** 前端 MUST NOT 把文本变成 `hello worldworld`
- **AND** 该 delta MUST 被视为已被 snapshot 覆盖

#### Scenario: New tail delta is appended
- **WHEN** snapshot repair 已把 item 文本替换为 `hello world`
- **AND** 后续收到同一 item 的新 generation 或可证明 offset 在末尾之后的 delta `!`
- **THEN** 前端 MUST 把文本更新为 `hello world!`

### Requirement: Event backlog honors rollback barriers
服务端事件 backlog SHALL 遵守 rollback/fork 后的 history generation 和 deleted turn 屏障。SSE 补发时 MUST NOT 补发会在当前 thread 历史中重新显示已删除 tail 的旧可见事件；若无法筛除，服务端 MUST 发送 `timeline-gap` 让客户端执行 snapshot repair。

#### Scenario: Backlog contains deleted turn events
- **WHEN** 客户端携带旧 `Last-Event-ID` 重连
- **AND** backlog 窗口中包含已被 rollback 删除 turn 的可见事件
- **THEN** 服务端 MUST 不补发这些可见事件
- **AND** 若补发范围无法可靠过滤，MUST 发送 `timeline-gap`

### Requirement: Reconnect repair is only triggered by confirmed gaps
timeline event stream 客户端 SHALL 区分普通连接错误和确认不可恢复的事件缺口。浏览器 `EventSource error` 本身 MUST NOT 直接触发 snapshot repair；只有服务端明确发送 `timeline-gap`、或客户端检测到无法通过补发恢复的缺口时，客户端 SHALL 执行 `readThread` repair。

#### Scenario: EventSource error waits for replay
- **WHEN** 浏览器 SSE 连接触发 `error`
- **THEN** 客户端 MUST 标记连接为 reconnecting
- **AND** 客户端 MUST NOT 立即为当前 active thread 请求 snapshot repair

#### Scenario: Server reports timeline gap
- **WHEN** SSE endpoint 因 `Last-Event-ID` 超出 backlog 或无法可靠过滤旧事件而发送 `timeline-gap`
- **THEN** 客户端 MUST 为对应 thread 执行一次 snapshot repair
- **AND** repair 结果 MUST replace 当前 thread 的未知尾部

### Requirement: Rollback barriers cover live overlay turns
thread rollback、message rewind 或 fork rollback 成功后，服务端和前端 SHALL 屏蔽 rollback 前目标 tail 中的所有 turn，包括尚未 materialized 到 `thread/read` snapshot、但已进入 overlay 或 event stream 的 live turn。

#### Scenario: Live turn is rewound before snapshot materializes
- **WHEN** 用户发送消息后收到该 turn 的 live reasoning、tool 或 agent delta
- **AND** 该 turn 尚未出现在 rollback 前的 `thread/read` snapshot
- **AND** 用户 rewind 删除该 turn
- **THEN** 服务端 MUST 清理该 turn 的 overlay 和 backlog 可见事件
- **AND** 后续该 turn 的 late event MUST NOT 重新显示在 timeline

### Requirement: Event id idempotency survives repair
客户端 SHALL 在 snapshot repair、generation bump 或 timeline replace 后保留足够的近期事件幂等信息。已处理过的同一 `eventId` 在同一可恢复窗口内 MUST NOT 因 replace repair 而再次追加可见内容。

#### Scenario: Processed event replays after repair
- **WHEN** 客户端已经处理某个 `agent_message_delta` eventId
- **AND** snapshot repair replace 了当前 thread timeline
- **AND** SSE 自动重连再次补发同一 eventId
- **THEN** 客户端 MUST 忽略该重复事件
- **AND** MUST NOT 再次追加相同文本 delta

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

### Requirement: Equivalent live and completed items render once
timeline event stream 客户端 SHALL 将同一 turn 内等价的 live delta entry、item completion entry 和 snapshot repair entry 合并为单一可见 timeline entry。系统 MUST NOT 因 item id 不同而把同一 turn 的同一 agent/reasoning/tool 输出显示两次。

#### Scenario: Completion follows live delta with different item id
- **WHEN** 客户端已通过 live delta 显示某 turn 的 agent message 或 reasoning 文本
- **AND** 后续收到同 turn、同类型、文本等价但 `itemId` 不同的 `item_updated`
- **THEN** timeline MUST 合并为一条 entry
- **AND** MUST 保留更完整的文本和 turn metadata

#### Scenario: Snapshot repair follows live delta
- **WHEN** snapshot repair 返回某 turn 的完整 agent/reasoning/tool item
- **AND** 当前 timeline 已有同 turn 等价 live entry
- **THEN** repair MUST 替换或合并该 live entry
- **AND** MUST NOT 追加第二条相同输出

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

### Requirement: Skills notifications are normalized for browser consumption
timeline event stream SHALL normalize app-server Skills 加载、变更或失效通知为浏览器可消费事件。该事件 SHALL 至少能驱动 Skills picker 缓存失效；当事件具备可靠 thread/turn 归属且代表用户可见 agent 工作时，timeline SHALL 能将其显示为轻量 activity。

#### Scenario: Skills notification invalidates browser cache
- **WHEN** app-server 发送 Skills 加载、变更、启用状态变化或 roots 变化通知
- **THEN** 浏览器 MUST 收到可识别的 Skills 失效事件或带 Skills scope 的 settings invalidation 事件
- **AND** 前端 MUST 使后续 Skills picker 打开时重新读取 Skills 列表

#### Scenario: Thread-scoped Skills activity is visible
- **WHEN** Skills 通知包含可靠的 `threadId` 或 `turnId`
- **AND** 该通知表示当前 turn 中 agent/runtime 加载或使用了 Skills
- **THEN** timeline MUST 能显示 `Skills loaded` 或等价轻量 activity
- **AND** activity MUST 显示 Skill 名称列表或数量中可用的信息

#### Scenario: Ownerless Skills notification is not misattributed
- **WHEN** Skills 通知没有可靠的 thread 归属
- **THEN** 前端 MUST NOT 默认把该事件追加到当前 active thread
- **AND** 前端 MUST 仍执行 Skills picker 缓存失效或 settings 刷新

### Requirement: Activity-related events preserve stream identity
所有会影响 timeline 可见 activity 的 Skills、tool、command、diff、reasoning 或 raw response 事件 SHALL 携带或获得稳定的浏览器事件身份。客户端 SHALL 对这些事件应用与现有 timeline delta 相同的去重、generation、revision 和 snapshot repair 规则。

#### Scenario: Duplicate Skills activity is ignored
- **WHEN** 浏览器因重连、补发或双通道竞态重复收到同一 Skills activity event
- **THEN** timeline MUST 只显示一次对应 Skills activity
- **AND** Skills picker 缓存失效 MUST 不导致重复 UI 插入

#### Scenario: Skills activity respects generation
- **WHEN** thread rollback、message rewind 或 snapshot repair 后 generation 已推进
- **AND** 浏览器收到旧 generation 的 Skills activity event
- **THEN** 前端 MUST 忽略该可见 activity
- **AND** timeline MUST NOT 重新显示已删除历史中的 Skills 加载活动

#### Scenario: Reconnect preserves activity grouping
- **WHEN** timeline event stream 断线后补发 command、tool、reasoning、diff 或 Skills activity events
- **THEN** 前端 MUST 按原始 event identity 去重
- **AND** activity block MUST 不因为补发而重复显示同一摘要行或重复累加数量

### Requirement: Sent turn output appears without manual refresh
移动端 timeline SHALL 在用户发送消息并成功启动 turn 后，自动显示该 turn 的 agent 回复、工具活动和完成状态。即使 `POST /api/codex/turns/start` 只返回 `turnId`，客户端也 MUST 通过实时事件或 snapshot repair/read-thread 兜底让可见 timeline 与真实 thread history 收敛，不能要求用户手动刷新页面。

#### Scenario: Started turn receives live visible events
- **WHEN** 用户发送消息
- **AND** `POST /api/codex/turns/start` 成功返回 `turnId`
- **AND** app-server 随后发送 agent message、tool、raw response 或 turn progress 相关通知
- **THEN** 浏览器 MUST 将这些通知归一化为当前 thread 的可见 timeline entries 或 activity entries
- **AND** 用户 MUST 能在不刷新页面的情况下看到 agent 回复或活动进展

#### Scenario: Turn completion without visible server entries triggers repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中没有任何可见的 agent message、tool、raw response 或 activity entry
- **THEN** 前端 MUST 触发 snapshot repair 或重新读取 thread history
- **AND** repair 后 MUST 将 thread history 中属于该 turn 的回复和活动合并到 timeline

#### Scenario: Missing live item event is repaired from history
- **WHEN** `startTurn` 已成功
- **AND** 实时流没有送达可见 item/raw response 事件
- **AND** 重新读取 thread history 后发现该 turn 已产生 agent 回复
- **THEN** 前端 MUST 合并该回复
- **AND** timeline MUST 从“需要刷新才可见”的状态恢复为当前页面可见

#### Scenario: Repaired entries do not duplicate delayed live events
- **WHEN** snapshot repair 已把某个 turn 的 agent 回复或活动合并进 timeline
- **AND** 后续又收到同一内容对应的延迟 live event 或重连补发 event
- **THEN** 前端 MUST 根据 event identity、thread item id、turn id、generation 或 revision 去重
- **AND** timeline MUST NOT 显示重复的 agent 回复、activity 摘要或完成状态

### Requirement: Runtime activity events are semantically classified
timeline event stream SHALL preserve enough structured semantics for runtime activity rendering. Browser-visible historical items and realtime notifications that represent tool loading, Skill reading, file reads, directory listing, search, command execution, file changes, MCP/dynamic tools, web/image operations, public reasoning, and raw response tool calls MUST be classified so the mobile timeline can render Codex App style inline activity logs.

#### Scenario: Loaded tools activity has runtime scope
- **WHEN** app-server history or live notifications contain a turn-scoped activity representing loaded tools, loaded Skill instruction files, or equivalent runtime tool preparation
- **THEN** browser events or timeline items MUST preserve the `threadId`, `turnId`, stable item identity, loaded count, and known tool or Skill names
- **AND** the mobile timeline MUST be able to render a `Loaded N tools` inline activity log without relying on ownerless cache invalidation events

#### Scenario: Read search command activity keeps action kind
- **WHEN** app-server history or live notifications contain read, list, search, grep, shell, bash, process, MCP or dynamic tool activity
- **THEN** browser-visible events MUST preserve or derive an action kind suitable for `Read files`、`Searched files`、`Ran commands` 或等价摘要
- **AND** full output and low-priority metadata MUST remain available for expanded details when provided

#### Scenario: Unknown runtime activity falls back readably
- **WHEN** app-server emits a newer runtime activity variant not yet fully recognized by the Web adapter
- **THEN** timeline event stream MUST expose a readable fallback with type, name, status and available text
- **AND** the fallback MUST remain eligible for inline activity rendering instead of being silently dropped

### Requirement: Skills cache invalidation is not runtime activity
ownerless Skills change notifications SHALL be treated as cache invalidation, not as visible timeline runtime activity. A Skills-related event MAY become visible only when it has reliable `threadId`/`turnId` ownership and represents work performed during a turn, such as runtime Skill/tool loading or reading.

#### Scenario: Ownerless skills changed event only invalidates cache
- **WHEN** app-server sends `skills/changed` without reliable thread or turn ownership
- **THEN** browser state MUST invalidate the Skills picker cache
- **AND** timeline MUST NOT append `Loaded tools`、`Skills loaded` 或任何 visible activity to the active thread

#### Scenario: Thread scoped runtime skill loading is visible
- **WHEN** app-server sends or history returns a Skills/tool loading event with reliable `threadId` and `turnId`
- **AND** the event represents runtime work performed for that turn
- **THEN** timeline MUST render it as an inline activity log
- **AND** the log MUST include known Skill/tool names or a count

#### Scenario: Ambiguous skills event is conservative
- **WHEN** a Skills-related event contains names but does not prove it belongs to the active turn
- **THEN** browser state MUST treat it as cache invalidation only
- **AND** MUST NOT infer ownership from the currently open page

### Requirement: Inline activity ordering preserves event order
timeline event stream and browser store SHALL preserve the relative order between assistant messages and runtime activity entries within the same turn. Sorting, repair, completion merging, or equivalent-output merging MUST NOT reorder activity entries ahead of assistant messages solely because of role or kind.

#### Scenario: Activity remains between assistant messages
- **WHEN** live events or repaired history arrive in the order assistant A, command activity, assistant B, file change activity, assistant C
- **THEN** browser timeline MUST preserve that order
- **AND** inline activity logs MUST render between the corresponding assistant messages

#### Scenario: Snapshot repair does not bucket activities
- **WHEN** snapshot repair merges main timeline entries with turn item details
- **THEN** repair MUST use the most precise available item order as the skeleton
- **AND** MUST NOT group all tool/diff/reasoning entries before all assistant messages in the same turn

#### Scenario: Equivalent item merge keeps position
- **WHEN** a live delta entry and a later completed item are equivalent
- **THEN** browser store MUST merge them without moving the visible entry across unrelated assistant or activity entries
- **AND** the resulting inline activity log order MUST remain stable

### Requirement: Inline activity event identity is deduplicated
All events that can produce inline activity logs SHALL participate in the same event id, generation, revision, snapshot suppression and equivalent-output deduplication model as agent messages and reasoning. Reconnect, live completion, and snapshot repair MUST NOT duplicate visible inline activity rows or inflate activity counts.

#### Scenario: Duplicate loaded tools event is ignored
- **WHEN** browser receives the same turn-scoped loaded tools event twice due to reconnect or dual channel delivery
- **THEN** timeline MUST render one inline activity log row for that event
- **AND** loaded count and visible detail rows MUST NOT be doubled

#### Scenario: Repair and delayed live activity render once
- **WHEN** snapshot repair inserts a command/read/file activity
- **AND** a delayed live event for the same item arrives later
- **THEN** browser store MUST merge or ignore the delayed event
- **AND** inline activity logs MUST NOT show duplicate command, read or file change rows

#### Scenario: Old generation activity is rejected
- **WHEN** rollback、rewind 或 fork 后 timeline generation 已推进
- **AND** browser receives an inline-activity-producing event from an older generation
- **THEN** browser store MUST ignore that visible activity event
- **AND** timeline MUST NOT reintroduce deleted turn activity

### Requirement: App-server JSON-RPC pending requests fail on disconnect
app-server WebSocket 连接在 JSON-RPC 请求发出后关闭或报错时，Web 端 SHALL 使所有未完成请求以错误结束。HTTP route MUST 能收到该错误并按代理失败路径返回。

#### Scenario: Socket closes before JSON-RPC response
- **WHEN** Web 已向 app-server 发送 JSON-RPC request
- **AND** WebSocket 在 response 到达前关闭
- **THEN** 对应 Promise MUST reject
- **AND** pending request MUST 从内存表中清除

### Requirement: Logout closes browser timeline event stream
用户登出 Web session 后，浏览器端 SHALL 关闭当前已认证的 timeline event stream。清除 cookie 后的旧 EventSource MUST NOT 继续接收或缓冲 timeline、审批或健康事件。

#### Scenario: Logout while SSE is connected
- **WHEN** 用户点击「登出 Web」且 `/api/codex/events` EventSource 仍打开
- **THEN** 客户端 MUST close 该 EventSource
- **AND** 后续重新进入业务页时 MUST 使用新的 session 状态建立连接

### Requirement: Server request resolved notifications reach the browser store
Web runtime SHALL 处理 app-server `serverRequest/resolved` notification，并向浏览器事件流发送 `server-request-resolved`。前端 store SHALL 使用一致的 string request id 匹配 pending request。

#### Scenario: App-server resolves request externally
- **WHEN** app-server 发送 `serverRequest/resolved` notification
- **THEN** runtime MUST 删除对应 pending request
- **AND** MUST 向浏览器发送 `{type: "server-request-resolved", requestId}`

