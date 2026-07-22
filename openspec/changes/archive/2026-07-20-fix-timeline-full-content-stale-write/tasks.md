## 1. 回归测试

- [x] 1.1 在 `tests/unit/web-timeline.test.tsx` 增加失败优先测试：full-content 请求 pending 期间 entry `contentRef` 变更，旧响应晚到时不得更新 UI 或调用 `replaceOrAddEntry` 写回旧正文。
- [x] 1.2 确认正常 matching identity/contentRef 的 full-content 多 chunk 读取仍能完成并写回 store。

## 2. 修复实现

- [x] 2.1 在 `src/web/components/Timeline.tsx` 为 `TimelineRow.loadFullContent` 增加请求快照与当前 row identity 校验。
- [x] 2.2 在写回 store 前确认当前 thread 中仍存在同 entry id、turnId 和 `contentRef` 的目标 entry，过期则丢弃结果。

## 3. 验证

- [x] 3.1 运行 `npx vitest run tests/unit/web-timeline.test.tsx`。
- [x] 3.2 运行 `npm run typecheck`。
- [x] 3.3 运行 `openspec validate fix-timeline-full-content-stale-write --strict`。
