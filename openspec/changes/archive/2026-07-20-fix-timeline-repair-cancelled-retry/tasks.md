## 1. 回归测试

- [x] 1.1 在 `tests/unit/web-thread-page.test.tsx` 增加失败优先的回归用例：snapshot repair pending 后页面卸载或切换 thread，旧请求以非 abort 错误失败时不得调用 `requestSnapshotRepair` 安排 retry。

## 2. 修复实现

- [x] 2.1 在 `src/app/threads/[threadId]/page.tsx` 的 snapshot repair effect `catch` 分支增加取消边界，确保 `cancelled` 后不再进入 retry 调度。
- [x] 2.2 确认当前有效 repair 的 completion persistence-lag retry 行为不变，避免误伤现有重试路径。

## 3. 验证

- [x] 3.1 运行 `npx vitest run tests/unit/web-thread-page.test.tsx`。
- [x] 3.2 运行 `npm run typecheck`。
- [x] 3.3 运行 `openspec validate fix-timeline-repair-cancelled-retry --strict`。
