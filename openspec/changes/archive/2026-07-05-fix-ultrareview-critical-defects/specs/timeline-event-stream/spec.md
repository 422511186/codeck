## ADDED Requirements

### Requirement: App-server JSON-RPC pending requests fail on disconnect
app-server WebSocket 连接在 JSON-RPC 请求发出后关闭或报错时，Web 端 SHALL 使所有未完成请求以错误结束。HTTP route MUST 能收到该错误并按代理失败路径返回。

#### Scenario: Socket closes before JSON-RPC response
- **WHEN** Web 已向 app-server 发送 JSON-RPC request
- **AND** WebSocket 在 response 到达前关闭
- **THEN** 对应 Promise MUST reject
- **AND** pending request MUST 从内存表中清除

### Requirement: Logout closes browser timeline event stream
用户登出 Web session 后，浏览器端 SHALL 关闭当前已认证的 timeline event stream。清除 cookie 后的旧 EventSource MUST NOT 继续接收或缓冲 timeline、审批或健康事件。

#### Scenario: Logout while SSE is connected
- **WHEN** 用户点击「登出 Web」且 `/api/codex/events` EventSource 仍打开
- **THEN** 客户端 MUST close 该 EventSource
- **AND** 后续重新进入业务页时 MUST 使用新的 session 状态建立连接

### Requirement: Server request resolved notifications reach the browser store
Web runtime SHALL 处理 app-server `serverRequest/resolved` notification，并向浏览器事件流发送 `server-request-resolved`。前端 store SHALL 使用一致的 string request id 匹配 pending request。

#### Scenario: App-server resolves request externally
- **WHEN** app-server 发送 `serverRequest/resolved` notification
- **THEN** runtime MUST 删除对应 pending request
- **AND** MUST 向浏览器发送 `{type: "server-request-resolved", requestId}`
