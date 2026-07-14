## Why

渐进分页后的历史消息缺少真实时间，前端使用请求发生时间兜底，导致所有消息显示“刚刚”；同时 prepend 历史页后页面层的一次性滚动补偿会移动当前可见文字。上游 Responses 流偶发断开时，Web 还需要提供明确且不会重复创建 turn 的恢复路径。

## What Changes

- 历史 timeline 条目使用真实消息或 turn 时间；协议未提供 item 时间时，从稳定 UUIDv7 turnId 恢复时间，禁止使用分页请求时间冒充消息时间。
- 统一 Unix 秒与毫秒的时间单位，确保 snapshot、pagination 和 live 条目的相对时间一致。
- 将 prepend 后的可见锚点完全交由 Timeline 管理，页面层不得根据一次性的 `scrollHeight` 差值自动移动视口。
- 历史页加载完成后，加载前顶部消息保持在同一屏幕位置，新页仅出现在其上方，由用户继续上滑查看。
- 保持 Web 每次发送只创建一个 turn；上游流最终失败时保留失败消息和错误证据，并提供显式、安全的重试入口，不自动重复提交。
- 增加真实长会话分页、动态内容高度变化、历史时间和 stream disconnect 恢复的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 修改历史消息时间显示和 prepend 分页后的视口稳定要求。
- `timeline-event-stream`: 增加历史条目的稳定时间来源及跨 snapshot、pagination、live 的时间单位要求。
- `turn-interaction`: 增加上游流最终失败时的单 turn 失败状态和显式重试要求。

## Impact

- 前端 timeline adapter、时间显示和线程分页滚动逻辑。
- Timeline 的滚动锚点所有权及相关 ResizeObserver 行为。
- 发送失败状态、错误卡片和重试交互。
- 不改变消息渐进分页约束，不允许通过完整 thread 读取补充时间或恢复错误。
- `apihzy.wbw.pub` 上游流式连接异常不由 Web 自动重发掩盖；上游服务本身仍需独立排查 SSE、代理超时和 Responses 兼容性。
