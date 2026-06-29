## MODIFIED Requirements

### Requirement: WebSocket authentication
WebSocket 连接（路径 `/ws`）MUST 在 upgrade 阶段校验 cookie 认证。未认证的连接 SHALL 返回 `401 Unauthorized` 并销毁 socket。非 `/ws` 路径的 WebSocket 升级请求 MUST 转发给 Next.js 的 `app.upgradeHandler` 处理，不进行认证拦截。

#### Scenario: Authenticated WebSocket upgrade
- **WHEN** 客户端发起 `/ws` upgrade 且携带有效 session cookie
- **THEN** 升级成功，客户端收到 `{type: "hello", status: "connected"}` 消息

#### Scenario: Unauthenticated WebSocket upgrade
- **WHEN** 客户端发起 `/ws` upgrade 且无有效 cookie
- **THEN** 服务端写入 `HTTP/1.1 401 Unauthorized` 并销毁 socket

#### Scenario: Non-/ws upgrade bypasses custom auth
- **WHEN** 客户端发起非 `/ws` 路径的 WebSocket 升级请求
- **THEN** 请求不经过自定义 WebSocket 认证逻辑，直接转发给 Next.js upgrade handler
