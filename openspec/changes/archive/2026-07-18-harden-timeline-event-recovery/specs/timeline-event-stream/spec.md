## ADDED Requirements

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

## MODIFIED Requirements

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
