## Context

当前项目使用自定义 HTTP 服务器（`src/server/http.ts`）启动 Next.js，而非 Next.js 内置的 `next dev` 命令。这种模式下，WebSocket 升级请求需要手动路由。

**当前代码流程**（`src/server/http.ts`）：
1. `const app = next({ dev })` 创建 Next.js 实例
2. `const handle = app.getRequestHandler()` 获取 HTTP 请求处理器
3. `const handleUpgrade = app.getUpgradeHandler()` 获取升级处理器
4. `await app.prepare()` 初始化
5. 在 `server.on("upgrade")` 中，`/ws` 路径由自定义 `wss` 处理，其余转发给 `handleUpgrade`

**问题根因**：`app.getUpgradeHandler()` 返回的是 `server.handleUpgrade()`，在 Next.js 16 的 `next-server.js` 中这是一个**空方法**。真正处理 HMR WebSocket 升级的是 `router-server.js` 导出的 `upgradeHandler`，它通过 `getRequestHandlers()` 返回，挂载在 `app.upgradeHandler` 属性上。

**Next.js 内部架构**：
- `app.prepare()` 调用 `getRequestHandlers()`，返回 `{ requestHandler, upgradeHandler, server }`
- `app.requestHandler` → 正确的 HTTP 请求处理器（当前代码通过 `app.getRequestHandler()` 也能获取到正确的）
- `app.upgradeHandler` → 正确的 WebSocket 升级处理器（包含 HMR 路由逻辑）
- `app.getUpgradeHandler()` → 返回 `server.handleUpgrade()` → 空方法（仅用于非 dev 模式）

## Goals / Non-Goals

**Goals:**
- 修复 HMR WebSocket 升级请求路由，使 `/_next/webpack-hmr` 请求被正确转发到 Next.js turbopack HMR 服务器
- 确保 `/ws` 自定义 WebSocket 和 `/_next/webpack-hmr` HMR WebSocket 共存不冲突
- 添加 favicon.ico 消除 404 错误

**Non-Goals:**
- 不修改 Next.js 内部代码
- 不改变 `/ws` WebSocket 的认证逻辑
- 不实现 HMR 的自定义功能（仅确保 Next.js 原生 HMR 正常工作）

## Decisions

### Decision 1: 使用 `app.upgradeHandler` 替代 `app.getUpgradeHandler()`

**选择**：在 `app.prepare()` 之后，通过 `app.upgradeHandler` 获取正确的升级处理器。

**理由**：
- `app.getUpgradeHandler()` 返回的 `server.handleUpgrade()` 在 dev 模式下是空方法
- `app.upgradeHandler` 是 `app.prepare()` → `getRequestHandlers()` 返回的正确处理器，包含 HMR 路由逻辑
- 这是 Next.js 16 自定义服务器模式下推荐的做法

**替代方案**：
- ❌ 在 `server.on("upgrade")` 中手动判断 `/_next/webpack-hmr` 路径并调用 turbopack API → 耦合 Next.js 内部实现，升级易碎
- ❌ 使用 `app.getRequestHandler()` 的 `setupWebSocketHandler` 自动注册 → 该方法在首次 HTTP 请求时才注册 upgrade 监听器，时序不可控，且会与自定义 upgrade 监听器冲突

### Decision 2: upgrade 事件分发策略

**选择**：在 `server.on("upgrade")` 中，先判断路径：
- `/ws` → 自定义 WebSocket 服务器处理（含认证）
- 其他所有路径 → 转发给 `app.upgradeHandler`（包含 HMR 路由逻辑）

**理由**：
- 保持 `/ws` 的认证拦截不变
- 其他路径（包括 `/_next/webpack-hmr`）由 Next.js 内部路由处理，无需手动判断
- `app.upgradeHandler` 内部已有 HMR 路径判断逻辑（`router-server.js:634`）

### Decision 3: favicon.ico 处理

**选择**：在 `public/` 目录下添加一个简单的 SVG-based favicon.ico。

**理由**：最小化变更，消除 404 即可。

## Risks / Trade-offs

- **[风险] `app.upgradeHandler` 是 Next.js 内部属性**：该属性未在公开 API 文档中标注，未来版本可能变更 → **缓解**：这是 Next.js 自定义服务器模式下的标准用法，`getRequestHandlers()` 是公开 API，`upgradeHandler` 是其返回值的属性，稳定性有保障
- **[风险] upgrade 事件处理顺序**：自定义 `/ws` 处理和 Next.js upgrade handler 的执行顺序 → **缓解**：当前设计是互斥分发（`/ws` 或其他），不存在顺序问题
- **[取舍] 不在 HMR 路径上添加认证**：`/_next/webpack-hmr` 不需要认证，这是 Next.js dev 模式的标准行为 → 合理，HMR 仅在开发环境使用
