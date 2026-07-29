# Tasks

## 1. fragmentSequence 间隙缓冲重排

- [ ] 1.1 在 `src/web/state/timeline-engine.ts` engine state 增加 `pendingFragments: Map<sequenceKey, PendingFragment[]>`
- [ ] 1.2 修改 `applyLiveDeltaInput`（L722-734）间隙分支：暂存 delta 到 pendingFragments，启动超时计时器（2s），不立即 return
- [ ] 1.3 增加 `flushPendingFragments(sequenceKey)`：当 currentSequence+1 的 fragment 到达时按序应用并推进，连带应用连续后续 fragment
- [ ] 1.4 增加超时处理：超时未填齐触发 repair，清理该 sequenceKey 的 pendingFragments
- [ ] 1.5 补充单元测试：fragment 3 先于 2 到达 → 缓冲，2 到达后按序应用 2、3
- [ ] 1.6 补充单元测试：超时未填齐 → 触发 repair，清理 pending
- [ ] 1.7 补充单元测试：repair 后迟到 fragment 通过 suppression 忽略

## 2. suppression 前缀匹配

- [ ] 2.1 修改 `shouldSuppressSnapshotDeltaReplay`（L1146）：`maxSequence` 分支校验 `indexOf` 命中位置 === offset，不等于则视为未覆盖但不删除 suppression
- [ ] 2.2 或改用 `remaining.startsWith(delta)` 前缀匹配替代 indexOf
- [ ] 2.3 补充单元测试：offset=3 + 早到分片 "AB" → 视为未覆盖但不删除 suppression，不追加
- [ ] 2.4 补充单元测试：正常连续 delta → 前缀匹配命中并推进 offset

## 3. authoritative 增量更新 suppression

- [ ] 3.1 在 `applyEntryInputBatch` 处理 authoritative entry 后，调用 `createSnapshotDeltaSuppressions` 增量更新该 itemId 的 suppression
- [ ] 3.2 补充单元测试：completed-item 后迟到 delta → 被 suppression 忽略，不追加

## 4. orderEntries 跨 sourceKind 统一 ordinal

- [ ] 4.1 修改 `orderEntries`（L2108-2125）二级排序：当 leftOrder 与 rightOrder 都存在且 ordinal 不同时，直接比较 ordinal，不要求 sourceKind === sourceKind
- [ ] 4.2 处理 pagination 分支（L2119）：按页内 ordinal + 偏移参与比较，不排除
- [ ] 4.3 或在 entry 入态时（applyLiveDeltaInput L815）按 turn + ordinal 写入正确位置
- [ ] 4.4 补充单元测试：同 turn 内 live delta（ordinal=2）排在 snapshot entries（ordinal=1,3）之间
- [ ] 4.5 补充单元测试：pagination entry 按 ordinal+偏移排在正确位置

## 5. mergeSessionTimelineRecords 非连续 turnId 合并 chunk

- [ ] 5.1 修改 `mergeSessionTimelineRecords`（L1479-1497）：先按 turnId 把所有同 turn baseItems 收集到一个 chunk，再调用 mergeTurnSessionRecords
- [ ] 5.2 或将 usedToolIds 提升为跨 chunk 共享的 `Map<turnId, Set<string>>`
- [ ] 5.3 补充单元测试：baseItems=[A,B,A] → 两段 A 合并到一个 chunk，supplement 工具只插入一次

## 6. base 全无 turnId 时 fallback 插入 supplement

- [ ] 6.1 修改 `mergeSessionTimelineRecords`（L1468-1487）：while 循环结束后，若 records 仍有未消费项，按 fallbackToolInsertIndex 兜底插入
- [ ] 6.2 补充单元测试：base 全无 turnId + records 含工具补充 → fallback 插入 supplement records，不静默丢弃

## 7. snapshot-window 保留更高 generation live entry

- [ ] 7.1 修改 `mergeSnapshotEntriesWithExistingContent`（L1993-1997）：snapshotEntries.map 后遍历 currentEntries，对不在 snapshot 中的 entry 若 generation > snapshotGeneration 则保留并追加到结果末尾
- [ ] 7.2 补充单元测试：currentEntries 含 generation=2 live agent-message + snapshot generation=1 未覆盖 → 保留 live entry
- [ ] 7.3 补充单元测试：snapshot generation=2 ≥ current → 按现有语义替换，不引入双份

## 8. revision 相等先检查 eventId + 统一 revision 语义

- [ ] 8.1 修改 `applyLiveDeltaInput`（L698-700）：revision 相等时先检查 eventId 是否已处理，已存在则静默丢弃（droppedDuplicateEvents），eventId 不同也静默丢弃（droppedStaleRevisions），不触发 repair
- [ ] 8.2 记录 eventId 到 processedEventIds 防止再次重放
- [ ] 8.3 统一 `applyEntryInputBatch`（L1283-1290）与 applyLiveDeltaInput 的 revision 语义为：`<` 丢弃，`===` 静默丢弃（不 repair）
- [ ] 8.4 补充单元测试：同 revision 不同 eventId → 静默丢弃，不触发 repair
- [ ] 8.5 补充单元测试：同逻辑事件经 live-delta 与 live-event-batch 路径 → revision 校验语义一致

## 9. bootId 切换不丢弃业务事件 + 跨 thread 清理修复

- [ ] 9.1 修改 `src/web/events/client.ts` `handleMessage`（L142-156）：emit timeline-gap 后，若触发事件是业务事件（非 timeline-gap）则继续处理而非 return
- [ ] 9.2 修改 `clearPendingDeltaBatches`：只清理受影响 thread 的 pending delta，不跨 thread 清空（或依赖 applyRepairBarrier 的 scope）
- [ ] 9.3 补充单元测试：bootId 切换后首个事件是 turn_completed → emit timeline-gap 后继续处理 turn_completed
- [ ] 9.4 补充单元测试：clearPendingDeltaBatches 不清理未受影响 thread 的 pending delta

## 10. deliveryEpoch 始终下发

- [ ] 10.1 修改 `flushDeltaBatches`（L315）：始终下发 `deliveryEpoch` 字段（包括 0），或改为 `deliveryEpoch !== undefined ? {deliveryEpoch} : {}`
- [ ] 10.2 验证 engine 侧对 deliveryEpoch=0 执行校验，不因 typeof !== "number" 跳过
- [ ] 10.3 补充单元测试：epoch=0 → 下发 deliveryEpoch:0，engine 执行校验
- [ ] 10.4 补充单元测试：epoch=0 已 stale（thread 已 bump 到 2）→ engine 通过 epoch 校验丢弃

## 11. nextFragmentSequence key 纳入 bootId

- [ ] 11.1 修改 `src/server/app-server/runtime.ts` `nextFragmentSequence`（L3615）key：加入 bootId 维度
- [ ] 11.2 补充单元测试：软重启（bootId 变化）→ fragmentSequence 从 1 重新计数

## 12. mergeOverlayItems role 不一致字段级合并

- [ ] 12.1 修改 `mergeOverlayItems`（L344-347）：role 不一致时保留 current 的 text/fileReferences/skillReferences 作为 fallback，next 字段优先
- [ ] 12.2 补充单元测试：role 从 reasoning 改 agent → 保留 current text/references 作为 fallback

## 13. live-event-batch 内重排

- [ ] 13.1 修改 `live-event-batch`（L323-326）：先按 revision/fragmentSequence 排序 inputs 再 reduce，或对 batch 内 authoritative 与 delta 做"先 authoritative 后 delta"重排
- [ ] 13.2 补充单元测试：batch 内 delta 排在 completed-item 之后 → 先应用 completed-item，delta 被忽略，不重复追加

## 14. 验证与回归

- [ ] 14.1 运行 `npm run typecheck`
- [ ] 14.2 运行 `npm run test`
- [ ] 14.3 运行 `npm run verify`
- [ ] 14.4 人工验证：网络抖动场景下消息不丢失不重复；bootId 切换后 turn 状态正确收敛
