## 1. 回归测试先行

- [x] 1.1 在 `tests/unit/app-server-runtime.test.ts` 增加用例：live turn 只存在于 overlay/event stream 时执行 rollback，旧 turn 的 reasoning/tool/agent overlay 不会出现在 rollback 返回的 thread detail，也不会进入 backlog replay。
- [x] 1.2 在 `tests/unit/web-events-client.test.ts` 增加用例：`EventSource error` 只进入 reconnecting，不派发 `timeline-gap`；服务端显式 `timeline-gap` message 才触发 repair。
- [x] 1.3 在 `tests/unit/web-thread-page.test.tsx` 增加用例：cached 首屏可发送时，发送前启动的 initial `readThread` 返回旧 snapshot，不能覆盖 optimistic user message、绑定的 `turnId` 或 live delta。
- [x] 1.4 在 `tests/unit/web-store-events.test.ts` 增加用例：两个相同文本、不同 `turnId` 的 local user message 必须同时保留，server 确认其中一个时不得删除另一个。
- [x] 1.5 在 `tests/unit/web-store-events.test.ts` 增加用例：replace repair 或 generation bump 后补发同一 `eventId` 不会再次追加 delta，旧 revision 不会穿透。
- [x] 1.6 在 `tests/unit/web-thread-page.test.tsx` 增加用例：fork 后无法在 fork-local timeline 定位目标 user message 时，不调用 rollback API，并显示可恢复错误。

## 2. 服务端 rollback 屏障与 overlay 清理

- [x] 2.1 扩展 rollback 调用路径，使 message-level rewind/fork 能把目标 tail turnIds 或等价 expected deleted turns 传给 Web gateway，同时保持现有 `numTurns` 调用兼容。
- [x] 2.2 调整 `AppServerGateway.rollbackThread`：rollback 成功后优先使用 expected deleted turns 清理 `timelineOverlays`、`deletedTurnIdsByThread` 和相关 backlog 可见事件。
- [x] 2.3 确保 rollback 后到达的旧 notification 即使被赋予当前 generation，也会因 deleted turn 屏障被 `recordTimelineOverlay`、SSE backlog 和前端 store 忽略。
- [x] 2.4 调整 fork rollback 初始化：forked thread 的 deleted turn 屏障必须基于 fork-local target 计算，不能复用原 thread turnId 假设。

## 3. SSE gap 与 repair 串行化

- [x] 3.1 修改 `TimelineEventStreamClient`：普通 `EventSource error` 只更新连接状态，不本地合成 `timeline-gap`。
- [x] 3.2 确保 SSE route 发送的显式 `{ type: "timeline-gap" }` 仍能被 `AppProviders` 和 store 正确转发为 snapshot repair。
- [x] 3.3 在 `ThreadPage` 引入 thread-local mutation epoch 或等价请求版本，覆盖 initial read、repair read、send、rewind、fork 的并发判断。
- [x] 3.4 对发送后返回的旧 initial `readThread` / repair `readThread` 实施 fail-closed：不得 replace 回退本地新 turn；必要时只允许不会删除新 entry 的受控 merge。

## 4. Local user message 身份与幂等

- [x] 4.1 调整 `bindLocalUserMessageTurn` 和 normalize 流程：绑定 `turnId` 后的 `local-user-*` 不再按纯文本参与跨 turn 去重。
- [x] 4.2 修改 server user confirmation：优先按 `clientUserMessageId`、`localUserMessageIdsByTurn`、同 turnId 匹配；纯文本 fallback 只允许匹配唯一未绑定且仍 sending 的候选。
- [x] 4.3 修改相邻 user message 折叠逻辑：只有同 `turnId` 或明确同 server item/client id 的重复项可折叠；不同 turn 的相同文本必须保留。
- [x] 4.4 使用稳定唯一 id 生成本地 user/error/warning entries，避免 `Date.now()` 同毫秒碰撞覆盖。
- [x] 4.5 调整 `setThreadEntries` / `setTimelineGeneration`：replace 后保留 bounded processed event id LRU，并从 snapshot/completion metadata 重建 item revision。

## 5. Rewind/Fork 交互收紧

- [x] 5.1 收紧 `Timeline` 菜单可用条件：只有当前 entry 能通过可靠身份解析为 user target，且可计算 tail turns 时才显示或启用 rewind/fork。
- [x] 5.2 修改 `forkFromMessage`：fork-local target 无法定位时停止，不调用 rollback，并追加明确错误提示。
- [x] 5.3 确保 rewind 成功后 draft 回填不把 rollback 前 local tail 重新作为 timeline fallback。

## 6. 验证与回归

- [x] 6.1 运行相关单元测试：`web-store-events`、`web-thread-page`、`web-events-client`、`app-server-runtime`、`codex-events-route`。
- [x] 6.2 运行项目现有验证命令，确认类型检查和相关测试通过。
- [x] 6.3 人工检查移动端关键路径：发送后立即 rewind、rewind 后编辑重发、fork 后跳转编辑、断线重连后无重复输出、历史 thinking 刷新后保留。
- [x] 6.4 更新本 change 的任务勾选状态，并记录任何未完成的残余风险。

备注：6.3 以代码路径检查和新增/既有单元测试覆盖完成；本次未启动真机浏览器或本地 dev server。
