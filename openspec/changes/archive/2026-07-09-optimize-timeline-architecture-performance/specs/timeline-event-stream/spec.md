## ADDED Requirements

### Requirement: Timeline inputs are reduced through a single engine
客户端 SHALL 将 snapshot window、pagination page、live event、live event batch、overlay item、turn item detail、rollout supplement item、optimistic user item 和 rollback/fork replace 转换为统一 timeline input，并通过同一个 timeline engine reducer 产生 normalized entries。系统 MUST NOT 在 store action、page helper 或 render component 中保留另一套独立的可见输出去重、排序、等价合并或 generation 屏障逻辑。

#### Scenario: Snapshot and live item share identity path
- **WHEN** 同一 agent/reasoning/tool 输出先通过 live delta 显示
- **AND** 后续 snapshot repair、turn item detail 或 rollout supplement 返回同一输出
- **THEN** 所有来源 MUST 通过同一 identity/upsert 规则合并为一个 normalized entry
- **AND** timeline MUST 不显示重复 activity、重复 agent message 或重复 compact/system message

#### Scenario: Store action does not normalize twice
- **WHEN** store 处理一次 live delta batch 或 snapshot window
- **THEN** store action MUST 只构造 timeline input 并提交 engine
- **AND** MUST NOT 先执行一套旧 normalize/sort/merge 再把结果交给 engine 重新 normalize

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
