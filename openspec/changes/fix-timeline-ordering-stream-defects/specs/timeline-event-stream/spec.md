# timeline-event-stream Delta

## Modified Requirements

### Requirement: Out-of-order fragments are buffered for reorder before repair

当 `fragmentSequence` 出现间隙（`fragmentSequence > currentSequence + 1`）时，前端 MUST 将乱序 delta 暂存到 pending buffer，MUST NOT 立即丢弃或直接触发 repair。当缺失的 `currentSequence + 1` fragment 到达时，前端 MUST 按序应用缓冲中的连续后续 fragment。超过超时窗口仍未填齐时，前端 MUST 触发 repair。

#### Scenario: Out-of-order fragment is buffered not dropped

- **WHEN** fragment 3 先于 fragment 2 到达（currentSequence=1）
- **THEN** 前端 MUST 将 fragment 3 暂存到 pending buffer
- **AND** MUST NOT 立即 return 丢弃 fragment 3
- **AND** MUST NOT 立即触发 repair
- **AND** 当 fragment 2 到达后，前端 MUST 按序应用 fragment 2 与 fragment 3

#### Scenario: Buffer timeout triggers repair

- **WHEN** pending buffer 中存在未填齐的 fragment 超过超时窗口
- **THEN** 前端 MUST 触发 repair
- **AND** MUST 清理该 sequenceKey 的 pending buffer

#### Scenario: Late fragment after buffer timeout is deduped

- **WHEN** repair 已通过快照补齐某 itemId 的完整文本
- **AND** 随后收到该 itemId 早期乱序的 fragment
- **THEN** 前端 MUST 通过 suppression 或 revision 校验忽略该 fragment
- **AND** MUST NOT 再次追加

### Requirement: Snapshot delta suppression uses prefix match not jump match

`shouldSuppressSnapshotDeltaReplay` 在判断 delta 是否被快照文本覆盖时，MUST 使用前缀匹配（`remaining.startsWith(delta)`）或校验命中位置等于当前 offset，MUST NOT 使用 `indexOf` 跳跃匹配后只前进 offset。

#### Scenario: Early fragment after offset advanced does not falsely append

- **WHEN** 快照文本为 "ABCDE"，offset 已推进到 3
- **AND** 收到早到分片 "AB"（位于索引 0，已越过）
- **THEN** suppression MUST 视为未覆盖但不删除 suppression
- **AND** MUST NOT 因 `indexOf` 找不到而删除 suppression 并追加 "AB"
- **AND** 前端 MUST 通过缓冲重排或 repair 处理该早到分片

### Requirement: Authoritative entry incrementally updates suppression

处理 authoritative 事件（`completed-item` / `item_updated`）后，前端 MUST 增量更新该 itemId 的 `snapshotDeltaSuppressions`，MUST NOT 仅在 snapshot-window 与 set-generation 时重建 suppression。

#### Scenario: Late delta after completed-item is suppressed

- **WHEN** 前端已收到某 itemId 的 authoritative `completed-item` 事件（含完整文本）
- **AND** 随后收到迟到的该 itemId delta（无 revision 字段）
- **THEN** 前端 MUST 通过增量 suppression 忽略该 delta
- **AND** MUST NOT 走 appendDeltaEntry 追加到已完整文本

### Requirement: Service restart does not drop triggering business event

SSE 客户端检测到 bootId 切换时，MUST emit timeline-gap 信号，但 MUST NOT 丢弃触发该切换的业务事件本身（除非该事件就是 timeline-gap）。`clearPendingDeltaBatches` MUST 只清理受影响 thread 的 pending delta，MUST NOT 跨 thread 清空。

#### Scenario: turn_completed after restart is not dropped

- **WHEN** 服务端重启后前端收到的第一个事件是 `turn_completed`（携带新 bootId）
- **THEN** 客户端 MUST emit timeline-gap
- **AND** MUST 继续处理该 `turn_completed` 事件
- **AND** MUST NOT 因 return 丢弃该事件导致 turn 永远停留进行中

#### Scenario: clearPendingDeltaBatches does not cross-thread

- **WHEN** bootId 切换触发 clearPendingDeltaBatches
- **THEN** 系统 MUST 只清理受影响 thread 的 pending delta
- **AND** MUST NOT 清理未受 bootId 切换影响的其他 thread 的 pending delta

### Requirement: deliveryEpoch is always transmitted

`flushDeltaBatches` MUST 始终下发 `deliveryEpoch` 字段（包括 epoch=0），MUST NOT 对 epoch=0 省略该字段导致 engine 侧跳过 epoch 校验。

#### Scenario: Zero epoch is transmitted and validated

- **WHEN** 某 thread 的 deliveryEpoch 为 0（从未被 invalidateThread）
- **AND** flushDeltaBatches 下发该 thread 的 delta batch
- **THEN** 下发的 event MUST 携带 `deliveryEpoch: 0`
- **AND** engine 侧 MUST 对该 epoch 执行校验

#### Scenario: Stale epoch delta is rejected

- **WHEN** 某 thread 已被 invalidateThread bump 到 epoch=2
- **AND** 随后收到 epoch=0 的 delta
- **THEN** engine MUST 通过 epoch 校验丢弃该 delta
- **AND** MUST NOT 因 epoch 字段缺失而放行

### Requirement: nextFragmentSequence key includes bootId

服务端 `nextFragmentSequence` 的 key MUST 包含 `bootId`，显式表达"bootId 切换即重置 fragmentSequence 计数"。

#### Scenario: Soft reload resets fragmentSequence per bootId

- **WHEN** 服务端发生软重启（bootId 变化但进程不退出、Map 不重置）
- **THEN** 新 bootId 下的 fragmentSequence MUST 从 1 重新计数
- **AND** MUST NOT 沿用旧 bootId 的计数继续递增

### Requirement: live-event-batch reorders inputs by sequence

`live-event-batch` 处理混合输入类型时，MUST 先按 `revision`/`fragmentSequence` 排序 inputs 再 reduce，MUST NOT 纯依赖到达序。

#### Scenario: Delta after completed-item in batch does not duplicate

- **WHEN** 一个 batch 内同时含 `completed-item` 与 `live-delta`
- **AND** batch 内 delta 排在 completed-item 之后到达
- **THEN** 处理时 MUST 先应用 completed-item（authoritative）
- **AND** 随后 delta MUST 通过 suppression 或 revision 校验被忽略
- **AND** MUST NOT 追加到已完整文本导致重复

### Requirement: Revision equality deduplicates silently without repair storm

当 `revision === currentRevision` 时，前端 MUST 先检查 eventId 是否已处理，若已处理则静默丢弃；若 eventId 不同也静默丢弃，MUST NOT 触发 repair。`applyLiveDeltaInput` 与 `applyEntryInputBatch` 的 revision 校验语义 MUST 一致。

#### Scenario: Same revision different eventId does not trigger repair

- **WHEN** 前端已处理 revision=N 的事件
- **AND** 随后收到 revision=N 但 eventId 不同的事件（服务端重发）
- **THEN** 前端 MUST 静默丢弃该事件
- **AND** MUST NOT 触发 repair
- **AND** MUST 记录 eventId 防止再次重放触发 repair

#### Scenario: Revision validation is consistent across paths

- **WHEN** 同一逻辑事件分别经 live-delta 与 live-event-batch 路径到达
- **THEN** 两条路径的 revision 校验语义 MUST 一致
- **AND** 相等 revision 都 MUST 静默丢弃，不得一条触发 repair 一条静默

### Requirement: Overlay role mismatch preserves current reference fields

`mergeOverlayItems` 在 `current.role !== next.role` 时 MUST 做字段级合并，保留 current 的 `text`、`fileReferences`、`skillReferences` 等引用类字段作为 fallback，MUST NOT 直接返回 next 丢弃 current 全部字段。

#### Scenario: Role correction preserves current text and references

- **WHEN** overlay 中某 item 先标 `reasoning` 后改 `agent`
- **THEN** 合并后 MUST 保留 current 的 text 作为 fallback
- **AND** MUST 保留 current 的 fileReferences/skillReferences
- **AND** next 字段优先，current 字段作为 fallback
