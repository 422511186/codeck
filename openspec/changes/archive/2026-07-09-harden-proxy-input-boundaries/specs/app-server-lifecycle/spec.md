## ADDED Requirements

### Requirement: JSON-RPC malformed frame isolation
系统 SHALL 在 app-server WebSocket transport 中隔离 malformed JSON-RPC 消息。收到无法解析为 JSON 的 app-server 消息时，系统 MUST 不抛出未捕获异常，MUST 拒绝当前 pending JSON-RPC requests，并 MUST 关闭或重置当前 app-server 连接为可诊断状态。

#### Scenario: Malformed app-server frame
- **WHEN** app-server WebSocket 发送 malformed JSON 消息
- **THEN** transport MUST 捕获解析错误
- **AND** MUST 拒绝当前 pending requests
- **AND** MUST 关闭或重置当前连接
- **AND** MUST NOT 让异常逃逸为未捕获异常

#### Scenario: Valid app-server frame still handled
- **WHEN** app-server WebSocket 发送合法 JSON-RPC response、notification 或 server request
- **THEN** transport MUST 继续按现有 JSON-RPC 规则分发消息
