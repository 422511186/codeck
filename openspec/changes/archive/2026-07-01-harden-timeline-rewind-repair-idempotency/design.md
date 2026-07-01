## Context

当前移动端会话页由四个来源共同维护同一 timeline：首屏 `readThread` snapshot、用户发送时的 optimistic local entry、SSE timeline event stream、服务端 app-server overlay。上一轮 timeline consistency 变更已经引入 generation、snapshot delta suppression 和 local user turn 绑定，但实现仍存在几个边界未收紧：

- rollback 前的 server snapshot 可能尚未 materialize 当前 live turn，导致 deleted turn 推断缺失，旧 overlay 在 rollback 返回后又被 `applyTimelineOverlay` 拼回。
- 浏览器 `EventSource error` 被当作确定 gap，普通自动重连也会触发 `readThread` replace。
- cached 首屏允许输入可用，但旧 initial `readThread` 结果没有被本地发送后的 mutation 屏障拦截。
- 绑定 `turnId` 后的 `local-user-*` 仍按纯文本参与本地去重和 server user 确认 fallback。
- replace/generation bump 会清空 processed event/revision 状态，削弱补发幂等。

这些问题都发生在跨模块边界，不适合只用局部补丁处理；需要明确新的状态边界和幂等策略。

## Goals / Non-Goals

**Goals:**

- rewind/fork rollback 后，旧 tail 的 overlay、late event、backlog replay 和 local entries 都不会重新显示。
- cached 首屏发送后，发送前启动的旧 snapshot 不会覆盖新 turn 的本地或 live 输出。
- 相同文本的多轮 user message 能稳定共存，且 server 确认不会跨 turn 错绑。
- SSE 普通断线重连优先走 `Last-Event-ID` 补发；只有确定 gap 才触发 snapshot repair。
- replace repair 和 generation bump 后，event id、item revision、snapshot 覆盖文本仍保持足够幂等。
- fork 后必须基于 fork-local 历史定位目标；定位失败时停止并提示，不执行猜测性 rollback。

**Non-Goals:**

- 不改变 app-server 原始协议或引入持久化事件存储。
- 不回滚工作区文件系统变更。
- 不引入桌面端布局或非移动端交互。
- 不把 `turn/start` 改回依赖完整 thread snapshot 的实时路径。

## Decisions

1. rollback 屏障必须基于“目标 tail turn 集合”，而不是只基于 materialized before/after snapshot diff。

   前端在执行 message-level rewind/fork 前已经能计算目标到尾部的 turnIds；这些 turnIds 应通过 rollback 调用或伴随本地屏障传递给 gateway。服务端 rollback 成功后，应清理这些 turn 的 overlay/backlog，并记录 deleted turn 屏障。若服务端只从 `client.readThread()` 推断 deleted turn，在 live turn 尚未 materialize 时会漏掉旧 tail。

   备选方案是仅 bump generation。该方案无法阻止 rollback 后才到达的旧 notification 被赋予当前 generation，因此不够可靠。

2. repair 触发必须区分“连接错误”和“补发不可恢复 gap”。

   `EventSource error` 只代表连接异常，浏览器会自动携带 `Last-Event-ID` 重连。客户端应设置 reconnecting 状态，但不直接请求 snapshot repair。只有服务端 SSE 明确发送 `timeline-gap`，或客户端发现事件序列不可连续且无法用补发修复时，才调用 `readThread` replace。

   备选方案是继续 error 即 repair。它会在移动网络抖动时制造额外 replace/replay 竞态，增加重复输出概率。

3. thread page 需要本地 mutation epoch 来保护旧 snapshot。

   页面发起首屏 `readThread` 时记录 request epoch；用户发送、rollback、fork、repair 或任何本地 timeline mutation 后推进 epoch。旧请求完成时若 epoch 已变化，不得以 replace 模式应用；必要时仅可受控 merge 不会回退本地 entries 的字段。

   备选方案是发送时取消 promise。浏览器无法可靠取消已经进入服务端处理的所有请求，epoch 判断更直接。

4. local user message 绑定 turn 后应脱离纯文本去重路径。

   `local-user-*` 在获得 `turnId` 后仍可作为 optimistic entry 存在，但去重、确认、相邻折叠必须按 `clientUserMessageId`、`turnId` 和 entry id 分组。文本匹配只能用于未绑定 turn、仍处于 sending 的唯一候选，且不得跨 turn 匹配 sent local entry。

   备选方案是继续文本去重防双击。双击防重应使用 send payload/client id 层处理，不应破坏合法重复 prompt。

5. replace repair 不应彻底丢弃近期幂等索引。

   `setThreadEntries(..., replace)` 可以重建 entries、snapshot suppression 和 item revision，但需要保留 bounded processed event id LRU，或至少保留当前连接窗口内已处理的 event ids。item revision 应从 snapshot metadata 和 completion event 中重建，不能一律回到 0。

   备选方案是完全清空状态。它简化实现，但会允许同一 event id 在 repair 后再次追加。

6. fork rollback 定位失败必须 fail closed。

   fork 后若无法在 forked thread 的 timeline 中按 `clientUserMessageId`、turnIndex+文本或唯一文本定位等价目标，就不得用原 thread 的 `numTurns` 继续 rollback。应提示用户刷新或稍后重试。

## Risks / Trade-offs

- [Risk] rollback API 目前只接收 `numTurns`，传递目标 turnIds 需要扩展 Web API 或 gateway 内部方法。→ Mitigation: 可以先在前端本地设置 deleted turn 屏障，同时在服务端 wrapper 中接受可选 expected deleted turns，保持向后兼容。
- [Risk] 保留 processed event id LRU 会增加少量内存。→ Mitigation: 按 thread 限制固定窗口，大小与 SSE backlog 同级或更小。
- [Risk] 不再在 `EventSource error` 立即 repair，极端情况下断线期间页面短暂缺输出。→ Mitigation: 服务端无法补发时会明确发 `timeline-gap`，客户端再 replace repair。
- [Risk] 禁止纯文本跨 turn 去重后，真实双击可能出现两个 optimistic entries。→ Mitigation: 保留 `pendingSendKeys` 和 `clientUserMessageId` 并发请求缓存，防重放在发送层完成。
- [Risk] fork fail closed 可能比当前行为更常提示失败。→ Mitigation: 这是正确的保守行为，避免错误删除 fork 历史。
