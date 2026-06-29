## Purpose

确保 Next.js dev 模式下 HMR WebSocket 升级请求被正确路由到 turbopack 热更新服务器。

## ADDED Requirements

### Requirement: HMR WebSocket upgrade routing
自定义 HTTP 服务器 SHALL 在 `app.prepare()` 完成后，使用 `app.upgradeHandler`（由 `getRequestHandlers()` 返回）作为 Next.js WebSocket 升级处理器，而非 `app.getUpgradeHandler()` 返回的空方法。所有非 `/ws` 路径的 WebSocket 升级请求 MUST 转发给 `app.upgradeHandler`。

#### Scenario: HMR WebSocket upgrade succeeds
- **WHEN** 浏览器发起 `/_next/webpack-hmr` WebSocket 升级请求
- **AND** 请求被转发给 `app.upgradeHandler`
- **THEN** turbopack HMR 服务器接受升级，浏览器建立持久 HMR 连接

#### Scenario: HMR WebSocket upgrade with stale .next cache
- **WHEN** `.next/dev` 目录残留了上次异常退出的不完整缓存
- **AND** 删除 `.next` 目录后重新启动 dev 服务器
- **THEN** 服务器正常启动，HMR WebSocket 连接正常工作

### Requirement: Upgrade event dispatch
`server.on("upgrade")` 事件处理器 SHALL 按路径互斥分发：
- `/ws` 路径 → 自定义 WebSocket 服务器处理（含 cookie 认证）
- 其他所有路径 → 转发给 Next.js `app.upgradeHandler`

#### Scenario: Custom /ws upgrade with authentication
- **WHEN** 客户端发起 `/ws` WebSocket 升级请求且携带有效 cookie
- **THEN** 自定义 WebSocket 服务器处理升级，客户端收到 `{type: "hello"}` 消息

#### Scenario: Custom /ws upgrade without authentication
- **WHEN** 客户端发起 `/ws` WebSocket 升级请求且无有效 cookie
- **THEN** 服务端返回 `401 Unauthorized` 并销毁 socket

#### Scenario: Non-/ws upgrade forwarded to Next.js
- **WHEN** 客户端发起非 `/ws` 路径的 WebSocket 升级请求（如 `/_next/webpack-hmr`）
- **THEN** 请求被转发给 `app.upgradeHandler`，不由自定义 WebSocket 服务器处理
