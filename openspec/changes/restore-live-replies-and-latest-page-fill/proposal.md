## Why

Web 发送消息后，turn 完成事件可能早于 assistant item 持久化，当前一次性 repair 会过早清除，导致回复只能通过手动刷新出现。同时 legacy 分页每次只读取一个 turn，最新 turn 只有一条用户消息时，刷新首屏只显示这一条且列表不足以触发滚动加载。

## What Changes

- turn 完成后的有界 repair 在目标 turn 尚无 assistant/tool 输出时执行有限次数延迟重试，不要求用户刷新。
- legacy `thread/turns/list` fallback 连续读取有限个 turn，直到凑满一个 item 页或到达历史起点。
- 复合 cursor 同时保持 turn cursor 与 turn 内 item offset，保证跨 turn 向上分页不重复、不漏项。
- 首屏不足一页但仍有 cursor 时由服务端继续填充，而不是依赖用户产生 scroll 事件。
- 增加持久化延迟、跨 turn 小消息页、超大单 turn 和 cursor 连续性的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 首屏最新页必须尽量填满受控 item limit，并在发送后自动显示最终回复。
- `timeline-event-stream`: turn 完成后的持久化延迟必须通过有界 repair 自动恢复。
- `frontend-request-deduplication`: 延迟 repair 必须去重、有限且不升级为全量读取。

## Impact

- `src/server/app-server/client.ts` 的 legacy cursor 聚合。
- `src/app/threads/[threadId]/page.tsx` 的 completion repair 生命周期。
- client、store 和 thread page 单元测试。
- Docker 镜像需重新构建并部署。
