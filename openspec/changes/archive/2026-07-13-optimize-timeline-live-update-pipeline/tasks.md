## 1. 性能基线与回归测试

- [x] 1.1 在 `tests/unit/web-timeline-engine.test.ts` 增加 1200+ entries 下连续 delta 的 diagnostics 红灯测试，断言当前路径的 normalization、entry visits 和 index rebuild 次数
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 增加 `codex-event-batch` 提交次数测试，覆盖同 thread 多 delta、跨 item delta、重复 eventId 和控制事件 barrier
- [x] 1.3 增加缺少 itemId 的连续 turns、snapshot repair 后 event replay、rollback generation 后复用 itemId 的去重回归测试
- [x] 1.4 在 `tests/unit/web-timeline.test.tsx` 增加未变化 row、inline activity block 和长 diff/Markdown 派生次数测试

## 2. 持久化 Timeline Engine State

- [x] 2.1 调整 `ThreadState`，持久化 timeline engine entries、indexes、generation、deleted-turn barriers、processed event ledger、revision ledger 和 diagnostics
- [x] 2.2 将 `setThreadEntries`、`mergeThreadEntries`、`prependEntries`、repair replace 与 rollback/fork replace 迁移为直接提交持久化 `TimelineInput`
- [x] 2.3 移除或收敛 store 中重复的 normalize、sort、identity merge 和 index rebuild 路径，确保 entries 与 indexes 只由 engine 更新
- [x] 2.4 增加 engine/store invariant 测试，验证 snapshot、pagination、repair 和 rollback/fork 后 indexes、turn order 与 entries 一致

## 3. 增量 Upsert 与事件批处理

- [x] 3.1 在 `timeline-engine.ts` 实现 identity/order 不变时的单 entry 增量 upsert，并保持未变化 entries 的对象引用
- [x] 3.2 为新增 entry、turnId 补齐、optimistic user 确认、live→completed 合并和 generation 变化实现保守的结构性路径回退
- [x] 3.3 将 `codex-event-batch` 改为按 thread 分组、逐事件校验、一次 `live-event-batch` engine reduce 和至多一次可见 store 提交
- [x] 3.4 实现同 item 短窗口 delta 聚合与 flush epoch，确保 `timeline-gap`、repair、turn lifecycle、rollback/fork 和审批事件形成正确 barrier
- [x] 3.5 扩展 diagnostics，记录 fast-path commits、structural normalizations、index rebuild entries、batch flush、barrier revalidation 和丢弃原因

## 4. Identity 与 Ledger 加固

- [x] 4.1 将缺少 itemId 的 agent、reasoning 和 tool fallback identity 限定到 `threadId + generation + turnId + kind`，移除跨 turn 的 thread-only live id
- [x] 4.2 对缺少 turnId 且无法证明归属的可见 delta 使用 bounded repair 或保守丢弃，并增加 thread ownership 测试
- [x] 4.3 将 processed event 和 revision ledger 改为按 generation 分段的有界保留策略，snapshot repair 不清空当前 generation 幂等信息
- [x] 4.4 验证 rollback/fork 后新 generation 合法复用 itemId，同时旧 generation late event 和 deleted-turn pending batch 被拒绝
- [x] 4.5 验证 optimistic user、snapshot user item 和 server-confirmed user item 在 clientUserMessageId 缺失或延迟补齐时不会重复显示

## 5. Timeline 渲染隔离

- [x] 5.1 让 Timeline render blocks、row state 和 activity sections 只基于当前窗口及稳定派生 key 计算，避免每次 delta 扫描完整 entries
- [x] 5.2 使用 `React.memo` 或等价边界隔离 `TimelineRow`、inline activity block 与昂贵内容组件，并稳定相关回调引用
- [x] 5.3 确保 engine 快路径保留未变化 entry 引用，使无关 delta 不使 Markdown、diff、tool preview、reasoning preview 和 activity detail 缓存失效
- [x] 5.4 验证 running、approval、context usage、窗口滚动和消息操作状态变化不会造成 stale row，也不会重算无关长输出

## 6. 验证与文档一致性

- [x] 6.1 运行 timeline 定向 Vitest：engine、store events、events client、thread page、timeline rendering 和 adapter 测试
- [x] 6.2 运行 `npm run typecheck` 与 `npm run test`，记录并区分与本变更无关的既有失败
- [x] 6.3 运行 `openspec validate optimize-timeline-live-update-pipeline --strict`，修正 artifact 或 scenario 格式问题
- [x] 6.4 对比 diagnostics 预算，确认 1200+ entries 与 200 delta 场景不再逐 delta 全量 normalize/index rebuild，且一个协议 batch 对同 thread 至多一次可见提交

## 7. 架构复核补救

- [x] 7.1 增加 `TimelineEventStreamClient -> store -> timeline engine` 真实入口测试，覆盖交错 A1/B1/A2 顺序、单次 store commit 和结构性 normalization 预算
- [x] 7.2 为 timeline engine 增加原生 `live-delta` 输入与文本追加快路径，保留每条 eventId、revision、sequence、generation 和 sourceOrder
- [x] 7.3 将事件客户端 pending delta 结构改为按 thread 的有序队列，去重时不得按 item regroup 改变原始到达顺序
- [x] 7.4 删除 store 内 `applyCodexDeltaBatch` 的 entries 复制、临时索引和文本拼接，仅转换并提交有序 `live-event-batch`
- [x] 7.5 为 snapshot、pagination、turn item detail、overlay、supplement 和 live event 建立统一 sourceOrder/orderKey，并移除 adapter 的 activity 移动与 `createdAt` 重写
- [x] 7.6 增加同一 fixture 的 realtime 与 refresh snapshot 差分测试，断言可见 identity 顺序、文本和去重结果一致
- [x] 7.7 完成定向/完整验证后再次请求独立 subagent 架构复核，只有 PASS 后才归档 change
