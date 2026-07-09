## Why

消息级回滚目前可能在目标消息身份或尾部范围不可靠时继续调用 rollback，导致 `numTurns` 计算过大并把会话历史回滚到最前端。手机端新建会话后刷新时，如果首次 `readThread` 遇到刚创建空会话或未加载会话的瞬时错误，页面会直接进入加载失败状态，而桌面端常因内存缓存或后续访问看起来正常。

## What Changes

- 收紧消息级 rewind/fork 的执行前校验：必须能用当前 normalized entry 的稳定身份定位目标，并能证明目标 turn 到尾部的完整范围，否则失败关闭。
- 修正 rollback 成功后的客户端状态替换：服务端返回的有限历史不能被误标记为已经到达会话开头，避免旧历史看起来“整段丢失”。
- 增强手机刷新会话详情读取：刚创建或未 materialized 的空会话、短暂未加载会话应有限重试或恢复为空 timeline，而不是一次失败即显示错误页。
- 补充回归测试覆盖错误目标定位、分页窗口不完整、rollback 响应窗口和手机刷新读取失败恢复。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `timeline-message-actions`: 消息级 rewind/fork 的目标身份和尾部范围计算必须失败关闭，不能用文本 fallback 或不完整窗口猜测 rollback 范围。
- `thread-lifecycle`: rollback 返回详情与前端分页状态必须保持一致，有限窗口不能被误认为完整历史。
- `thread-chat-view`: 手机端刷新会话详情时，刚创建或未加载的会话必须有可恢复路径，避免直接进入不可用页面。

## Impact

- 前端会话页：`src/app/threads/[threadId]/page.tsx` 的 rewind/fork 校验、初始读取错误恢复和 rollback 后替换行为。
- Timeline 状态：`src/web/state/timeline.ts`、`src/web/state/timeline-engine.ts` 中 rollback metadata 计算需要接收范围可靠性信息。
- app-server client/gateway：`src/server/app-server/client.ts`、`src/server/app-server/runtime.ts` 中 read/rollback 后详情的分页语义与未 materialized 错误处理。
- 测试：补充 `tests/unit/web-thread-page.test.tsx`、`tests/unit/web-timeline-engine.test.ts`、`tests/unit/codex-client.test.ts` 或邻近测试。
