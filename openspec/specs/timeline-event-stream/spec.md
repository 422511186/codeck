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
每个会影响 timeline 可见内容的事件 SHALL 携带稳定身份，至少包括 `bootId`、`eventId`、`kind` 和进程内全局单调的 `streamSequence`。浏览器事件的幂等身份 MUST 使用 `{bootId, eventId}`；`streamSequence` MUST 只用于全局 backlog 定位和来源事件总顺序，MUST NOT 被解释为单 item fragment 的连续序号。可追加正文事件在能够证明 fragment 顺序时 SHALL 额外携带按 `{threadId, generation, turnId, itemId, field}` 隔离的 `fragmentSequence`。属于某个 thread 的事件 MUST 携带 `threadId` 和 history generation。属于某个 turn 或 item 的事件 MUST 额外携带 `turnId` 和 `itemId`；非 turn-scoped 的 thread/global 事件 MUST 明确标记为不参与 rewind/fork turn 计数。

#### Scenario: Live event can be mapped to a turn
- **WHEN** 浏览器收到 agent、reasoning、tool、diff 或 item completion 事件
- **THEN** 生成或更新的 timeline entry MUST 保留该事件的 `turnId`
- **AND** 后续 rewind/fork 计算 MUST 能识别该 entry 所属 turn

#### Scenario: Thread-level event does not pollute turn counting
- **WHEN** 浏览器收到 warning、settings、connection 或其他没有自然 turn 的 thread/global event
- **THEN** 该事件 MUST 保留稳定 `{bootId, eventId}`
- **AND** 若渲染为 timeline entry，entry MUST 标记为不参与 rewind/fork 的 turn 距离计算
- **AND** 系统 MUST NOT 为了满足 turn 元数据要求伪造会污染历史操作的 `turnId`

#### Scenario: Duplicate event is ignored
- **WHEN** 浏览器因重连、补发或双通道竞态重复收到相同 `{bootId, eventId}` 的事件
- **THEN** 前端 MUST 忽略重复事件
- **AND** MUST NOT 再次追加相同文本 delta

#### Scenario: Snapshot-covered delta is not appended again
- **WHEN** 前端已经通过同一 HistoryStamp 的 snapshot 或 item completion 拥有某 item 的完整文本
- **AND** 之后收到该 snapshot watermark 已覆盖的较旧 delta 事件
- **THEN** 前端 MUST 根据事件顺序、revision 或 fragmentSequence 忽略该 delta
- **AND** MUST NOT 产生重复输出

#### Scenario: Service restart creates a new event identity domain
- **WHEN** 服务端重启后 `streamSequence`、generation 或裸 `eventId` 的数值从较小值重新开始
- **THEN** 新事件 MUST 携带不同的 `bootId`
- **AND** 客户端 MUST 先为可见 thread 建立新 boot 的 bounded repair 基线，再接受新 HistoryStamp 的增量
- **AND** 客户端 MUST NOT 使用旧 boot 的 ledger 永久拒绝新事件

### Requirement: Event stream supports reconnect and repair
timeline event stream SHALL 支持断线重连。客户端可使用编码 `{bootId, streamSequence}` 的 `Last-Event-ID` 或等价全局游标请求补发；该游标定位所有 thread 共用的传输序列，MUST NOT 被解释为某个 item 的 fragmentSequence。服务端只有在 bootId 相同且 cursor 仍位于 backlog 可恢复窗口内时才能补发；若 payload 补发范围不可用但 owner ledger 可覆盖，系统 MUST 为 ledger 推导出的完整 thread 集合触发 bounded latest-page repair；若 bootId 已变化或 owner ledger 也不可覆盖，MUST 发送 `scope: all-tracked` barrier。

#### Scenario: Reconnect with recoverable cursor
- **WHEN** 事件流断开后浏览器携带同一 `bootId` 下最后处理的 stream cursor 重连
- **THEN** 服务端 MUST 按全局 `streamSequence` 补发该 cursor 之后仍在缓存窗口内的事件
- **AND** 前端 MUST 保持跨 thread 的原始传输顺序并按幂等规则应用补发事件

#### Scenario: Reconnect gap requires snapshot repair
- **WHEN** 服务端无法根据客户端游标补齐缺失事件
- **THEN** 客户端 MUST 对 gap signal 声明的每个 thread 执行一次 metadata 与 latest-page bounded repair
- **AND** repair 结果 MUST 只权威替换声明的未知最新尾部，而不是清空已加载的更旧分页历史

#### Scenario: Interleaved items do not create transport gaps
- **WHEN** 全局事件顺序为 item A fragment 1、item B fragment 1、item A fragment 2
- **THEN** stream cursor MUST 依次推进三个传输事件
- **AND** 客户端 MUST NOT 因 item A 两个事件的 `streamSequence` 不相邻而报告 fragment gap

#### Scenario: Cursor from a previous boot cannot be replayed
- **WHEN** 客户端使用旧 `bootId` 的 Last-Event-ID 连接到新启动的服务端
- **THEN** 服务端 MUST NOT 把新 boot 中碰巧相同的 `streamSequence` 或 `eventId` 当作旧 cursor 的延续
- **AND** MUST 返回带新 boot identity 的 `scope: all-tracked` gap/repair barrier

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
服务端事件 backlog SHALL 遵守 rollback/fork 后每个 thread 的 HistoryStamp 和 deleted turn 屏障，并维护覆盖 replay horizon 的 per-sequence owner ledger。SSE 补发时 MUST NOT 补发会在当前 thread 历史中重新显示已删除 tail 的旧可见事件；若无法筛除且 owner ledger 可覆盖，服务端 MUST 为完整受影响 thread 集合发送 scoped `timeline-gap`；owner ledger 不可覆盖时 MUST 发送 `scope: all-tracked` barrier。rollback、rewind 或 fork rollback 推进 generation 时，对应 barrier MUST 广播给所有相关订阅者，并在该 thread 的任何新 generation event 之前送达。

#### Scenario: Backlog contains deleted turn events
- **WHEN** 客户端携带旧 `Last-Event-ID` 重连
- **AND** backlog 窗口中包含已被 rollback 删除 turn 的可见事件
- **THEN** 服务端 MUST 不补发这些可见事件
- **AND** 若补发范围无法可靠过滤，MUST 为每个受影响 thread 发送 scoped `timeline-gap`

#### Scenario: One replay gap spans multiple threads
- **WHEN** 无法补发的全局 cursor 区间包含多个 thread 的可见事件
- **THEN** 服务端 MUST 保留完整受影响 thread 集合
- **AND** gap 信号 MUST NOT 只归属到区间内最后一个事件的 thread

#### Scenario: Rollback barrier precedes new history events
- **WHEN** rollback 推进某 thread 的 generation 且随后立即产生新输出
- **THEN** 所有相关订阅者 MUST 先收到该 thread 的新 HistoryStamp barrier
- **AND** backlog 与 live broadcast MUST NOT 让新 generation event 越过该 barrier

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
服务端发送 `timeline-gap` 时 SHALL 携带 owner ledger 推导出的完整 `affectedThreadIds`，或为每个已知 owner 发送独立的带 `threadId` gap。客户端收到 gap 后 MUST 对每个可确定归属的 thread 分别建立 delivery barrier 并执行 bounded repair。确认的 visible gap 无法确定完整 owner 时，服务端 MUST 发送 `scope: all-tracked`；客户端 MUST repair 本地 cached/visible thread 集合，而不是默认只使用当前 active thread。只有不影响 timeline 的 ownerless 控制事件 MAY 采用非破坏性等待。

#### Scenario: Gap event includes thread id
- **WHEN** SSE endpoint 因 `Last-Event-ID` 不可恢复而发送只影响一个 thread 的 `timeline-gap`
- **AND** 服务端能从事件或 cursor 识别缺口所属 thread
- **THEN** gap payload MUST 包含该 `threadId` 或只含该 thread 的 `affectedThreadIds`
- **AND** 客户端 MUST 为该 thread 请求 snapshot repair

#### Scenario: Gap event has multiple owners
- **WHEN** 一个不可恢复的全局 cursor 区间影响多个可确定的 thread
- **THEN** gap payload MUST 列出全部 `affectedThreadIds`，或服务端 MUST 发送等价的逐 thread signal
- **AND** 客户端 MUST 独立 repair 每个 owner，且 MUST NOT 用当前页面 thread 替代该集合

#### Scenario: Gap event has unknown owner
- **WHEN** payload backlog 和 owner ledger 都无法恢复一个确认影响 timeline 的 gap，或服务端 bootId 已改变
- **THEN** 服务端 MUST 发送 `scope: all-tracked` barrier
- **AND** 客户端 MUST 为本地 cached/visible threads 分别建立 bounded repair
- **AND** MUST NOT 只用 active thread 作为默认目标，也 MUST NOT 无限等待下一条可归属事件

#### Scenario: Ownerless non-visible control event is non-destructive
- **WHEN** 无法归属的缺失事件已证明不影响任何 timeline 可见内容
- **THEN** 客户端 MAY 保留连接异常状态并等待后续可归属事件
- **AND** MUST NOT 对 cached threads 执行破坏性 replace

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
timeline event stream 客户端 SHALL 将同一 logical item 的 live delta entry、item completion entry 和 snapshot repair entry 合并为单一可见 timeline entry。logical identity MUST 由相同 `{bootId, generation, turnId, itemId}`，或能唯一证明两条记录属于同一 source slot 的显式 synthetic alias/anchor 建立。系统 MUST NOT 仅因处于同一 turn、kind 相同、文本等价或一条文本包含另一条就合并不同稳定 itemId；无法证明 alias 唯一时 MUST 保留独立 entry 或触发 bounded repair。

#### Scenario: Completion follows live delta with the same identity
- **WHEN** 客户端已通过 live delta 显示某 turn 的 agent message 或 reasoning 文本
- **AND** 后续收到相同 HistoryStamp、turnId 和 itemId 的 `item_updated`
- **THEN** timeline MUST 原位合并为一条 entry
- **AND** MUST 保留更完整的文本和 turn metadata

#### Scenario: Completed item confirms an explicit synthetic alias
- **WHEN** live event 缺少原生 itemId，但已建立包含 source event identity 和 source slot 的 synthetic identity
- **AND** completed item 携带唯一指向该 synthetic identity 的 alias 或 anchor
- **THEN** timeline MAY 原位确认并完成该 entry
- **AND** MUST NOT 同时保留 synthetic 与 completed 两个版本

#### Scenario: Similar content with different stable item ids remains distinct
- **WHEN** 同一 turn 包含两个相同 kind、文本相同或互为前缀的 items
- **AND** 两个 items 拥有不同稳定 itemId
- **THEN** timeline MUST 保留两条独立 entries 及其事件位置
- **AND** MUST NOT 使用文本、metadata 或路径等价将其合并

#### Scenario: Snapshot repair follows live delta
- **WHEN** snapshot repair 返回某 turn 的完整 agent/reasoning/tool item
- **AND** 当前 timeline 已有相同强 identity 或显式唯一 alias 的 live entry
- **THEN** repair MUST 原位替换或补全该 live entry
- **AND** MUST NOT 追加第二条相同 logical output

### Requirement: 高频可见 delta 在 UI 更新前批处理
timeline event stream 客户端 SHALL 对同一 `threadId`、`turnId`、`itemId`、`kind` 和 history generation 的连续文本 delta 进行短窗口批处理，以减少可见 store 更新和 React render 次数。批处理 MUST NOT 丢失原始事件的 `eventId`、`revision`、`sequence` 或 `generation` 幂等语义；一个服务端 `codex-event-batch` 对同一 thread 的合法 timeline 输入 MUST 通过一次 engine batch 和至多一次可见 timeline store 提交完成。

#### Scenario: 同一 item 连续 delta 合并
- **WHEN** 客户端在一个短时间窗口内收到同一 agent item 的多个 `agent_message_delta`
- **THEN** timeline 可见文本 MUST 通过一次 store 更新追加合并后的文本
- **AND** 每个原始 `eventId` MUST 被记录为已处理

#### Scenario: Duplicate event inside batch
- **WHEN** 同一批次中出现重复 `eventId`
- **THEN** 重复事件 MUST 被忽略
- **AND** 合并后的文本 MUST NOT 包含重复 delta

#### Scenario: 不同 item 不互相合并
- **WHEN** 同一批次中包含不同 `itemId`、不同 `turnId` 或不同 generation 的 delta
- **THEN** 客户端 MUST 分别保留这些 item 的 identity 和顺序
- **AND** MUST NOT 把不同 item 的文本拼接到同一 timeline entry
- **AND** 同一 thread 的合法输入仍 MUST 能在一次 engine batch 中提交

#### Scenario: Interleaved items preserve source order
- **WHEN** 客户端按顺序收到 item A delta、item B delta、item A delta
- **THEN** 发给 store 和 engine 的 batch MUST 保持 A、B、A 的原始事件顺序
- **AND** 客户端 MUST NOT 因按 item key 分组而输出 A、A、B

#### Scenario: 非文本控制事件不被延迟破坏语义
- **WHEN** 客户端收到 `timeline-gap`、`server-request`、turn lifecycle、repair completion 或 rollback/fork barrier
- **THEN** 这些事件 MUST 按其交互语义及时处理
- **AND** pending 文本 delta MUST 在 barrier 前 flush 或在 barrier 后重新校验

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
timeline event stream 触发的 snapshot repair SHALL 使用带 HistoryStamp 和明确窗口边界的权威 latest page。服务端 MUST 先完成上游 bounded page 读取，再在不会与 gateway event delivery 交错的同步临界区内原子捕获当前最大 `pageWatermark` 与同一 HistoryStamp、`streamSequence <= pageWatermark` 的 `overlaySnapshot`，最后合并二者并返回 inclusive `windowStartAnchor`、inclusive `windowEndAnchor`、`preservedThrough`、pageWatermark、`nextCursor` 和 completeness。每个 normalized entry MUST 记录 coverage fence：live 使用 `lastAppliedStreamSequence`，snapshot/repair/supplement 使用 `baselineWatermark`，local/optimistic 使用 client mutation epoch 与 operation identity。客户端 MUST 以 `replace-latest-window` 语义只删除 orderKey 位于该闭区间内、stream/baseline fence 不大于 pageWatermark 且无法由权威 page/overlay 确认的 entry；当前 stamp 下无 fence 的 legacy snapshot/local placeholder按 pre-baseline 处理，除非它属于 unresolved optimistic operation 或明确的 post-request client mutation。watermark 之后到达的 live entry、窗口之前已加载的 history pages 和窗口外的合法 optimistic user item MUST 保留。无 HistoryStamp、stamp 已过期、anchor 不唯一、watermark 回退或窗口边界不完整的响应 MUST NOT 执行权威替换。

#### Scenario: Repair after recoverable UI batch
- **WHEN** 批处理期间发生可归属 timeline gap
- **THEN** 客户端 MUST flush 或丢弃对应 thread 的未提交批次
- **AND** 随后的 bounded repair MUST replace 声明窗口内的未知尾部

#### Scenario: Repair keeps processed event ids
- **WHEN** bounded repair 完成后 SSE replay 再次发送 repair 前已处理的 `{bootId, eventId}`
- **THEN** 客户端 MUST 继续忽略重复事件
- **AND** MUST NOT 因 repair 缩小了 timeline 窗口而重复追加文本

#### Scenario: Authoritative latest page removes only stale tail
- **WHEN** 当前 timeline 已加载较旧分页历史，并在 latest window 内保留一个 rollback 后不存在的 stale entry
- **AND** 同一 HistoryStamp 的 repair page 声明该 latest window 且不包含该 stale entry
- **AND** 该 stale entry 的 `lastAppliedStreamSequence <= pageWatermark`
- **THEN** engine MUST 删除闭区间窗口内未被权威 page 或 overlay 确认的 stale entry
- **AND** MUST 保留窗口之前已加载的较旧分页历史

#### Scenario: Latest page includes runtime live overlay
- **WHEN** app-server 持久化 snapshot 尚未包含正在输出的 item
- **AND** 同一 HistoryStamp 的 runtime overlay 已聚合该 item
- **THEN** latest-page repair 响应 MUST 包含 overlay item 或等价的权威确认
- **AND** 客户端 MUST NOT 因持久化延迟删除已经到达的 live entry

#### Scenario: Live event after page watermark survives repair
- **WHEN** 服务端捕获 repair pageWatermark 后，同一 HistoryStamp 的新 live entry 到达客户端
- **AND** repair page 随后返回且尚未包含该 watermark 之后的 entry
- **THEN** engine MUST 保留该 live entry并在权威页面提交后按 identity/anchor 归位
- **AND** MUST NOT 仅因 entry 位于 latest-window order 范围内就将其删除

#### Scenario: Watermark and overlay are captured atomically after page read
- **WHEN** 上游 bounded page 读取期间 gateway 仍在接收 live events
- **THEN** 服务端 MUST 在 page 读取完成后于同一同步临界区捕获 pageWatermark 和 overlaySnapshot
- **AND** pageWatermark 之前已由 gateway 处理的 overlay state MUST 全部参与权威 page
- **AND** 临界区之后的新 event MUST 获得更大 streamSequence 并由客户端按 post-watermark entry 保留

#### Scenario: Unfenced legacy stale entry is removable
- **WHEN** 当前 stamp 的权威窗口内存在无 streamSequence/baselineWatermark 的 legacy snapshot 或 local placeholder
- **AND** 该 entry 不属于 unresolved optimistic operation，也不是 repair 请求后的 client mutation
- **AND** page 与 overlaySnapshot 都未确认该 entry
- **THEN** engine MUST 将其视为 pre-baseline stale entry 并从窗口删除
- **AND** MUST NOT 因 fence 缺失而永久保留 stale tail

#### Scenario: Snapshot entry inherits a baseline watermark
- **WHEN** snapshot、repair 或 supplement entry 由带 pageWatermark 的权威响应提交
- **THEN** engine MUST 将该 watermark 记录为 entry 的 baseline coverage fence
- **AND** 后续 repair MUST 使用该 fence 判断 entry 是否已被新的权威窗口覆盖

#### Scenario: Repair window bridges already loaded history
- **WHEN** repair page 的 `preservedThrough` 或 `windowStartAnchor` 唯一命中已加载旧页的边界
- **THEN** engine MUST 保留该边界之前的 entries，并使用 repair 返回的 `nextCursor` 作为后续分页起点
- **AND** 后续 page 与已加载历史重叠时 MUST 按强 identity 去重，不能产生边界重复

#### Scenario: Invalid repair boundary fails closed
- **WHEN** repair response 缺少 anchor/pageWatermark、anchor 无法唯一定位或 watermark 小于已应用基线
- **THEN** engine MUST 拒绝 `replace-latest-window` 并保留当前可见窗口
- **AND** repair token MUST 保持 pending 或转为明确错误，不能把无边界响应降级成全窗口 replace

#### Scenario: Stale repair response is rejected
- **WHEN** repair 请求发出后 thread 的 `bootId` 或 generation 已变化
- **THEN** 客户端 MUST 在改变 timeline、ledger 或 pagination cursor 前拒绝旧响应
- **AND** 旧响应的 `nextCursor`，包括非空值，MUST NOT 覆盖新 HistoryStamp 的 cursor

#### Scenario: Null cursor clears stale pagination state
- **WHEN** 当前 HistoryStamp 的权威 latest page 返回 `nextCursor: null`
- **THEN** 客户端 MUST 清除此前窗口留下的旧 cursor
- **AND** MUST NOT 再使用旧 cursor 请求后续 history page

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
移动端 timeline SHALL 在用户发送消息并成功启动 turn 后，自动显示该 turn 的 agent 回复、reasoning、工具活动、diff、raw response、错误和完成状态。即使 `POST /api/codex/turns/start` 只返回 `turnId`，客户端也 MUST 通过实时事件或 snapshot repair/read-thread 兜底让可见 timeline 与真实 thread history 收敛，不能要求用户手动刷新页面。

#### Scenario: Started turn receives live visible events
- **WHEN** 用户发送消息
- **AND** `POST /api/codex/turns/start` 成功返回 `turnId`
- **AND** app-server 随后发送 agent message、reasoning、tool、diff、raw response、activity 或 turn progress 相关通知
- **THEN** 浏览器 MUST 将这些通知归一化为当前 thread 的可见 timeline entries 或 activity entries
- **AND** 用户 MUST 能在不刷新页面的情况下看到 agent 回复或活动进展

#### Scenario: Turn completion without visible server entries triggers repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中没有任何可见的 agent message、reasoning、tool、diff、raw response、activity 或 error entry
- **THEN** 前端 MUST 触发 snapshot repair 或重新读取 thread history
- **AND** repair 后 MUST 将 thread history 中属于该 turn 的回复和活动合并到 timeline

#### Scenario: Completion with tool-only output does not repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中已有可见 tool、activity、reasoning、diff、raw response 或 error 输出
- **THEN** 前端 MUST NOT 仅因缺少 agent message 而触发 completion snapshot repair

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

### Requirement: Running snapshot repair is reasoned and deduplicated
移动端会话页 SHALL 将运行态 snapshot repair 视为有明确原因的有界修复动作，而不是轮询机制。每个 repair 请求 MUST 携带可区分来源的 reason，并以 thread、turn、reason 和 history generation 或等价标识生成去重 key。相同 key 的 pending repair MUST NOT 反复触发 `/api/codex/threads/:threadId` timeline 读取。

#### Scenario: Summary polling stays lightweight
- **WHEN** 当前 thread 处于 active 或 compact pending 状态
- **THEN** 客户端 MAY 周期性请求 thread summary
- **AND** 该周期性请求 MUST NOT 使用带 timeline 的 `readThread` endpoint

#### Scenario: Duplicate completion repair is suppressed
- **WHEN** 当前 active turn 已因 `turn_completed` 请求 snapshot repair
- **AND** summary 轮询随后也观察到该 thread 已 idle
- **THEN** 客户端 MUST 复用或忽略等价 repair 请求
- **AND** MUST NOT 为同一 turn completion 连续发起多次 timeline 读取

#### Scenario: Running without output does not force early full read
- **WHEN** 用户发送消息后 thread 仍处于 active
- **AND** 尚未收到可见 live output
- **AND** 事件流未报告 `timeline-gap`
- **THEN** 客户端 MUST NOT 仅因短固定时间无输出就请求完整 thread timeline
- **AND** 客户端 MUST 继续依赖事件流、运行状态提示和 summary 状态兜底

#### Scenario: Confirmed gap still repairs
- **WHEN** 客户端收到归属到某 thread 的 `timeline-gap`
- **THEN** 客户端 MUST 为该 thread 请求 snapshot repair
- **AND** 该 repair MUST 使用可去重的 gap reason

#### Scenario: Completion without visible output repairs once
- **WHEN** 当前 active turn 完成
- **AND** 当前 timeline 没有该 turn 的可见 agent、tool、reasoning、diff、raw response、activity 或 error 输出
- **THEN** 客户端 MUST 请求一次 snapshot repair
- **AND** 后续重复完成事件或 summary idle MUST NOT 造成同一完成原因的重复 timeline 读取

#### Scenario: Completion with visible non-agent output is stable
- **WHEN** 当前 active turn 完成
- **AND** 当前 timeline 已有该 turn 的可见 tool-only、reasoning-only、activity-only、diff-only、raw response 或 error 输出
- **THEN** 客户端 MUST NOT 仅因没有 agent message 请求 completion repair
- **AND** 后续确认 gap 或用户显式刷新仍 MAY 触发有界 repair

### Requirement: Thread status changes flow through event stream
timeline event stream SHALL deliver app-server `thread/status/changed` notifications to the browser as thread-level status events. These events MUST update the client thread status without requiring full `readThread` timeline polling.

#### Scenario: Active status arrives through event stream
- **WHEN** app-server sends `thread/status/changed` with status `active`
- **THEN** browser event stream MUST emit a thread status event for that `threadId`
- **AND** client store MUST mark that thread as running
- **AND** client store MUST preserve or update the active turn when the event provides enough information

#### Scenario: Idle status arrives through event stream
- **WHEN** app-server sends `thread/status/changed` with status `idle`
- **THEN** client store MUST mark that thread as not running
- **AND** client store MUST clear stale active turn state
- **AND** the current会话页 MUST stop showing processing UI without requiring page refresh

#### Scenario: Non-idle recoverable status arrives
- **WHEN** app-server sends `thread/status/changed` with status `notLoaded` or `systemError`
- **THEN** client store MUST save that status for the thread
- **AND** controls that require `idle` MUST render disabled or recovery UI based on that status
- **AND** the event MUST NOT trigger full timeline repair by itself

#### Scenario: Status event is not visible timeline content
- **WHEN** browser receives a thread status event
- **THEN** the event MUST be idempotent through `eventId` or equivalent identity
- **AND** the event MUST NOT append a visible timeline entry
- **AND** the event MUST NOT participate in rewind/fork turn counting

### Requirement: Idle status finishes live timeline activity
timeline event stream 客户端 SHALL 在收到可信 `thread_status_changed` 且状态为 `idle` 时，收尾当前已知 active turn 的 live timeline activity。该 status 事件 MUST 继续作为 thread-level 状态事件处理，不得追加可见 timeline item，也不得仅因该 status 事件触发完整 timeline repair。

#### Scenario: Idle status finishes pending reasoning
- **WHEN** 客户端已记录某 thread 的 `activeTurnId`
- **AND** timeline 中存在该 turn 的 pending reasoning entry
- **AND** 浏览器收到该 thread 的 `thread_status_changed` 且 status 为 `idle`
- **THEN** 客户端 MUST 标记该 thread 为 not running
- **AND** 客户端 MUST 清理 stale active turn state
- **AND** 客户端 MUST 移除该 turn 的空 pending reasoning entry
- **AND** 客户端 MUST NOT 追加可见 status timeline item
- **AND** 客户端 MUST NOT 仅因此 status event 请求完整 timeline repair

#### Scenario: Idle status finishes running activity entries
- **WHEN** 客户端已记录某 thread 的 `activeTurnId`
- **AND** timeline 中存在该 turn 的 running tool 或 command entry
- **AND** 浏览器收到该 thread 的 `thread_status_changed` 且 status 为 `idle`
- **THEN** 客户端 MUST 将该 turn 的 running activity entry 标记为 ended
- **AND** 后续同一 item 的 completion 或 delta MUST 继续按现有幂等与合并规则处理

#### Scenario: Idle status without known active turn
- **WHEN** 浏览器收到某 thread 的 `thread_status_changed` 且 status 为 `idle`
- **AND** 客户端没有该 thread 的已知 active turn
- **THEN** 客户端 MUST 更新 thread status 并保持 not running
- **AND** 客户端 MUST NOT 猜测某个 timeline entry 所属 turn 并强行收尾

### Requirement: Timeline event 必须通过统一身份归一化
timeline event stream 客户端 SHALL 将所有可见事件转换为统一 timeline input，并使用稳定 identity key upsert 到 timeline。系统 MUST NOT 仅依赖文本相同、文本包含或数组位置来判断 live event、completed item、snapshot item 是否重复。

#### Scenario: Live delta 与 completed item 同身份
- **WHEN** 客户端先收到某 turn 的 `agent_message_delta`
- **AND** 后续收到同一 generation、turnId 和 itemId 的 completed item
- **THEN** timeline MUST 原位合并为一条 agent message
- **AND** MUST NOT 同时显示 live agent message 和 completed agent message 两条内容

#### Scenario: 文本格式不同但身份相同
- **WHEN** live delta 文本与 completed item 文本存在空白、标点或 Markdown 规范化差异
- **AND** 二者拥有相同 generation、turnId 和 itemId
- **THEN** completed item MUST 替换或补全同一 timeline entry
- **AND** MUST NOT 因文本不互相包含而追加第二条回复

#### Scenario: 缺少稳定身份
- **WHEN** 可见事件缺少可靠 threadId、turnId 或 itemId
- **THEN** 客户端 MUST 使用受限 fallback 或触发 bounded repair
- **AND** MUST NOT 把 ownerless 可见事件默认追加到当前 active thread

### Requirement: Event id 和 revision 账本按 thread generation 隔离
客户端 SHALL 将 processed event identity、item revision、snapshot delta suppression 和 deleted-turn barrier 绑定到 `{bootId, threadId, generation}` 或等价 HistoryStamp 分段。旧 boot/generation 的幂等账本 MUST NOT 抑制新历史中合法复用 item id 的输出；snapshot repair MUST 保留当前 HistoryStamp 的 event/revision 幂等信息。legacy snapshot 产生的无 generation suppression MUST 在建立明确 HistoryStamp、rollback 或 boot 变化时失效，MUST NOT 以裸 itemId 跨 turn 或 generation 生效。账本淘汰 MUST 按逻辑 event 数和有界保留策略执行；同一 event 的 composite/raw lookup index MUST 共享一个容量槽或同步淘汰，不能让声明容量实际减半。

#### Scenario: Rollback 后复用 item id
- **WHEN** thread rollback 后 generation 增加
- **AND** 新 turn 产生与旧历史相同 itemId 的 agent/reasoning/tool event
- **THEN** 客户端 MUST 按新 generation 独立判断 revision 和 suppression
- **AND** 新输出 MUST 能进入 timeline

#### Scenario: 旧 generation late event
- **WHEN** 客户端已处于较新 generation
- **AND** 收到旧 generation 的可见 event
- **THEN** 客户端 MUST 忽略该 event
- **AND** 被 rollback 删除的旧内容 MUST NOT 重新出现

#### Scenario: Repair 后事件重放
- **WHEN** 当前 generation 完成 snapshot repair
- **AND** 事件流随后重放 repair 前已经处理的 event identity 或 revision
- **THEN** 客户端 MUST 继续识别并忽略该重复事件
- **AND** timeline MUST NOT 因 repair 清空账本而追加重复消息或 activity

#### Scenario: Legacy suppression expires at a history barrier
- **WHEN** legacy snapshot 在没有 generation 的情况下记录了裸 itemId suppression
- **AND** rollback、明确 generation 初始化或新 boot 建立新的 HistoryStamp
- **THEN** 客户端 MUST 使该 legacy suppression 失效
- **AND** 新 HistoryStamp 中复用 itemId 的合法 delta MUST 被接受

#### Scenario: Ledger capacity counts logical events
- **WHEN** ledger 配置保留 N 个近期逻辑 events，并为每个 event 同时维护 composite identity 与兼容 lookup index
- **THEN** 前 N 个逻辑 events MUST 在窗口内继续可去重
- **AND** 实现 MUST NOT 因每个 event 写入两个 index 而只保留约 N/2 个 events

### Requirement: Delta batch 不得改变事件接受语义
timeline event stream 客户端 SHALL 只把 batch 作为 UI commit 优化。批处理 MUST 保留每条原始 event 的 eventId、generation、revision、sequence、deleted-turn barrier 和 snapshot suppression 判断结果。

#### Scenario: Batch 内既有旧事件又有新事件
- **WHEN** 一个 delta batch 包含旧 generation event 和当前 generation event
- **THEN** 客户端 MUST 逐条应用 generation 判断
- **AND** MUST 只提交当前 generation 中合法的新 delta

#### Scenario: Batch flush 前发生 gap
- **WHEN** 文本 delta 正在 batch window 内等待 flush
- **AND** 同 thread 收到 `timeline-gap` 或 rollback generation bump
- **THEN** 客户端 MUST 丢弃或重新校验该 thread 的未提交 batch
- **AND** MUST NOT 在 repair 或 rollback 后 flush 旧尾部内容

### Requirement: Listener buffer overflow 必须归属到 thread
当底层事件流在没有 listener 时消费可见 timeline event，客户端 SHALL 缓存事件或产生带 threadId 的 repair 信号。buffer overflow MUST NOT 生成无法归属但会破坏 active thread 的 repair；若无法确定归属，MUST 采用非破坏性降级。

#### Scenario: Known thread buffer overflow
- **WHEN** 无 listener 期间当前 buffer 超过安全窗口
- **AND** 被丢弃或压缩的事件能确定 threadId
- **THEN** 客户端 MUST 产生该 thread 的 `timeline-gap` 或等价 repair request
- **AND** 新 listener 注册后 MUST repair 该 thread

#### Scenario: Unknown owner buffer overflow
- **WHEN** buffer overflow 但无法可靠确定事件所属 thread
- **THEN** 客户端 MUST NOT 默认 repair active thread
- **AND** MUST 保留连接异常状态、等待下一条可归属事件或执行不覆盖具体 thread 的恢复策略

### Requirement: Server backlog 不得补发被屏蔽的可见旧事件
服务端 timeline event backlog SHALL 遵守 generation 和 deleted-turn barrier。重连 replay 时，服务端 MUST 不补发会让已 rollback/fork 删除内容重新出现的可见事件；如果无法可靠过滤，MUST 发送归属明确的 `timeline-gap`。

#### Scenario: Backlog 中包含 deleted turn event
- **WHEN** 客户端携带旧 Last-Event-ID 重连
- **AND** backlog 中包含已被 rollback 删除 turn 的可见事件
- **THEN** 服务端 MUST 不补发这些事件
- **AND** 若无法确认过滤结果，MUST 发送带 threadId 的 `timeline-gap`

#### Scenario: Backlog 游标不可恢复
- **WHEN** Last-Event-ID 不在服务端 backlog 可恢复窗口内
- **THEN** 服务端 MUST 发送 `timeline-gap`
- **AND** gap payload SHOULD 包含缺口所属 threadId

### Requirement: Timeline inputs are reduced through a single engine
客户端 SHALL 将 snapshot window、pagination page、live event、live event batch、overlay item、turn item detail、rollout supplement item、optimistic user item 和 rollback/fork replace 转换为统一 timeline input，并通过同一个持久化 timeline engine state 产生 normalized entries 与 indexes。系统 MUST NOT 在 store action、page helper 或 render component 中保留另一套独立的可见输出去重、排序、等价合并或 generation 屏障逻辑；单 entry 文本追加在 identity 和 order 不变时 MUST 使用增量 upsert，MUST NOT 每次重新归一化和重建完整 timeline indexes。

#### Scenario: Snapshot and live item share identity path
- **WHEN** 同一 agent/reasoning/tool 输出先通过 live delta 显示
- **AND** 后续 snapshot repair、turn item detail 或 rollout supplement 返回同一输出
- **THEN** 所有来源 MUST 通过同一 identity/upsert 规则合并为一个 normalized entry
- **AND** timeline MUST 不显示重复 activity、重复 agent message 或重复 compact/system message

#### Scenario: Store action does not normalize twice
- **WHEN** store 处理一次 live delta batch 或 snapshot window
- **THEN** store action MUST 只构造 timeline input 并提交 engine
- **AND** MUST NOT 先执行一套旧 normalize/sort/merge 再把结果交给 engine 重新 normalize

#### Scenario: Store does not materialize batch entries
- **WHEN** store 收到包含 agent、reasoning 或 tool 文本 delta 的 `codex-event-batch`
- **THEN** store MUST 将原始 delta 转换为有序 engine inputs
- **AND** MUST NOT 手工复制完整 entries、建立临时 identity index、拼接文本或以 `snapshot-window` 提交 batch

#### Scenario: 单 entry delta 使用增量快路径
- **WHEN** 已存在 identity 稳定且 turn/order 元数据不变的 agent、reasoning 或 tool entry
- **AND** 客户端收到该 entry 的新文本 delta
- **THEN** engine MUST 通过持久化 index 定位并只更新该 entry
- **AND** MUST NOT 对完整 entries 执行排序、fallback 扫描或 index rebuild

#### Scenario: 结构变化回退完整归一化
- **WHEN** 输入新增 entry、补齐 turnId、确认 optimistic user、改变 generation 或可能改变同 turn 顺序
- **THEN** engine MUST 回退统一结构性归一化路径
- **AND** 快路径 MUST NOT 绕过 identity、排序或 rollback barrier 语义

#### Scenario: Page helpers do not reorder repaired activity
- **WHEN** snapshot repair 或 turn item detail 补齐同一 turn 的 activity
- **THEN** 页面层 MUST 不基于 createdAt、role rank 或渲染文本自行重排 entries
- **AND** 同 turn 顺序 MUST 来自 engine 的 order key 或等价 normalized order

### Requirement: Pending delta batches honor timeline barriers
timeline event stream 客户端 SHALL 在文本 delta 批处理窗口内继续记录原始 event identity、generation、revision 和 sequence。若 batch flush 前发生 snapshot repair、rollback/fork replace、generation bump、deleted-turn barrier 或 explicit timeline gap，客户端 MUST 重新校验该 batch，丢弃旧历史内容或将其转为归属明确的 repair 信号。

#### Scenario: Repair arrives before batch flush
- **WHEN** agent/tool/reasoning delta 正在 batch window 内等待 flush
- **AND** 同一 thread 完成 snapshot repair 并推进或确认当前 generation
- **THEN** pending batch MUST 在提交前重新校验 generation 和 snapshot suppression
- **AND** 已被 repair 覆盖的 delta MUST NOT 再追加到 visible timeline

#### Scenario: Rollback blocks stale pending batch
- **WHEN** 用户执行 rewind 或 fork rollback
- **AND** batch queue 中仍有属于被删除 turn 的 delta
- **THEN** 该 batch MUST 被丢弃
- **AND** 被删除 turn MUST NOT 因延迟 flush 重新出现在 timeline 中

#### Scenario: Overflow repair is thread-scoped
- **WHEN** listener 空窗或 batch backlog 超出可恢复预算
- **AND** 客户端能确定受影响的 `threadId`
- **THEN** 客户端 MUST 产生该 thread 的 `timeline-gap` 或等价 repair request
- **AND** MUST NOT 默认对当前 active thread 执行破坏性 repair

### Requirement: Repair requests remain bounded and non-looping
timeline event stream 和会话页 SHALL 将 snapshot repair 视为有原因、可去重、可失败重试但非轮询的恢复动作。repair MUST 读取最近窗口或目标 turn 范围，MUST 不因返回 active 状态、缺少最终 assistant 文本或普通 EventSource error 而进入连续 full detail repair。

#### Scenario: Active repair does not loop
- **WHEN** 一次 `stream-disconnected` 或 `timeline-gap` repair 返回 thread 仍为 active
- **THEN** 客户端 MUST 不因此立即安排下一次同 reason full detail repair
- **AND** 后续 repair MUST 由新的 gap、completion-without-output 或显式用户动作触发

#### Scenario: Visible activity suppresses completion repair
- **WHEN** active turn 完成
- **AND** timeline 已有该 turn 的 agent、reasoning、tool、diff、raw response、activity、system 或 error 可见输出
- **THEN** 客户端 MUST 不仅因缺少最终 assistant 文本而请求 completion repair
- **AND** 后续确认 gap 仍 MAY 触发有界 repair

### Requirement: Fallback live identity is turn scoped
缺少稳定 `itemId` 的可见 live event MUST 使用包含 `bootId`、`threadId`、history generation、`turnId`、event kind、source event identity 和同 turn source slot 的受限 synthetic identity，或触发归属明确的 bounded repair。客户端 MUST NOT 使用仅包含 threadId、turnId + kind 或固定 `:live` 后缀的 fallback identity 跨 turn或在同一 turn 内累积多个 agent、reasoning 或 tool items。completed/snapshot item 只有携带显式唯一 alias/anchor 时才能替换 synthetic entry；多个候选时 MUST 保留独立项或 repair。

#### Scenario: 连续 turns 均缺少 agent itemId
- **WHEN** 同一 thread 的两个不同 turn 都收到缺少 itemId 的 `agent_message_delta`
- **THEN** 客户端 MUST 为两个 turn 使用不同 fallback identity
- **AND** 第二个 turn 的文本 MUST NOT 追加到第一个 turn 的 agent entry

#### Scenario: Same turn has multiple id-less agent items
- **WHEN** 同一 turn 先后产生两个缺少 itemId 的 agent messages，并在二者之间出现 tool activity
- **THEN** 客户端 MUST 使用 source event identity 或 source slot 保留两个 agent entries
- **AND** 后到 completion MUST NOT 无条件替换第一个 `:live` entry 或反转二者顺序

#### Scenario: 可见事件缺少 turnId
- **WHEN** 客户端收到缺少 turnId 且无法从事件上下文证明归属的可见 delta
- **THEN** 客户端 MUST 不把该 delta 默认追加到 active turn
- **AND** MUST 丢弃该输入或触发归属明确的 bounded repair

### Requirement: Live delta ordering converges with refreshed snapshots
timeline engine SHALL 使用统一 source order 或 orderKey 归一化 live event、snapshot、pagination、turn item detail、overlay 和 rollout supplement。adapter、store 和 page helper MUST NOT 通过移动 entries、role rank 或改写 `createdAt` 建立另一套可见顺序。

#### Scenario: Realtime and refresh use the same fixture
- **WHEN** 同一 turn 的 user、agent、tool、agent、diff items 分别通过实时事件和刷新 snapshot 输入 engine
- **THEN** 两条路径产生的可见 entry identity 顺序 MUST 完全一致
- **AND** activity MUST NOT 因刷新或 repair 被移动到不同的 assistant message 一侧

#### Scenario: Adapter only maps source order
- **WHEN** turn item detail 或 pagination 返回带稳定数组顺序或 sequence 的 items
- **THEN** adapter MAY 将该顺序映射为 sourceOrder/orderKey
- **AND** adapter MUST NOT 移动 entries 或改写 `createdAt` 来修复顺序

#### Scenario: Source-local ordinals are not compared globally
- **WHEN** live event sequence、pagination array index 和 JSONL sequence 来自不同坐标系
- **THEN** engine MUST 使用 identity anchor、window baseline 和来源内稳定顺序进行插入
- **AND** MUST NOT 直接按这些 ordinal 的数值大小跨来源排序

### Requirement: Live delta fragments have deterministic reducer semantics
`live-delta` 输入 SHALL 表示 append fragment。timeline engine MUST 统一处理 `{bootId, eventId}`、revision、全局 `streamSequence`、可选 per-item `fragmentSequence`、generation、delivery epoch、completed replacement 和 snapshot suppression，store MUST NOT 在 engine 外实现另一套 fragment 拼接规则。只有同 `{threadId, generation, turnId, itemId, field}` 的 `fragmentSequence` 才能执行 `+1` 连续性检查；`streamSequence` 的跳号或被其他 item 插入 MUST NOT 被当作 fragment gap。旧事件缺少 `fragmentSequence` 时，客户端 MUST 依赖 event identity/revision 幂等处理，MUST NOT 用文本包含关系或全局 cursor 推断连续性。

#### Scenario: Contiguous fragment appends
- **WHEN** 同 identity 和 field 依次收到 fragmentSequence 10 和 11 的合法 fragments
- **THEN** engine MUST 按顺序追加两个 fragments
- **AND** entry 的可见位置 MUST 保持不变

#### Scenario: Sequence gap requests repair
- **WHEN** 同 identity 和 field 已接受 fragmentSequence 10 后收到 fragmentSequence 12
- **THEN** engine MUST 不追加 fragmentSequence 12 fragment
- **AND** MUST 记录 item-scoped gap 并请求 bounded repair

#### Scenario: Same revision conflicts
- **WHEN** 同 identity 收到相同 revision 但不同 `{bootId, eventId}` 或不同 fragment 内容
- **THEN** engine MUST 不把两个冲突 fragments 都追加
- **AND** MUST 记录 identity conflict 并请求 bounded repair

#### Scenario: Completed item replaces partial text
- **WHEN** live fragments 已形成 partial text
- **AND** completed item 返回非空权威全文
- **THEN** engine MUST 使用 completed text 完成该 identity
- **AND** snapshot 已覆盖的旧 fragments MUST 不再追加

#### Scenario: Interleaved global sequence remains valid
- **WHEN** item A 的 fragmentSequence 为 1、2，且两者之间的全局 streamSequence 包含 item B 事件
- **THEN** engine MUST 接受 item A 的两个连续 fragments
- **AND** MUST NOT 要求 item A 的两个 `streamSequence` 数值相邻

#### Scenario: Legacy fragment has no fragment sequence
- **WHEN** 兼容事件只携带 `streamSequence` 而没有 `fragmentSequence`
- **THEN** engine MUST NOT 对该 item 执行基于 `streamSequence + 1` 的缺口判断
- **AND** 无法通过 event identity、revision 或权威正文证明安全时 MUST 请求 scoped repair，而不是按文本前缀猜测

### Requirement: Timeline barriers use a thread delivery epoch
客户端 SHALL 为每个 thread 维护 delivery epoch，并在 batch envelope 中携带捕获 epoch。snapshot repair、rewind、rollback、fork 和 timeline gap MUST 使旧 pending delivery 失效；store MUST 在 reduce 前拒绝 epoch 不匹配的 batch。

#### Scenario: Gap invalidates pending batch
- **WHEN** thread 的文本 fragments 尚未 flush 且收到 `timeline-gap`
- **THEN** client MUST 丢弃该 thread pending queue 并递增 epoch
- **AND** gap 前捕获的 batch MUST NOT 在 repair 后提交

#### Scenario: Rollback invalidates client queue
- **WHEN** 用户开始 rewind、rollback 或 fork mutation
- **THEN** coordinator MUST 在 API 调用前使该 thread client queue 和 store epoch 同步失效
- **AND** mutation 前的 fragments MUST NOT 在新历史中出现

#### Scenario: Approval flushes without invalidation
- **WHEN** pending fragments 后收到 approval 或普通非破坏性控制事件
- **THEN** client MUST 先按原顺序 flush fragments 再发送控制事件
- **AND** delivery epoch MUST 保持不变

### Requirement: Oversize visible events preserve identity and continuation
timeline event stream SHALL 在发送前检查序列化 UTF-8 bytes。超过 event budget 的可见事件 MUST 转换为保留 threadId、turnId、itemId、eventId、revision、sequence、generation、sourceOrder、preview 和 contentRef 的引用事件，MUST NOT 静默丢弃或仅断开连接。

#### Scenario: Tool output event exceeds budget
- **WHEN** tool output 可见事件序列化后超过 256 KiB 默认 event budget
- **THEN** 浏览器 MUST 收到同 identity/order 的 truncated reference event
- **AND** 客户端 MUST 能按 contentRef 读取完整 output

#### Scenario: Reference event still exceeds budget
- **WHEN** reference event 加上 preview、metadata 和 contentRef 后仍超过 event budget
- **THEN** 服务端 MUST 继续缩减 preview 和可选 metadata，直到最小 identity/order/completeness envelope 在预算内
- **AND** 若无法生成安全 contentRef，MUST 发送 scoped repair-required envelope，禁止丢事件或断连

#### Scenario: Oversize event replay
- **WHEN** reference event 因重连被 replay
- **THEN** eventId/revision ledger MUST 继续去重
- **AND** MUST 不创建第二条 preview 或重复 full-content 请求

### Requirement: Realtime and refreshed completeness converge
同一 item 的 realtime preview/reference、completed item、snapshot item、turn detail 和 full-content chunks SHALL 通过 timeline engine 产生一致 identity、可见顺序、正文前缀和 completeness 状态。

#### Scenario: Realtime reference then complete snapshot
- **WHEN** realtime 先收到 truncated reference event
- **AND** refresh snapshot 后续返回完整同 identity item
- **THEN** snapshot MUST 原位完成该 item
- **AND** MUST 不保留重复 preview entry

#### Scenario: Complete realtime then partial refresh
- **WHEN** realtime 已接收完整正文
- **AND** refresh response 因 page budget 只返回 partial/truncated item
- **THEN** engine MUST 保留完整 realtime 正文
- **AND** visible order MUST 与完整 refresh fixture 一致

### Requirement: Timeline gaps include completeness scope
当 backlog、pagination 或 content source 无法恢复时，timeline gap/repair signal SHALL 包含受影响 thread、可选 turn/item identity 和 completeness reason。客户端 MUST 只 repair 受影响范围。

#### Scenario: Content cursor expires
- **WHEN** full-content cursor 无法继续读取
- **THEN** 服务端 MUST 返回 item-scoped repair-required
- **AND** 客户端 MUST 不覆盖其他完整 timeline entries

### Requirement: File change item identity remains stable across sources
timeline engine SHALL 将同一 generation、turnId 和 itemId 的 file change live delta、completed item、snapshot item 与 repair item 归一化为同一 timeline entry。实时阶段的占位 `tool`、完成阶段的真实路径、status 和 diff 统计变化 MUST NOT 创建第二条 Files changed activity。

#### Scenario: Live file delta followed by completed snapshot
- **WHEN** 客户端先收到带稳定 itemId 的 `file_output_delta`
- **AND** 后续 snapshot 或 completed item 使用同一 generation、turnId 和 itemId，但 `tool` 从占位值变为真实文件路径
- **THEN** timeline MUST 原位合并为一条 file change entry
- **AND** Files changed MUST 保持在原事件位置
- **AND** timeline MUST NOT 在末尾追加重复 Files changed

#### Scenario: Different file item ids remain distinct
- **WHEN** 同一 turn 包含两个不同 itemId 的 file change items
- **THEN** timeline MUST 保留两条独立 file change entries
- **AND** 每条 entry MUST 使用各自完成态路径和 diff 统计

### Requirement: Cross-source repair preserves anchored event position
snapshot merge 和 bounded repair SHALL 使用强 identity 以及 `beforeEntryId`、`afterEntryId` 或等价 anchor 恢复条目位置。anchor target MUST 按 HistoryStamp、turnId 和 itemId/synthetic identity 解析，MUST NOT 只按裸 itemId 命中另一 turn 或 generation。有效 anchor MUST 优先于 source-local ordinal；不同来源的局部 ordinal MUST NOT 因数值比较撤销 anchor 或覆盖原事件顺序。

#### Scenario: Repair fills file change between agent messages
- **WHEN** 当前 timeline 已包含同一 turn 的前后 agent messages
- **AND** bounded repair 返回位于两者之间的 file change item
- **THEN** repair 后 Files changed MUST 渲染在两个 agent messages 之间
- **AND** error 或 completion 事件 MUST NOT 将该 file change 移到 timeline 末尾

#### Scenario: Anchor takes precedence over repair ordinal
- **WHEN** repair item 的 before/after anchors 将其定位在两个已有 entries 之间
- **AND** repair source 的局部 ordinal 数值会把它排序到 anchor 范围之外
- **THEN** engine MUST 保留 anchor 指定的位置
- **AND** MUST NOT 再用该局部 ordinal 移动 repair item

#### Scenario: Reused bare item id cannot anchor another generation
- **WHEN** anchor 中的裸 itemId 在另一 turn 或 generation 也存在
- **THEN** engine MUST 使用完整 scoped identity 选择同 HistoryStamp、同 turn 的 target
- **AND** 无法唯一定位时 MUST 请求 bounded repair 或保留当前位置，MUST NOT 猜测跨历史 anchor

### Requirement: Timeline timestamps remain consistent across sources
snapshot、pagination 和 live timeline 输入 SHALL 使用相同的毫秒时间约定。缺少 item 时间时，系统 MUST 使用稳定 turn 时间或明确的历史 fallback，不得使用接收事件的当前时间覆盖历史语义。

#### Scenario: Same turn arrives from pagination and live sources
- **WHEN** 同一 turn 的条目分别来自 pagination 与 live event
- **THEN** 两种来源的时间 MUST 使用同一单位
- **AND** snapshot merge MUST NOT 将历史条目时间重置为当前时间

#### Scenario: Turn id is not a UUIDv7 identifier
- **WHEN** 历史 item 没有时间且 turnId 不能解析为 UUIDv7
- **THEN** adapter SHALL 使用经过单位规范化的调用方 fallback
- **AND** 系统 MUST 保持条目顺序稳定

### Requirement: Event recovery uses bounded authority sources
timeline event recovery SHALL 仅使用带 HistoryStamp 的 metadata、合并 runtime live overlay 后的 thread-wide latest page、目标 item content page 或目标 turn 的有界页作为权威来源。gap repair MUST 使用 latest page 声明的窗口边界执行 `replace-latest-window`：删除该窗口内无法确认的未知尾部，保留窗口之前已加载的 history pages，并拒绝跨 HistoryStamp 的响应。steer、interrupt、review 和普通 event repair MUST NOT 附带完整 thread timeline。

#### Scenario: Stream gap triggers repair
- **WHEN** event stream 检测到 gap 或 turn 完成但缺少可见输出
- **THEN** repair MUST 请求 metadata 和至多一页合并同 generation runtime overlay 的最新 items
- **AND** repair MUST 权威替换声明窗口内的未知尾部，同时保留已加载的更旧 history pages
- **AND** repair failure MUST NOT 触发完整 detail fallback

#### Scenario: Steer succeeds during active turn
- **WHEN** steer 请求成功并产生新的 item 或 turn identity
- **THEN** HTTP 响应 MUST 只返回操作 identity 或 metadata
- **AND** 后续可见内容 MUST 通过 event stream 或有界 repair 到达

#### Scenario: Interrupt resolves turn identity
- **WHEN** interrupt 请求没有显式 turnId
- **THEN** 服务端 MUST 使用 metadata-only 状态或已知 active turn identity 解析目标
- **AND** MUST NOT 为解析 lastTurnId 读取消息 timeline

#### Scenario: Authority page and metadata share one history stamp
- **WHEN** 客户端为同一次 repair 读取 metadata 和 latest page
- **THEN** 两个响应 MUST 携带相同的 `{bootId, generation}` 才能共同提交
- **AND** 任一响应的 stamp 与当前 thread 不一致时 MUST 放弃该 repair，不得部分更新 timeline 或 cursor

### Requirement: Completion repair tolerates persistence lag
turn completion repair SHALL 区分“请求成功”和“目标输出已 materialize”。只有目标 turn 已出现非 user 可见输出时才能视为恢复完成；否则 MUST 在固定上限内延迟重试。

#### Scenario: First repair is incomplete
- **WHEN** completion repair 成功返回但目标 turn 没有 assistant、reasoning、tool、diff、system 或 error 输出
- **THEN** repair MUST 保持 pending 并延迟重试
- **AND** MUST NOT 全量读取历史

#### Scenario: Retry limit reached
- **WHEN** 固定次数 repair 后目标输出仍未出现
- **THEN** 客户端 MUST 停止自动请求
- **AND** 页面 MUST 保留已有消息与正常手动刷新能力

### Requirement: Known active turn identity survives metadata refresh
系统 SHALL 将 `turn/start` 响应和 `turn_started` event 中的 turnId 作为已知 active turn identity。active metadata 不提供 turnId 时 MUST 保留该 identity，匹配的终态事件到达后 MUST 清理。

#### Scenario: Active metadata omits lastTurnId
- **WHEN** 客户端已知 active turnId，随后收到 status 为 active 且 `lastTurnId: null` 的 metadata
- **THEN** 客户端 MUST 保留已知 active turnId
- **AND** 中断操作 MUST 继续以该 identity 为目标

#### Scenario: Late completion belongs to an older turn
- **WHEN** gateway 已记录新的 active turnId，随后收到旧 turn 的迟到终态事件
- **THEN** gateway MUST 保留新的 active turnId
- **AND** MUST NOT 清除新 turn 的中断目标

### Requirement: Stale active metadata is reconciled without message reads
系统 SHALL 在 metadata 或 summary 报告 active 时，以有界最新 turn 状态校正运行态。该校正 MUST NOT 读取 turn items 或完整 timeline。

#### Scenario: Latest turn is already terminal
- **WHEN** `thread/read includeTurns=false` 返回 active
- **AND** `thread/turns/list limit=1 itemsView=notLoaded` 返回最新 turn 为 completed、failed 或 interrupted
- **THEN** Web metadata/summary MUST 返回 idle
- **AND** MUST 清理匹配的 active turn identity

#### Scenario: Latest turn is still running after Web restart
- **WHEN** gateway registry 为空且 metadata 返回 active
- **AND** 有界最新 turn 状态为 inProgress
- **THEN** Web MUST 保持 active
- **AND** MUST 恢复该 turn 的 active identity

### Requirement: History barriers are broadcast for every affected thread
服务端和浏览器事件客户端 SHALL 将 backlog gap、listener overflow、rollback、rewind、fork rollback 和服务启动 epoch 变化视为按 thread 归属的 history barrier。gateway MUST 保留覆盖 replay horizon 的 per-sequence owner ledger；一个 barrier 影响多个且 owner ledger 可覆盖的 thread 时，信号 MUST 携带完整的 `affectedThreadIds`，或为每个受影响 thread 发送等价的独立 scoped signal。cursor 早于 owner ledger、bootId 改变或 visible gap 无法可靠归属时，服务端 MUST 发送 `scope: all-tracked` 全局 barrier；客户端 MUST 为本地 cached/visible thread 集合分别建立 bounded repair。系统 MUST NOT 只选择最后一个 thread、当前 active thread或当前页面 thread，也 MUST NOT 对确认的全局缺口无限等待。rollback 类 barrier MUST 携带每个受影响 thread 的新 HistoryStamp，并在该 thread 的新历史事件之前送达所有订阅者。

#### Scenario: Global backlog gap affects multiple threads
- **WHEN** 全局 stream cursor 与当前 backlog 窗口之间缺失的事件属于 thread A 和 thread B
- **THEN** 服务端 MUST 在 gap signal 中列出 A、B，或分别发送两个 thread-scoped gap signal
- **AND** 客户端 MUST 为 A、B 分别建立 delivery barrier 和 bounded repair

#### Scenario: Gap predates owner ledger
- **WHEN** Last-Event-ID 属于当前 boot，但缺失区间早于 payload backlog 与 owner ledger 的最小 sequence
- **THEN** 服务端 MUST 发送 `scope: all-tracked` 的 timeline gap
- **AND** 每个客户端 MUST 冻结旧 delivery，并为自己缓存或正在显示的 threads 分别执行有界 repair
- **AND** MUST NOT 只 repair 当前页面 thread 或等待下一条可归属事件

#### Scenario: Listener overflow covers every buffered owner
- **WHEN** 无 listener buffer 溢出并丢失了多个可确定 `threadId` 的事件
- **THEN** 客户端 MUST 为所有受影响 thread 保留 gap 状态
- **AND** 新 listener 注册后 MUST NOT 只 repair 最后一个事件所属 thread

#### Scenario: Rollback barrier reaches every subscriber
- **WHEN** rollback、rewind 或 fork rollback 推进一个或多个 thread 的 generation
- **THEN** 服务端 MUST 向所有相关事件流订阅者广播每个受影响 thread 的新 HistoryStamp
- **AND** 客户端 MUST 在应用对应 thread 的任何新 generation event 前使旧 pending delivery 和旧 ledger 分段失效

### Requirement: HistoryStamp transitions rebase or rebuild atomically
客户端 SHALL 在 bootId 或 generation 改变时通过权威 latest page 原子迁移 timeline 窗口，MUST NOT 让两个 HistoryStamp 的可变 entries、ledger、suppression 或 cursor 长期共存。同 boot generation bump 的 repair MUST 提供 `preservedThrough` anchor，客户端 SHALL 将已证明未变化的 prefix 迁移到新 stamp并替换其后的权威窗口。bootId 改变时，客户端只有在新基线提供唯一 common-prefix anchor 时才能保留并迁移旧 prefix；无法证明 common prefix 时 MUST 清空旧缓存窗口并从新基线重建。

#### Scenario: Generation bump preserves a proven prefix
- **WHEN** rollback 使 generation 从 G1 变为 G2
- **AND** G2 repair page 的 `preservedThrough` 唯一命中 G1 timeline 的稳定 prefix
- **THEN** engine MUST 原子地把该 prefix 迁移到 G2 并替换 anchor 之后的权威窗口
- **AND** G1 的 ledger、suppression、cursor 和未知 tail MUST NOT 被迁移到 G2

#### Scenario: Boot restart rebases through a common prefix
- **WHEN** 服务端 bootId 改变且新 latest page 提供可在旧窗口中唯一命中的 common-prefix anchor
- **THEN** 客户端 MUST 原位迁移已证明一致的 prefix 并应用新 boot 的 latest window
- **AND** timeline MUST NOT 同时显示新旧 boot 的相同 historical items

#### Scenario: Boot restart without a common prefix rebuilds
- **WHEN** 服务端 bootId 改变且 bounded repair 无法证明旧窗口与新窗口的唯一 common prefix
- **THEN** 客户端 MUST 清空该 thread 的旧缓存窗口、cursor 和 volatile indexes并从新基线重建
- **AND** MUST NOT 使用文本、turn 数或裸 itemId 猜测跨 boot 合并

### Requirement: Listener delivery preserves pending stream order
浏览器事件客户端 SHALL 将注册 listener 前已消费但尚未交付的 event 与 delta batch 保存在同一个有序 delivery queue 中。batch MAY 作为 UI commit 优化，但 MUST NOT 拥有独立且先于更早 pending event 的 flush 顺序。listener 注册后的 drain MUST 先提交注册前更早的 envelope；drain 期间新到达的事件 MUST 排在旧 pending delivery 之后。

#### Scenario: Timer-flushed event precedes a newer pending batch
- **WHEN** event A 已从 delta timer flush 到 pending delivery
- **AND** 更晚的 event B 仍在尚未到期的 delta batch 中
- **AND** 此时注册 listener
- **THEN** 客户端 MUST 按 A、B 顺序交付
- **AND** B MUST NOT 因注册时先 flush batch 而越过 A

#### Scenario: New live event waits for listener drain
- **WHEN** listener 正在 drain 注册前的 pending envelopes
- **AND** 同一 boot 的新 live event C 到达
- **THEN** C MUST 排在已 pending 的更早 streamSequence 之后
- **AND** 客户端 MUST 不因 listener 已存在而绕过正在 drain 的队列

#### Scenario: Unsortable pending delivery becomes a scoped gap
- **WHEN** pending envelopes 跨 boot、缺失必要 cursor 或无法恢复全局顺序
- **THEN** 客户端 MUST 为每个可确定 owner 建立 delivery barrier 并请求 bounded repair
- **AND** MUST NOT 以任意 batch/event 容器优先级猜测顺序

### Requirement: Warning and runtime errors retain distinct semantics

事件流处理 MUST 保留 app-server `warning` 与 `turn_error`/`recovery_failed` 的语义差异；warning MUST NOT 被转换成 `body.kind = error` 的 timeline entry。

#### Scenario: Warning event is routed outside timeline
- **WHEN** store 处理 `warning` websocket 事件
- **THEN** store 只更新对应会话的 notice 状态，不改变 timeline entry 数量或顺序

#### Scenario: True turn error remains an alert
- **WHEN** store 处理 `turn_error` 或 `recovery_failed` 事件
- **THEN** timeline 保留现有错误 entry，并使用红色 alert 语义呈现

