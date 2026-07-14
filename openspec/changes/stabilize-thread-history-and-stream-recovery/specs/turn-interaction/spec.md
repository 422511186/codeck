## ADDED Requirements

### Requirement: Final stream failure remains a single explicit retryable turn
Web SHALL 为一次发送只创建一个 turn。上游流最终失败时，Web MUST 保留失败用户消息和原始错误信息，并仅在用户显式选择重试时创建新的 turn。

#### Scenario: Upstream Responses stream disconnects
- **WHEN** app-server 上报 `stream disconnected before completion` 且不再重试
- **THEN** 当前用户消息 MUST 标记为失败
- **AND** Web MUST NOT 自动再次调用 `turn/start`
- **AND** 用户 SHALL 能通过显式“重试”重新发送原文本、图片和 skill 引用

#### Scenario: Duplicate start request uses the same client message id
- **WHEN** 相同 `clientUserMessageId` 在去重窗口内重复到达 start API
- **THEN** 服务端 MUST 复用同一个进行中的请求
- **AND** app-server MUST NOT 收到第二个 `turn/start`
