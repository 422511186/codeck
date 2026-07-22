## Context

当前 fork route 只审计并调用 binding-aware lifecycle service，Web client 也只在组件内用 action key 防止同一时刻的双击。请求没有 operation identity；当 app-server fork 已成功而 HTTP 响应丢失、超时或页面重试时，下一次请求会再次创建 fork。生命周期 service 还可能在 fork 前 readiness 检查失败，或在 fork 后绑定/模型刷新阶段失败，客户端无法仅凭 5xx 判断是否已经创建新 thread。

## Goals / Non-Goals

**Goals:**

- 同一 source thread 和 operation identity 的并发请求只执行一次 fork，并复用进行中或已完成结果。
- 结果未知的失败及服务重启后的 ambiguous retry 失败关闭，不再次调用 lifecycle service/app-server fork。
- 明确发生在真实 fork 前的审计失败返回 `FORK_REJECTED`，清理 pending operation，修正条件后可重新提交。
- 消息级 Fork 在重试时复用 fork 与 rollback operation identity，整个复合动作成功或 fork 明确拒绝后才清理；原 thread 隔离语义保持不变。

**Non-Goals:**

- 不修改 app-server 原生 `thread/fork` 参数或协议，不实现跨进程外部持久化 operation store。
- 不自动推断已经存在的 fork thread，也不在结果未知时创建新的 fork 作为补偿。
- 不改变 rollback 的 history stamp、目标 turn 解析、模型 binding 继承或工作区文件语义。

## Decisions

1. **API operation cache 以 source thread 和客户端 identity 为键。**

   Web endpoint 接受可选 `operationId` 和 `retryAmbiguousFork`。新客户端总是发送 operationId；旧请求保持直接调用兼容。缓存记录 payload/source fingerprint、pending/resolved/ambiguous 状态、in-flight promise 和已完成结果。相同 identity 的并发请求共享 promise，resolved 请求直接返回同一 `thread`。

2. **结果未知一律失败关闭。**

   lifecycle service 的 fork 调用及其之后的 binding/model refresh 任何未知错误都将 operation 标记为 ambiguous；后续带 `retryAmbiguousFork` 的请求只返回 `FORK_UNRESOLVED`，不再调用 app-server。只有审计等明确在 fork 前失败才包装为 `FORK_REJECTED` 并删除缓存记录。

3. **客户端保存 message-level fork identity。**

   page 以 source thread、目标 turn 和 action 类型组成稳定 key，在首次调用前同时生成 fork operationId 与 fork-local rollback operationId。operation identity、阶段、forked thread id 与 refresh 标记同步保存到当前 tab 的 `sessionStorage`，组件重挂载后先恢复；由于卸载会丢失原请求的完成回调，从 session 恢复的 `pending` MUST 转为 `ambiguous`，后续请求携带 `retryAmbiguousFork`。同一 action key 的新组件 attempt 取得进程内所有权后，旧 attempt 的迟到成功或失败回调 MUST 停止，不能继续写 session、执行 rollback 或跳转。fork ambiguous 时重试带 `retryAmbiguousFork`；fork 已返回但目标解析或 rollback 失败时保留返回的 forked `ThreadDetail`（重挂载后按 forked thread id 权威重读），下一次点击不再调用 fork API。rollback 结果未知时复用原 rollback operationId；明确 conflict/unresolved 时刷新同一 fork thread 的权威详情并生成新 rollback operationId，避免复用已缓存的 rejected promise。只有完整成功或 confirmed fork rejection同时删除内存与 session 记录。组件内 action lock 仍保留，用于快速连续点击抑制；operation identity 负责跨 HTTP 请求幂等。

4. **缓存有界且不伪造恢复结果。**

   resolved/ambiguous 记录使用短 TTL 并在新请求时清理；pending 记录不被淘汰，达到容量上限时新操作返回 confirmed rejection，避免无界增长或因淘汰 pending 而重复 fork。

5. **Rollback 未知失败保留失败关闭状态。**

   gateway 的 rollback operation cache 记录未知失败。首次请求仍返回原始传输错误，便于保留诊断；同一 boot、thread 和 fingerprint 的后续请求返回 `RollbackUnresolvedError`，不重新调用 app-server。客户端因此可以把该结果视为明确 unresolved，刷新 fork-local 权威历史并为新的前置条件生成新的 rollback operationId。已知 `ROLLBACK_CONFLICT`、`ROLLBACK_UNRESOLVED` 等结构化终态继续复用原 Promise，不改变原响应语义。

### Fork-local target identity

Fork 后的目标解析只允许使用 `clientUserMessageId`、可证明的 `turnIndex` 加文本组合或其他稳定 server item identity。若这些身份都不可用，客户端 MUST 保留失败关闭状态，不能退化为唯一文本匹配；相同文案在不同 turn 中不能授权 rollback。

## Risks / Trade-offs

- [Risk] Web/server 进程重启后无法自行发现已创建但响应丢失的 fork thread。→ Mitigation：同 tab 重挂载从 session storage 恢复 ambiguous identity 并失败关闭；tab session 完全丢失后用户仍需从 thread list 检查已有分支。
- [Risk] lifecycle service 在 fork 前 readiness 失败会被保守视为 ambiguous。→ Mitigation：不重试未知副作用；审计失败是唯一明确包装的 pre-fork rejection，后续可扩展 service-level phase marker。
- [Risk] 旧客户端不发送 operationId 时仍可能重复 fork。→ Mitigation：字段向后兼容，新 Web page 已强制发送；旧调用方升级后获得完整保证。

## Migration Plan

先部署兼容可选字段的服务端，再部署发送 operationId 的 Web。回滚只需移除 Web 字段和 route cache；不会修改已创建 thread 或 binding 数据。

## Open Questions

无。
