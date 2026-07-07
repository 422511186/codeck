## 1. 回归测试

- [x] 1.1 修改 `tests/unit/web-thread-page.test.tsx` 中 active repair fallback 相关用例，先验证当前实现会在 repair 返回 active 后继续触发 `requestSnapshotRepair`。
- [x] 1.2 补充测试：repair 返回 active 且仅有 user message 时，页面应用 snapshot 后不得再次安排 full-detail repair。
- [x] 1.3 补充测试：repair 返回 active 且已有部分 agent 输出时，页面应用 snapshot 后不得再次安排 full-detail repair。
- [x] 1.4 补充测试：`startTurn` 未返回 thread snapshot 且短暂等待后仍无可见服务端输出时，页面仍允许一次 snapshot repair。
- [x] 1.5 补充测试：`startTurn` 后当前 turn 已有可见服务端输出时，missing-output fallback 不得调用 `readThread` 或重新设置 repair。
- [x] 1.6 补充测试或保留现有覆盖：`timeline-gap` 仍会触发一次 snapshot repair，repair 成功后清除 repair 标记。

## 2. 实现修复

- [x] 2.1 调整 `src/app/threads/[threadId]/page.tsx` 的 repair effect，移除 repair 结果 active 时调用 `scheduleStartedTurnRepair(td.lastTurnId, false)` 的自循环。
- [x] 2.2 确认 `scheduleStartedTurnRepair` 只用于发送后 missing-output 兜底，并在已有可见输出、thread 已停止或 active turn 变化时退出。
- [x] 2.3 检查 `requestSnapshotRepair` / `clearSnapshotRepair` 调用路径，确保 epoch mismatch 仍会重新排队确认缺口，但 active snapshot 本身不会重新排队。
- [x] 2.4 确认 repair 期间的 `threadDetailEntriesWithTurnItems` 补全逻辑只在实际 repair 请求内运行，不被 timer 循环重复调用。

## 3. 验证与收尾

- [x] 3.1 跑 `openspec validate optimize-timeline-snapshot-repair --strict`，修正 spec 或 task 格式问题。
- [x] 3.2 跑 `npm run test -- tests/unit/web-thread-page.test.tsx`，确认会话页回归测试通过。
- [x] 3.3 跑 `npm run typecheck`，修正类型问题。
- [x] 3.4 跑 `npm run test`，确认完整测试套件通过。
- [x] 3.5 检查 `git diff`，确认改动范围聚焦于 OpenSpec、会话页 repair 行为和相关测试。
