## Why

当前 timeline 在事件流重连、页面订阅切换、snapshot repair 与本地 send/rewind/fork 并发时仍存在丢失或错用状态的窗口。结果可能表现为历史 thinking/tool output 不显示、rewind 后旧输出回流、发送后输出重复或缺段，需要通过更严格的事件归属、repair 调度和历史代际隔离来修复。

## What Changes

- 修复浏览器事件流在没有页面 listener 时仍继续消费 SSE 的问题，确保这段时间不会静默丢弃 codex-event。
- 为 `timeline-gap` 提供可靠 thread 归属；无法确定归属时不得盲目修 active thread。
- 调整 snapshot repair 与本地 mutation 的并发语义：旧 repair 不得覆盖新状态，但已确认的 gap repair 也不得被静默清除。
- 将 item revision / snapshot suppression 等幂等状态按 timeline generation 或等价历史标识隔离，避免 rewind/fork 后新历史被旧历史去重状态误杀。
- 服务端校验 rollback `expectedDeletedTurnIds`，只允许实际被 rollback 删除的尾部 turn 成为 deleted barrier。
- 收紧失败前 mutation epoch bump 的时机，减少“刷新后才能 rewind/fork”的 metadata 丢失窗口。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 明确 listener 空窗、gap thread 归属、generation-scoped 幂等状态和 rollback barrier 校验要求。
- `thread-chat-view`: 明确 repair 与本地 send/rewind/fork 的并发调度语义，旧 repair 不能覆盖新状态，也不能丢失已确认 repair。
- `timeline-message-actions`: 明确 rewind/fork 失败前不得无意义作废权威 snapshot；rollback deleted turn 只能来自可靠尾部范围。
- `agent-output-rendering`: 明确 reasoning/tool/agent 输出在 generation 切换后不能被旧 revision 或旧 suppression 状态误抑制。

## Impact

- 主要影响前端事件流客户端、全局 provider、thread 页面 repair/send/rewind/fork 并发逻辑和 Zustand timeline store。
- 影响服务端 SSE gap 事件和 rollback barrier 计算。
- 需要补充覆盖事件流 listener 空窗、gap thread 归属、repair/send 竞态、generation 后 itemId 复用、rollback expected id 校验的单元测试。
- 不引入新依赖，不改变公开用户 API；内部 SSE payload 可能增加可选 `threadId` 字段。
