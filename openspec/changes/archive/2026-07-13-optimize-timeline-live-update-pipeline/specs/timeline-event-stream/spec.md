## MODIFIED Requirements

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

### Requirement: Event id 和 revision 账本按 thread generation 隔离
客户端 SHALL 将 processed event id、item revision、snapshot delta suppression 和 deleted-turn barrier 绑定到 thread history generation 或等价历史标识。旧 generation 的幂等账本 MUST NOT 抑制新 generation 中合法复用 item id 的输出；snapshot repair MUST 保留当前 generation 的 event/revision 幂等信息，账本淘汰 MUST 按 generation 和有界保留策略执行，而不是在 repair 时清空当前分段。

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
- **AND** 事件流随后重放 repair 前已经处理的 eventId 或 revision
- **THEN** 客户端 MUST 继续识别并忽略该重复事件
- **AND** timeline MUST NOT 因 repair 清空账本而追加重复消息或 activity

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

## ADDED Requirements

### Requirement: Fallback live identity is turn scoped
缺少稳定 `itemId` 的可见 live event MUST 使用包含 `threadId`、history generation、`turnId` 和 event kind 的受限 identity，或触发归属明确的 bounded repair。客户端 MUST NOT 使用仅包含 threadId 的 fallback entry id 跨 turn 累积 agent、reasoning 或 tool 文本。

#### Scenario: 连续 turns 均缺少 agent itemId
- **WHEN** 同一 thread 的两个不同 turn 都收到缺少 itemId 的 `agent_message_delta`
- **THEN** 客户端 MUST 为两个 turn 使用不同 fallback identity
- **AND** 第二个 turn 的文本 MUST NOT 追加到第一个 turn 的 agent entry

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
`live-delta` 输入 SHALL 表示 append fragment。timeline engine MUST 统一处理 eventId、revision、sequence、generation、delivery epoch、completed replacement 和 snapshot suppression，store MUST NOT 在 engine 外实现另一套 fragment 拼接规则。

#### Scenario: Contiguous fragment appends
- **WHEN** 同 identity 依次收到 sequence 10 和 11 的合法 fragments
- **THEN** engine MUST 按顺序追加两个 fragments
- **AND** entry 的可见位置 MUST 保持不变

#### Scenario: Sequence gap requests repair
- **WHEN** 已接受 sequence 10 后收到 sequence 12
- **THEN** engine MUST 不追加 sequence 12 fragment
- **AND** MUST 记录 gap 并请求 bounded repair

#### Scenario: Same revision conflicts
- **WHEN** 同 identity 收到相同 revision 但不同 eventId 或不同 fragment 内容
- **THEN** engine MUST 不把两个冲突 fragments 都追加
- **AND** MUST 记录 identity conflict 并请求 bounded repair

#### Scenario: Completed item replaces partial text
- **WHEN** live fragments 已形成 partial text
- **AND** completed item 返回非空权威全文
- **THEN** engine MUST 使用 completed text 完成该 identity
- **AND** snapshot 已覆盖的旧 fragments MUST 不再追加

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
