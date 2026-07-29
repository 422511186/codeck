## Why

Timeline 顺序流逻辑存在多处已核实缺陷，导致消息在网络抖动、bootId 切换、repair、分页、跨 generation 等场景下出现丢失、重复、乱序、repair 风暴。根因集中在五处：

1. `fragmentSequence` 严格递增校验过于激进，乱序到达的合法 delta 被永久丢弃且不记录 eventId。
2. `shouldSuppressSnapshotDeltaReplay` 的 `indexOf` 跳跃匹配导致后续 delta 误判未覆盖而重复追加。
3. authoritative `completed-item` 路径不重建 `snapshotDeltaSuppressions`，迟到 delta 直接追加导致内容重复。
4. `orderEntries` 跨 `sourceKind` 回退插入序，live delta 被追加到数组末尾后在同 turn 内排到错误位置。
5. `mergeSessionTimelineRecords` 按连续 turnId 分块，非连续 turnId 形成多 chunk 导致 supplement 工具记录重复插入；base 全无 turnId 时静默丢弃所有 supplement records。
6. `mergeSnapshotEntriesWithExistingContent` 用 `snapshotEntries.map` 丢弃所有不在快照中的现有 live entry。

所有问题均已通过逐行核实确认存在（16 项中 12 项完全成立、3 项部分成立但核心结论成立、1 项不成立已剔除）。

注：原分析中的"问题 14：insertOverlayTimelineItem 对 turnId 非连续时 filter 删除后半段"经核实**不成立**——实际代码循环不 break，lastTurnIndex 取全局最后命中，filter 实为 no-op，非连续同 turnId 项被吸收进 turnItems 而非删除。本变更不包含该问题。

## What Changes

- 将 `fragmentSequence` 间隙检测从"丢弃 + repair"降级为"缓冲重排"，乱序 delta 暂存到 pending buffer，超时后再触发 repair。
- 修复 `shouldSuppressSnapshotDeltaReplay` 的 `indexOf` 跳跃匹配：`maxSequence` 分支也使用前缀匹配或校验 `coveredIndex === offset`。
- 在 authoritative `completed-item` 路径调用 `createSnapshotDeltaSuppressions` 增量更新该 itemId 的 suppression。
- 修复 `orderEntries` 跨 `sourceKind` 排序：统一比较 ordinal，或在 entry 入态时按 turn + ordinal 写入正确位置。
- 修复 `mergeSessionTimelineRecords` 非连续 turnId 重复分块：先按 turnId 合并所有同 turn baseItems 到一个 chunk，或将 `usedToolIds` 提升为跨 chunk 共享。
- 修复 `mergeSessionTimelineRecords` base 全无 turnId 时静默丢弃 supplement records：提供 fallback 插入。
- 修复 `mergeSnapshotEntriesWithExistingContent` 丢弃 live entry：保留 currentEntries 中 generation > snapshot generation 的 entry。
- 修复 `revision === currentRevision` 即触发 repair 且不记录 eventId：先检查 eventId 是否已处理，eventId 不同则静默丢弃。
- 统一 `applyLiveDeltaInput` 与 `applyEntryInputBatch` 的 revision 校验语义。
- 修复 SSE 客户端 bootId 切换时丢弃触发事件本身：仅在事件为 timeline-gap 时不 return，业务事件应补发。
- 修复 `flushDeltaBatches` 对 `deliveryEpoch===0` 不下发 epoch 元数据：始终下发 deliveryEpoch。
- 修复 `nextFragmentSequence` 的 key 纳入 bootId，显式表达"bootId 切换即重置计数"。
- 修复 `mergeOverlayItems` role 不一致时直接 return next 丢失 current 字段：做字段级合并。
- 修复 `live-event-batch` 混合输入无重排：batch 内按 revision/fragmentSequence 排序再 reduce。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`：明确 fragmentSequence 间隙应缓冲重排而非丢弃；明确 authoritative 路径需增量更新 suppression；明确 bootId 切换不应丢弃业务触发事件；明确 deliveryEpoch 必须始终下发。
- `timeline-message-actions`：明确跨 sourceKind 排序应统一 ordinal；明确非连续 turnId 不得导致 supplement 记录重复或丢失；明确 snapshot-window 不得丢弃更高 generation 的 live entry。

## Impact

- 前端合并引擎：`src/web/state/timeline-engine.ts`（`applyLiveDeltaInput`、`shouldSuppressSnapshotDeltaReplay`、`createSnapshotDeltaSuppressions`、`orderEntries`、`mergeSnapshotEntriesWithExistingContent`、`applyEntryInputBatch`、`live-event-batch`）。
- 前端 SSE 客户端：`src/web/events/client.ts`（`handleMessage`、`flushDeltaBatches`、`clearPendingDeltaBatches`）。
- 服务端 session 合并：`src/server/app-server/session-timeline.ts`（`mergeSessionTimelineRecords`、`mergeTurnSessionRecords`）。
- 服务端 overlay：`src/server/app-server/runtime.ts`（`nextFragmentSequence`、`mergeOverlayItems`）。
- 补充单元测试覆盖：乱序 delta 缓冲重排、suppression 前缀匹配、authoritative 增量 suppression、跨 sourceKind 排序、非连续 turnId、snapshot-window 保留 live、revision 相等静默丢弃、bootId 切换补发业务事件、epoch=0 下发、batch 重排。
- 不改变公开 API；不引入新的全量 timeline 读取。
