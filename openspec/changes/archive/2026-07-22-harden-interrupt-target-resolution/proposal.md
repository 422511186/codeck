## Why

Thread 页面在当前 `activeTurnId` 尚不可用时会把 `detail.lastTurnId` 当作中断目标；该字段可能仍指向上一轮已经结束的 turn，从而绕过后端对真实 active turn 的权威解析，导致中断错误对象或无法停止当前任务。

## What Changes

- 页面仅在 store 已知当前 active turn identity 时显式发送 `turnId`。
- active turn identity 未知时省略 `turnId`，由 gateway 的 active turn registry 权威解析；不使用历史 `lastTurnId` 猜测。
- 增加 stale `lastTurnId`、已知 active identity 和重复点击锁的页面回归测试。

## Capabilities

### New Capabilities

### Modified Capabilities

- `turn-interaction`: 明确客户端在 active identity 未知时不得把历史 `lastTurnId` 作为中断目标，必须让后端按当前 active registry 解析或稳定失败。

## Impact

- `src/app/threads/[threadId]/page.tsx` 的 `onInterrupt` 目标选择。
- `tests/unit/web-thread-page.test.tsx` 的中断行为回归测试。
- 不改变 interrupt HTTP API 或 app-server 协议；缺省 body 已由 route 支持。
