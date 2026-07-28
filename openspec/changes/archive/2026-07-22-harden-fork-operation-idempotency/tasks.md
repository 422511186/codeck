## 1. Fork 幂等回归测试

- [x] 1.1 在 `codex-thread-model-lifecycle-routes` 增加 operation identity 并发复用、resolved cache 重试、cache miss/已知 ambiguous fail-closed 与前置拒绝清理测试。
- [x] 1.2 在 `web-thread-page` 增加首次 Fork 发送 identity、响应未知后复用 identity/retry 标记、fork 已完成后复用 rollback operationId、成功清理和 confirmed rejection 新 action 测试。
- [x] 1.3 在 `codex-rollback-route` 增加 conflict/repair-exhausted 二次审计失败仍保留结构化 409 的回归测试。
- [x] 1.4 在 `web-thread-page` 增加 pending/ambiguous fork、resolved fork/rollback 重挂载恢复 identity，以及旧 attempt 迟到回调不覆盖新结果的测试。
- [x] 1.5 在 `app-server-runtime` 增加 rollback 响应丢失后同 operation 重试返回 `ROLLBACK_UNRESOLVED` 且不重复调用 app-server 的测试。

## 2. Fork API 与状态实现

- [x] 2.1 扩展 Web fork endpoint/client 输入，解析 `operationId` 与 `retryAmbiguousFork`，保持旧请求兼容。
- [x] 2.2 为 fork route 增加有界 operation cache、并发 promise 复用、resolved result 复用和 ambiguous fail-closed 响应；明确审计前置拒绝清理 cache。
- [x] 2.3 在消息级 Fork page 保存稳定 fork/rollback operation identity，按错误阶段选择 retry ambiguous、复用 resolved fork 或创建新 action，并保持原 thread/fork rollback 隔离。
- [x] 2.4 使 rollback 终态二次审计失败不遮蔽原 conflict/repair-exhausted 响应。
- [x] 2.5 将 fork action 阶段和 identity 同步到当前 tab session storage，从 session 恢复 pending 时按 ambiguous 处理，以最新 attempt 所有权隔离卸载后的迟到回调，并在成功/明确拒绝后成对清理。
- [x] 2.6 让 gateway 记录 rollback 未知失败并对同 operation 重试失败关闭为 `ROLLBACK_UNRESOLVED`，保留已知冲突终态的原响应。
## 3. 验证与复审

- [x] 3.1 运行 fork 定向 Vitest、`npm run typecheck` 和 change 严格 OpenSpec 校验。
- [x] 3.2 运行 `npm run verify`、`npm run build`、`openspec validate --all --strict` 与 `git diff --check`。
- [x] 3.3 独立复审 fork、rollback、消息目标解析及操作缓存竞态，确认实现、测试和规范一致后决定归档与提交。

## 4. Fork-local 目标解析

- [x] 4.1 在 `web-thread-page` 增加 fork-local 缺少稳定身份时不调用 rollback、相同文本多 turn 不猜测目标的回归测试。
- [x] 4.2 移除 `resolveEquivalentUserMessage` 的唯一文本 fallback，缺少稳定目标身份时失败关闭并保留 fork 恢复信息。
