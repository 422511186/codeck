## 1. 中断目标回归测试

- [x] 1.1 在 `tests/unit/web-thread-page.test.tsx` 增加 active identity 缺失且 `lastTurnId` 过期时省略 `turnId` 的测试。
- [x] 1.2 保留并验证已知 `activeTurnId` 显式转发及重复点击锁语义。

## 2. 页面实现

- [x] 2.1 修改 `onInterrupt` 仅使用 store 的 `threadActiveTurnId`，未知时调用 `codex.interruptTurn(threadId)`。
- [x] 2.2 运行页面/route 定向测试、类型检查、OpenSpec 严格校验并复审错误恢复路径。
