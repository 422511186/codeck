## Why

消息级 fork 在新 thread 上执行 rollback 失败时，会为 forked thread 请求 snapshot repair；当前代码使用原 thread 的 generation 填充 repair request。若 forked thread 的 `HistoryStamp.generation` 与原 thread 不同，repair key 和后续修复会绑定到错误 generation，可能导致 forked thread 无法按正确历史窗口恢复。

本变更用于确保 fork 后所有 rollback、失败恢复和 repair 请求都使用 fork-local 历史元数据。

## What Changes

- 修复 `forkFromMessage` rollback 失败恢复路径，使 forked thread repair 使用 `forkRollbackMetadata.historyStamp.generation`。
- 保留 fork 前失败和 fork-local 目标解析失败的失败关闭行为。
- 增加回归测试，覆盖原 thread 与 forked thread generation 不同时，fork rollback conflict 请求 repair 的 generation。
- 不改变 fork API、rollback API、普通 rewind 成功路径或 timeline 渲染样式。

## Capabilities

### New Capabilities

### Modified Capabilities

- `timeline-message-actions`: 收紧 fork rollback 失败恢复要求，确保 forked thread 的 repair/retry 元数据来自 fork-local history stamp，而不是原 thread。

## Impact

- 前端会话页：`src/app/threads/[threadId]/page.tsx` 的 `forkFromMessage` catch 路径。
- 测试：`tests/unit/web-thread-page.test.tsx` 增加 forked thread generation 与原 thread 不同时的 repair generation 回归用例。
- OpenSpec：更新 `timeline-message-actions` 中 fork-local metadata 相关要求。
