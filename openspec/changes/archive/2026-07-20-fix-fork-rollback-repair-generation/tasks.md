## 1. 回归测试

- [x] 1.1 在 `tests/unit/web-thread-page.test.tsx` 增加失败优先用例：原 thread 与 forked thread generation 不同时，fork rollback 可恢复失败后的 `requestSnapshotRepair` 必须使用 fork-local generation。

## 2. 修复实现

- [x] 2.1 调整 `src/app/threads/[threadId]/page.tsx` 的 `forkFromMessage` 失败恢复路径，使 forked thread repair generation 来自 `forkRollbackMetadata.historyStamp.generation`。
- [x] 2.2 确认 fork-local target 解析失败、普通 rewind rollback 失败和成功 fork rollback 路径行为不变。

## 3. 验证

- [x] 3.1 运行 `npx vitest run tests/unit/web-thread-page.test.tsx`。
- [x] 3.2 运行 `npm run typecheck`。
- [x] 3.3 运行 `openspec validate fix-fork-rollback-repair-generation --strict`。
