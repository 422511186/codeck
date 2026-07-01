## Why

当前 timeline 在发送、snapshot repair、SSE 重连、rewind 和 fork 混合场景下仍存在硬性一致性缺陷：旧 overlay 或 late event 可能在 rollback 后回流，旧首屏 snapshot 可能覆盖刚发送内容，相同文本 user message 可能跨 turn 被去重或错绑。

这些问题会直接导致移动端聊天页出现历史 thinking 丢失、rewind 后旧消息重新显示、发送后输出重复、发送后立即 rewind 失败等用户可见错误，需要在已完成的 timeline consistency 变更之后做一次更严格的 follow-up 修复。

## What Changes

- 收紧 rollback/fork 删除屏障：rollback 必须能覆盖 snapshot 中尚未 materialized、但已进入 overlay/event stream 的 live tail turn；旧 turn 的 overlay、backlog、late notification 不得重新进入 rollback 后 timeline。
- 收紧 snapshot repair 触发条件：普通 `EventSource error` 不得直接等价为不可恢复 gap；只有服务端明确报告无法补发，或客户端检测到确定缺口时，才执行 replace repair。
- 收紧首屏 snapshot 与本地发送的并发规则：用户基于缓存发送后，旧的初始 `readThread` 结果不得 replace 掉 optimistic user message、live delta 或已确认的新 turn。
- 收紧 local user message 身份规则：绑定 `turnId` 后的 local user entry 不得继续按纯文本参与跨 turn 去重或确认；相同文本的合法多轮消息必须同时保留。
- 强化 event replay 幂等：replace repair 或 generation bump 不得清空足以识别已处理事件、item revision 和 snapshot 覆盖范围的必要状态。
- 收紧 fork fallback：fork 后无法在新 thread 中可靠定位等价目标 turn 时，不得按原 thread 的 turn 数继续 rollback。
- 补齐对应单元测试，覆盖用户报告的移动端关键路径和 ultrareview 发现的竞态。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 强化重连 gap 语义、事件幂等、rollback 后 late event/overlay/backlog 屏蔽规则。
- `timeline-message-actions`: 强化 rewind/fork 的目标可靠性、fork-local rollback 失败策略、相同文本多轮消息的 turn 身份要求。
- `thread-chat-view`: 强化缓存首屏发送、初始 snapshot、repair replace 与 live event stream 的并发一致性。
- `agent-output-rendering`: 强化 reasoning/tool/agent 输出在 snapshot repair、historical reload、live delta replay 下不丢失、不重复。
- `turn-interaction`: 强化轻量 `turn/start` 返回 `{turnId}` 时，前端本地 user message 的稳定身份和确认规则。

## Impact

- 前端页面与状态：`src/app/threads/[threadId]/page.tsx`、`src/web/state/store.ts`、`src/web/state/timeline.ts`、`src/web/components/Timeline.tsx`。
- 事件流客户端：`src/web/events/client.ts`、`src/web/components/AppProviders.tsx`。
- 服务端 gateway 与 overlay：`src/server/app-server/runtime.ts`、`src/server/app-server/events.ts`、`src/app/api/codex/events/route.ts`。
- API 交互：`turn/start`、`thread/rollback`、`thread/fork`、`thread/read` 相关返回和前端处理语义。
- 测试：`web-store-events`、`web-thread-page`、`web-events-client`、`codex-events-route`、`app-server-runtime` 相关单元测试。
