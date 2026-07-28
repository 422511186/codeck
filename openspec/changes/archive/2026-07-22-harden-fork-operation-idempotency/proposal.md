## Why

消息级 Fork 只在页面内防止快速双击，HTTP 响应丢失或超时后再次点击会重新调用 app-server `thread/fork`，从而创建多个彼此独立且用户难以识别的重复会话。rollback 已有稳定 `operationId`，Fork 缺少同等的请求身份、缓存复用与 cache miss 失败关闭语义。

## What Changes

- 为 Web fork API 增加可选 `operationId` 与 `retryAmbiguousFork`，相同 source thread 和 operation identity 的并发/串行请求只执行一次 fork。
- 服务端缓存进行中和已完成 fork；已知结果直接复用，结果不确定或 Web cache 丢失后的 ambiguous retry 失败关闭，不再次调用生命周期服务。
- 审计写入等明确发生在 fork 前的失败返回 `FORK_REJECTED` 并清理 operation；实际 fork 生命周期开始后的未知失败保留为 ambiguous。
- 消息级 Fork 在结果未知时保留 fork operation identity；fork 已创建但目标解析/rollback 失败时继续复用已完成 fork identity 和稳定 rollback operationId，只有整个 fork+rollback 成功或 fork 明确拒绝后才清理。
- fork/rollback operation 状态保存到当前浏览器 tab 的 session storage，使组件卸载、同 tab 刷新或 route 重挂载后仍能恢复原 identity；从 session 恢复的 pending 请求按结果未知处理，避免 Web cache 同时丢失时重复 fork；完整成功或明确拒绝时同步清理。
- rollback 已得到 conflict/repair-exhausted 结构化终态后，二次审计失败不得覆盖原 409 或把客户端状态误导为结果未知。
- rollback 已调用 app-server 但响应结果未知时，同一 `operationId` 的后续请求返回结构化 `ROLLBACK_UNRESOLVED`，不得重复调用 app-server rollback。
- 增加并发重复、响应结果复用、cache miss fail-closed、前置拒绝恢复和 Web 重试 identity 的自动化测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-lifecycle`: Fork API 增加 operation identity、进程内幂等复用、明确拒绝清理与 cache miss ambiguous retry 失败关闭语义。
- `timeline-message-actions`: 消息级 Fork 区分明确拒绝、fork 结果未知和 fork 已完成/rollback 未完成，跨重试复用 fork 与 rollback identity，避免重复创建或重复回滚。

## Impact

- fork-local 目标缺少稳定身份时失败关闭，禁止用相同文本猜测破坏性 rollback 目标。

- API：`src/app/api/codex/threads/[threadId]/fork/route.ts` 的请求解析、operation cache 和结构化错误。
- Web：`src/web/api/endpoints.ts` 的 fork 输入，以及 `src/app/threads/[threadId]/page.tsx` 的消息级 fork 操作状态。
- 测试：`tests/unit/codex-thread-model-lifecycle-routes.test.ts`、`tests/unit/codex-rollback-route.test.ts`、`tests/unit/app-server-runtime.test.ts`、`tests/unit/web-thread-page.test.tsx`。
- 不改变 app-server `thread/fork` 协议，不改变 fork 后 rollback 的上下文定位、原 thread 隔离或模型 binding 继承。
