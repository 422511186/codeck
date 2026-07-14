## Why

长会话当前仍可能通过详情接口返回完整 timeline，并在分页协议不兼容时反复拉取大响应，造成带宽浪费、502 重试和页面卡顿。输入框增高时采用固定定位覆盖消息区，也会让底部消息不可见，因此必须同时收紧消息 API 契约和移动端布局行为。

## What Changes

- **BREAKING**：会话详情接口不再提供完整 timeline，任何读取、刷新、恢复、修复、重连和后台同步流程都只能渐进式分页加载消息。
- 使用当前 app-server 的 `thread/items/list` 游标接口按整个 thread 分页，不再调用过期的 `thread/turns/items/list`。
- 首屏只读取会话元数据和最新一页消息，向上滚动时按 cursor 获取更早消息。
- 每页同时限制条目数量和序列化字节数，禁止响应大小随会话总长度线性增长。
- 移除分页失败后回退到完整 `thread/read` 的逻辑；协议错误只产生有界重试和局部错误。
- 输入框改为页面 flex 布局中的普通子元素，增高时缩小消息视口并保持底部或历史阅读锚点。
- 增加 API、状态层和移动端布局回归测试，验证长会话不会全量加载且不会重复产生 502。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 会话详情必须通过 thread-wide cursor 渐进加载消息，且任何接口都不得返回完整 timeline。
- `chat-input-area`: 输入框增高时必须参与页面布局并同步调整消息视口，不得覆盖消息内容。
- `frontend-request-deduplication`: 分页或协议错误不得触发完整会话读取或无界重复请求。

## Impact

影响 app-server 协议类型与客户端、gateway、Next API routes、Web API client、thread 页面状态与 timeline 合并逻辑、输入框布局、Vitest 测试以及 Docker 发布验证。现有依赖完整 `ThreadDetail.timeline` 的内部调用需要改为元数据读取或显式分页读取。
