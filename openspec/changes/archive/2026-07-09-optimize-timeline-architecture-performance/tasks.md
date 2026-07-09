## 1. 测试基线与诊断钩子

- [x] 1.1 在 `tests/unit/app-server-session-timeline.test.ts` 和 runtime 邻近测试中新增红灯用例，证明 oversize rollout supplement 不会完整读取/解析并且主 timeline 仍返回。
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 或新增 engine 测试中建立多来源合并预算，覆盖 snapshot、live delta、turn item detail、overlay、rollout supplement 和 optimistic user。
- [x] 1.3 在 `tests/unit/web-timeline.test.tsx` 中新增可回收 viewport 红灯用例，证明长时间上下滚动后 `[data-timeline-row='true']` 数量保持有界。
- [x] 1.4 在 card/Timeline 邻近测试中新增长 diff、tool result、Markdown 和 activity detail 派生缓存用例，证明 unrelated update 不重复处理完整大文本。
- [x] 1.5 在 `tests/unit/web-thread-page.test.tsx` 中新增订阅隔离用例，证明 timeline delta/repair 不重置 composer 草稿、Skill/图片选择或打开中的 sheet/dialog。

## 2. 服务端 rollout supplement 有界化

- [x] 2.1 抽出 rollout supplement scanner，支持按 `allowedTurnIds`、最大行数、最大字节数、最大记录数和耗时预算扫描。
- [x] 2.2 调整 `runtime.ts` 的 `readSessionJsonl` / supplement 调用路径，避免默认把完整 rollout 文件读成字符串再传入 `mergeSessionTimelineItems`。
- [x] 2.3 将 context usage 获取改为 live/cache/summary/尾部有界扫描优先，预算耗尽时返回空用量或缓存值而不是阻塞 thread detail。
- [x] 2.4 保留现有 `mergeSessionTimelineItems` 的窗口内 activity 合并语义，并增加 oversize/unsupported 路径的静默降级。
- [x] 2.5 更新相关测试，覆盖窗口外记录不消耗预算、分页只补当前 page turns、主 timeline 在 supplement 跳过时仍可渲染。

## 3. Timeline engine 收敛

- [x] 3.1 扩展 `timeline-engine.ts` 的输入类型、identity key、order key、diagnostics 和索引能力，使 snapshot/page/live/overlay/supplement/turn item/optimistic user 共用 reducer。
- [x] 3.2 将 `setThreadEntries`、`mergeThreadEntries`、`prependEntries`、`appendEntries`、`replaceOrAddEntry` 和 `appendTextToEntry` 内部迁移为构造 `TimelineInput` 后提交 engine。
- [x] 3.3 移除或降级 store 中重复的 `normalizeTimelineEntries`、`mergeEquivalentOutputEntries`、旧排序和文本相似主路径，只保留受限 fallback。
- [x] 3.4 将 completion visible-output 判定、compact completion 派生状态、ordered distinct turns 和 rewind/fork 所需元数据改为使用 engine/index 派生结果。
- [x] 3.5 确保 processed event id、revision、snapshot suppression、deleted-turn barrier 和 generation 隔离在 engine 中统一维护，并通过现有回归测试验证。

## 4. Event stream 与 repair 边界

- [x] 4.1 调整 SSE delta batcher，使 pending batch 在 flush 前重新校验 generation、snapshot suppression、deleted turn 和 repair barrier。
- [x] 4.2 确保 listener 空窗 overflow 只为可确定 `threadId` 的事件产生 repair request，无法归属时非破坏性降级。
- [x] 4.3 收紧 snapshot repair request 去重和重试逻辑，避免 active repair 返回 active 后循环触发 full detail repair。
- [x] 4.4 将 turn item detail、snapshot repair 和 page helper 中的 activity 重排逻辑迁移到 engine/adapter，页面层不再自行按 createdAt 或 role 重排。
- [x] 4.5 补充测试覆盖 repair 先于 batch flush、rollback 删除 pending batch、visible tool/reasoning/activity completion 不触发多余 repair。

## 5. 会话页订阅与 viewport 回收

- [x] 5.1 拆薄 `ThreadPage` timeline 相关订阅，提取 timeline viewport、repair coordinator 或 adapter helper，确保各组件订阅最小 store slice。
- [x] 5.2 实现或接入动态高度 recycled viewport，维护顶部/底部 spacer、row height cache、prepend scroll anchor 和 jump-to-latest 行为。
- [x] 5.3 保持审批卡、图片预览、用户消息长按菜单、composer safe-bottom 和 plan 执行按钮在 recycled viewport 下行为稳定。
- [x] 5.4 替换当前只扩不回收的 `MAX_INITIAL_TIMELINE_ROWS` 窗口逻辑，确保滚动离开 buffer 的 rows 会卸载。
- [x] 5.5 更新 timeline rendering 测试，覆盖初始尾部、向上分页、向下返回、live delta 不抢滚动和跳到最新。

## 6. 长输出派生缓存与渲染预算

- [x] 6.1 为 Markdown、diff rows、LongTextPreview、activity sections 和 inline activity detail 建立 entry identity keyed cache 或等价 memo helper。
- [x] 6.2 确保 live agent/tool/reasoning output 在 running 阶段继续使用轻量纯文本或有界 preview，稳定后才按可见性调度 Markdown/diff/preview 重渲染。
- [x] 6.3 避免缓存完整大文本副本；缓存只保存派生摘要、hash、rows 或状态，并保留复制完整输出的原始数据路径。
- [x] 6.4 补充测试证明 unrelated timeline update 不重新派生长 diff/tool/Markdown，文本变化或 generation/revision 变化会正确失效。

## 7. 验证与收尾

- [x] 7.1 运行 timeline 相关单元测试：`npm run test -- tests/unit/web-timeline-engine.test.ts tests/unit/web-store-events.test.ts tests/unit/web-events-client.test.ts tests/unit/web-timeline.test.tsx tests/unit/web-thread-page.test.tsx tests/unit/app-server-session-timeline.test.ts`。
- [x] 7.2 运行 `npm run typecheck`。
- [x] 7.3 运行 `openspec status --change "optimize-timeline-architecture-performance"`，确认 artifacts 和 tasks 可被 apply 阶段识别。
- [x] 7.4 如时间和环境允许，运行 `npm run verify`；若未运行，记录原因和已完成的替代验证。
- [x] 7.5 更新 `docs/testing.md` 中 timeline 性能验证指标，记录新的 supplement、engine、viewport 和长输出派生预算。
