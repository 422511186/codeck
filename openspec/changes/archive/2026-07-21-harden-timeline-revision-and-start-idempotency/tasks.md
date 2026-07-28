## 1. 发送幂等回归测试

- [x] 1.1 在 `codex-turn-start-route` 增加旧 boot resolved cache、cache miss ambiguous retry、可变前置条件失效与 confirmed rejection 的失败优先测试，断言只做 bounded recovery/缓存复用且不再次 `turn/start`。
- [x] 1.2 在 `web-thread-page` 增加 ambiguous start 复用 identity/boot、成功清理临时错误、confirmed rejection 与已知终态失败创建新 identity 的测试。
- [x] 1.3 增加发送前 resume/审计失败的回归测试，断言未调用 `turn/start` 时归类为 rejected，且审计失败不阻断缓存命中或污染 operation。

## 2. 发送幂等实现

- [x] 2.1 扩展 Web `StartTurnInput` 和 thread page 发送状态，显式传递 `startBootId` 与 `retryAmbiguousStart`，按失败状态选择复用或创建 identity，并在恢复成功后清理临时错误。
- [x] 2.2 收紧 `turn/start` operation cache 的 boot 边界、cache miss recovery、迟到 promise 提交规则、mutable precondition 执行顺序与 confirmed rejection 清理语义。
- [x] 2.3 仅在真正调用 `codex.startTurn` 后把未知错误归为 ambiguous，并把审计纳入实际新 start 的 confirmed-rejection closure。

## 3. Full-content revision 测试与实现

- [x] 3.1 在 `app-server-runtime` 增加 item 在首次读取前及 continuation 前更新的失败优先测试，并保留相同 cursor 幂等测试。
- [x] 3.2 为 app-server item content source 增加正文 revision 指纹锁定和每次读取校验，revision 改变时返回 `repair-required/source-revision`。
- [x] 3.3 增加 app-server source 与 cursor 超限及 source eviction race 的失败优先测试，断言 source 淘汰同步清理 cursor 和反向索引。
- [x] 3.4 对两类 full-content source 统一执行过期/数量清理，对 cursor 和位置反向索引执行硬上限与成对删除。

## 4. 验证与复审

- [x] 4.1 运行定向 Vitest、`npm run typecheck` 和 `openspec validate harden-timeline-revision-and-start-idempotency --strict`。
- [x] 4.2 运行 `npm run verify`、`npm run build` 与 `openspec validate --all --strict`。
- [x] 4.3 重新审查发送、重试、full-content 和相邻 Timeline 合并路径，确认实现、测试和 OpenSpec 一致后决定归档与提交。
