## Context

顺序流逻辑分布在三处：前端 engine 的 `applyLiveDeltaInput`（delta 流校验）、`orderEntries`（排序）、`mergeSnapshotEntriesWithExistingContent`（快照合并）；前端 SSE 客户端的 bootId/epoch 处理；服务端 session 合并的 turnId 分块。各处对乱序、跨 generation、repair 的处理存在过于激进或遗漏场景的缺陷。

## Goals / Non-Goals

**Goals**
- 乱序 delta 不被永久丢弃，通过缓冲重排恢复。
- authoritative 事件后迟到 delta 不重复追加。
- 跨 sourceKind 排序稳定，live delta 不被排到错误位置。
- 非连续 turnId 不导致 supplement 记录重复或丢失。
- snapshot-window 不丢弃更高 generation 的 live entry。
- bootId 切换不丢失业务触发事件。
- deliveryEpoch 始终下发，epoch 校验不被绕过。
- revision 相等不触发 repair 风暴。
- batch 内混合输入按序号重排。

**Non-Goals**
- 不重写 fragmentSequence 为完全宽松的乱序接受（仍有超时 repair 兜底）。
- 不处理 Command 合并问题（归入 fix-timeline-command-merge-defects）。
- 不处理性能问题（归入另一变更）。
- 不包含已核实不成立的问题 14（insertOverlayTimelineItem turnId 非连续 filter 删除）。

## Decisions

### 决策 1：fragmentSequence 间隙缓冲重排

`applyLiveDeltaInput` 的 `fragmentSequence > currentSequence + 1` 分支改为：将 delta 暂存到 `pendingFragments: Map<sequenceKey, PendingFragment[]>`，启动超时计时器（如 2s）。当 `currentSequence + 1` 的 fragment 到达时按序应用并推进，同时检查 pending 中是否有连续的后续 fragment 一并应用。超时未填齐则触发 repair。

**理由**：原代码直接 return 丢弃乱序 fragment，网络抖动下内容永久丢失。缓冲重排在常见乱序场景下可恢复，超时 repair 兜底极端情况。

### 决策 2：suppression 前缀匹配

`shouldSuppressSnapshotDeltaReplay` 的 `maxSequence` 分支（L1146）改为：优先用 `remaining.startsWith(delta)` 前缀匹配；若需支持乱序，按 `eventSequence` 区间记录已覆盖段而非单一 offset。具体：当 `maxSequence` 存在时，校验 `coveredIndex === suppression.offset`，若 indexOf 命中位置不等于 offset 则视为未覆盖（返回 false 但不删除 suppression）。

**理由**：原 `indexOf` 允许跳跃匹配，offset 越过后早到分片无法再匹配前缀，被误判未覆盖而追加，导致文本重复。

### 决策 3：authoritative 增量更新 suppression

在 `applyEntryInputBatch` 处理 authoritative entry 后（`upsertEntryByIdIdentity` / `mergeEntry(authoritative=true)`），调用 `createSnapshotDeltaSuppressions` 增量更新该 itemId 的 suppression：以该 entry 的完整文本与 revision 构建 suppression 项。

**理由**：原代码仅在 snapshot-window 与 set-generation 重建 suppression，authoritative completed-item 后迟到 delta（无 revision 时跳过校验）走 appendDeltaEntry 追加到已完整文本，内容重复。

### 决策 4：orderEntries 跨 sourceKind 统一 ordinal

`orderEntries` 二级排序（L2108-2125）改为：当 leftOrder 与 rightOrder 都存在且 ordinal 不同时，直接比较 ordinal，不再要求 `sourceKind === sourceKind`。pagination 的 ordinal 按其页内 ordinal + 偏移参与比较。或在 entry 入态时（applyLiveDeltaInput L815）按 turn + ordinal 写入正确位置，而非末尾追加后依赖 orderEntries 重排。

**理由**：原代码跨 sourceKind 回退插入序，live delta 经 L815 追加到末尾后在同 turn 内排到最后，reasoning 片段可能跑到 agent 最终回复之后。

### 决策 5：mergeSessionTimelineRecords 按 turnId 合并 chunk

`mergeSessionTimelineRecords`（L1479-1497）改为：先按 turnId 把所有同 turn 的 baseItems 收集到一个 chunk（不要求连续），再调用 `mergeTurnSessionRecords`。或将 `usedToolIds` 提升为跨 chunk 共享的 `Map<turnId, Set<string>>`。

**理由**：原代码按连续 turnId 分块，非连续 turnId（A…B…A）形成多个 chunk，每个 chunk 各自调用 mergeTurnSessionRecords 且 usedToolIds 局部初始化，导致 supplement 工具记录重复插入。

### 决策 6：base 全无 turnId 时 fallback 插入 supplement

`mergeSessionTimelineRecords`（L1468-1487）在 while 循环结束后，若 `records` 仍有未消费项，按 `fallbackToolInsertIndex` 兜底插入（参考 L1430-1433 的 `matchedMessage=false` 分支）。

**理由**：原代码 base 全无 turnId 时只透传 push，从不调用 mergeTurnSessionRecords，会话补充的工具/skill 引用全部丢失。

### 决策 7：snapshot-window 保留更高 generation live entry

`mergeSnapshotEntriesWithExistingContent`（L1993-1997）改为：除 `snapshotEntries.map` 外，遍历 currentEntries，对不在 snapshot 中的 entry 按 generation 判断：若 `entry.generation > snapshotGeneration` 则保留并追加到结果末尾。

**理由**：原代码用 `snapshotEntries.map` 丢弃所有不在快照中的现有 entry，刚流式出来的回复瞬间消失。

### 决策 8：revision 相等先检查 eventId

`applyLiveDeltaInput` revision 相等分支（L698-700）改为：先检查 `input.eventId` 是否已在 `processedEventIds` 中，若已存在则静默丢弃（`droppedDuplicateEvents`）；若 eventId 不同则也静默丢弃（`droppedStaleRevisions`）而非触发 repair。同时记录 eventId 防止重放。统一 `applyEntryInputBatch` 与 `applyLiveDeltaInput` 的 revision 语义为：`<` 丢弃，`===` 静默丢弃（不 repair）。

**理由**：原代码 revision 相等即触发 repair 且不记录 eventId，重传反复触发 repair 风暴；两套 revision 语义不一致。

### 决策 9：bootId 切换不丢弃业务事件

SSE 客户端 `handleMessage`（L142-156）bootId 切换分支改为：emit timeline-gap 后，若触发事件是业务事件（非 timeline-gap），继续处理该事件而非 return。`clearPendingDeltaBatches` 改为只清当前 thread（或依赖后续 applyRepairBarrier 的 scope），不跨 thread 清空。

**理由**：原代码 return 丢弃触发事件，若该事件是 turn_completed 则 turn 永远停留进行中；clearPendingDeltaBatches 跨 thread 清空误伤其他 thread。

### 决策 10：deliveryEpoch 始终下发

`flushDeltaBatches`（L315）改为：始终下发 `deliveryEpoch` 字段（包括 0），或在 engine 侧对 `undefined` deliveryEpoch 视为"未知 epoch"走保守丢弃/repair 路径。

**理由**：原代码 `deliveryEpoch > 0 ? {deliveryEpoch} : {}` 对 epoch=0 不下发，engine 侧 `typeof !== "number"` 跳过校验，旧 epoch 的 stale delta 被应用。

### 决策 11：nextFragmentSequence key 纳入 bootId

`nextFragmentSequence`（runtime.ts L3615）的 key 改为 `${threadId}\u0000${bootId}\u0000${generation}\u0000${turnId}\u0000${itemId}\u0000${kind}`。

**理由**：原 key 不含 bootId，依赖"硬重启=Map 重置"隐式不变式，引入热重载/分片迁移后 fragmentSequence 会跨 bootId 串号。

### 决策 12：mergeOverlayItems role 不一致字段级合并

`mergeOverlayItems`（L344-347）role 不一致时改为：保留 current 的 `text`、`fileReferences`、`skillReferences` 等引用类字段作为 fallback，next 字段优先。

**理由**：原代码直接 return next 丢弃 current 全部字段，role 修正场景下 text/引用全丢。

### 决策 13：live-event-batch 内重排

`live-event-batch`（L323-326）的 reduce 路径改为：先按 `revision`/`fragmentSequence` 排序 inputs，再 reduce。或对 batch 内的 live-delta 与 authoritative input 做"先 authoritative 后 delta"的重排。

**理由**：原代码 batch 内顺序依赖到达序，delta 排在 completed-item 之后时追加到已完整文本导致重复。

## Risks / Trade-offs

- **fragmentSequence 缓冲重排引入 pendingFragments 状态**：增加 engine 状态复杂度，需保证超时清理与 repair 触发不重复。
- **orderEntries 统一 ordinal 可能改变现有稳定排序**：需保证 pagination ordinal 与 live ordinal 的偏移计算正确，避免引入新乱序。
- **snapshot-window 保留 live entry 可能导致 live 与 snapshot 并存**：需保证后续 repair 能收敛，避免长期双份。
- **bootId 切换补发业务事件可能引入重复**：需配合 eventId 去重。

## Migration Plan

- 所有改动向后兼容：新字段可选，旧事件走原路径。
- 缓冲重排、suppression 增量更新、revision 静默丢弃等变更不影响已稳定 entry。
- 无数据迁移。

## Open Questions

- fragmentSequence 缓冲重排的超时阈值（2s？3s？）需实测调整。
- orderEntries 统一 ordinal 后，pagination 的 ordinal 偏移如何计算（页号 × pageSize + 页内 ordinal？）需确认 pagination entry 是否携带页号信息。
