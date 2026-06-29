## Why

自定义 HTTP 服务器 (`src/server/http.ts`) 中，WebSocket 升级请求的处理存在两个问题：

1. **HMR WebSocket 连接失败**：浏览器尝试连接 `/_next/webpack-hmr` 时，请求被转发给 `app.getUpgradeHandler()` 返回的处理器，但该处理器内部调用的是 `server.handleUpgrade()`——Next.js 16 中此方法在 `next-server.js` 里是一个**空函数**（注释："The web server does not support web sockets, it's only used for HMR in development"）。真正处理 HMR 升级的是 `router-server.js` 导出的 `upgradeHandler`，它由 `getRequestHandlers()` 返回。当前代码没有使用这个正确的处理器，导致 HMR 升级请求被静默丢弃，浏览器反复重连失败。

2. **favicon.ico 404**：项目缺少 `public/favicon.ico` 文件，浏览器默认请求该文件时返回 404。

## What Changes

- 修改 `src/server/http.ts`，使用 Next.js `app.prepare()` 后通过 `app.upgradeHandler`（而非 `app.getUpgradeHandler()`）获取正确的升级处理器，将 HMR 升级请求正确路由到 Next.js 内部的 turbopack HMR WebSocket 服务器
- 修改 `src/server/ws.ts`，确保自定义 WebSocket 的 upgrade 拦截逻辑不阻塞 `/_next/webpack-hmr` 路径
- 添加 `public/favicon.ico` 消除 404 错误

## Capabilities

### New Capabilities

- `hmr-websocket-routing`: 确保 Next.js dev 模式下 HMR WebSocket 升级请求被正确路由到 turbopack 热更新服务器，而非被空处理器丢弃

### Modified Capabilities

- `auth-session`: WebSocket `/ws` 路径的认证拦截逻辑需要与 HMR `/_next/webpack-hmr` 路径共存，upgrade 事件分发逻辑有变更

## Impact

- `src/server/http.ts`：修改服务器启动流程，获取正确的 upgrade handler
- `src/server/ws.ts`：修改 upgrade 事件分发逻辑，确保 HMR 请求不被拦截
- `public/favicon.ico`：新增静态文件
- 开发者体验改善：HMR 热更新正常工作，浏览器不再反复报 WebSocket 连接失败
