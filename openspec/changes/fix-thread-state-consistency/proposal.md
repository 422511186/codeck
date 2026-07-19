## Why

当前移动端 Web 在权限切换、消息回滚和跨设备运行态恢复中，都把局部或滞后的客户端状态当成了权威状态：完全访问只关闭沙箱却保留审批策略，rollback 后的滞后分页可复活已删除 turn，另一设备漏过部分事件后又因已有可见输出而停止最终收敛。这些问题已经在已部署版本的审计日志、rollout 和现有控制流中得到验证，会造成重复审批、历史多删以及执行记录永久停留在旧状态。

## What Changes

- 将权限模式的完整契约扩展为 `permissions`、`approvalPolicy` 与 `approvalsReviewer` 三元组；「完全访问权限」同时使用 `:danger-full-access` 和 `approvalPolicy: "never"`，设置、thread start、turn start、事件回读与本地状态保持一致。
- 修正 reload / resume 后权限状态恢复，区分“后端尚未返回完整状态”和“显式清除 override”，避免未知状态被转换成 config 默认值并写回后续 turn。
- 将 rewind/rollback 改为带 thread history 版本、目标 turn 和权威尾部清单的失败关闭操作；rollback RPC 的 mutation response 决定删除边界，后续分页只能补充内容，不能复活已删除 turn 或扩大删除范围。
- 为每个 thread 的 rollback 增加动作串行化、operation identity 与幂等结果；重复点击、重试或多设备并发不得再次对已经变化的尾部执行相同 `numTurns`。
- 限制 runtime overlay、rollout supplement 和渲染窗口只能补充权威 turn，不能创造、重排或污染可用于 rollback 计数的尾部 turn manifest。
- 为新设备或无 cursor 的事件流连接建立明确基线；设备漏过事件、页面恢复可见或 summary 从 active 变 idle 时，执行一次按 `HistoryStamp` 隔离的 bounded latest-page reconcile，即使 timeline 已有 partial output 也必须收敛。
- 在 metadata / summary 契约中暴露当前 active turn identity，并在 initial snapshot 因新事件或 history barrier 失效时安排新的有界基线读取，而不是静默丢弃后永久停留在旧记录。
- 补充权限三元组、rollback stale page / 幂等 / 尾部冲突、无 cursor SSE、双设备 partial output 与 final reconcile 的回归测试和审计字段。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `permission-mode-controls`: 完整权限状态增加 `approvalPolicy`，修正完全访问与 reload / resume 的持久化、发送和回读语义。
- `timeline-message-actions`: rewind/rollback 使用权威尾部 manifest、history precondition、删除屏障和失败关闭语义，不再由混合渲染 entries 直接决定破坏范围。
- `timeline-event-stream`: 无 cursor 连接建立可证明的基线，overlay 不污染 turn manifest，rollback barrier 与跨设备事件恢复保持收敛。
- `thread-chat-view`: active turn identity 可恢复，summary idle 必须触发一次最终 bounded reconcile，失效的 initial baseline 必须重新建立。
- `frontend-request-deduplication`: rollback 按 thread 串行并使用 operation identity 幂等，多设备并发或重试必须校验尾部版本。

## Impact

- 前端页面与状态：`src/app/threads/[threadId]/page.tsx`、timeline engine、thread store、事件流客户端和请求协调器。
- Web API：thread settings、thread start、turn start、thread metadata / summary、rollback 和 SSE endpoint 的输入输出契约。
- app-server gateway：权限策略透传、active turn identity、rollback mutation 边界、timeline overlay、generation / deleted-turn barrier 与 backlog 基线。
- 测试：相关 Vitest 单元测试、route 测试、gateway 测试，以及两个浏览器客户端共享同一 gateway 的集成场景。
- OpenSpec：修正现有权限完整状态定义、rollback 权威边界和 running final reconcile 的冲突或缺失要求。
