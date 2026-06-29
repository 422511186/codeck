## 1. 修改 HTTP 服务器 upgrade 处理

- [x] 1.1 修改 `src/server/http.ts`：移除 `const handleUpgrade = app.getUpgradeHandler()`，改为在 `app.prepare()` 之后通过 `app.upgradeHandler` 获取正确的升级处理器
- [x] 1.2 修改 `src/server/ws.ts`：将 `nextUpgradeHandler` 参数类型和调用逻辑调整为接收 Next.js 的 `upgradeHandler`，确保非 `/ws` 路径的升级请求正确转发

## 2. 添加 favicon.ico

- [x] 2.1 在 `public/` 目录下添加 `favicon.ico` 文件，消除浏览器 404 错误

## 3. 验证修复

- [x] 3.1 启动 dev 服务器，在浏览器中访问页面，确认浏览器控制台不再出现 `WebSocket connection to 'ws://.../_next/webpack-hmr' failed` 错误
- [x] 3.2 确认 `/_next/webpack-hmr` WebSocket 连接成功建立且 HMR 热更新正常工作（修改页面代码后浏览器自动更新）
- [x] 3.3 确认 `/ws` 自定义 WebSocket 连接仍然正常工作（认证、消息收发）
- [x] 3.4 确认 `favicon.ico` 不再返回 404
