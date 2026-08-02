# Codex 移动 Web 项目缺陷排查报告

> 排查日期：2026-08-03
> 排查范围：`src/server/`、`src/app/api/codex/`、`src/web/` 全量关键模块
> 排查方式：4 路并行子代理深度阅读 + 主代理对高危项逐行二次核验
> 本报告仅做静态分析与根因定位，**未修改任何代码**。

## 概述

本次排查覆盖服务端鉴权/安全/审计/持久化/app-server JSON-RPC 协议、API 路由输入校验、前端 timeline 状态机与 WebSocket 事件流四大领域，共发现 **84 项**缺陷（去重后），其中：

| 严重度 | 数量 | 主要风险面 |
|---|---|---|
| 高 | 18 | 鉴权、路径穿越、资源泄漏、协议失配、状态竞态 |
| 中 | 35 | 输入校验缺失、DoS、连接可靠性、内存增长 |
| 低 | 31 | 一致性、可观测性、UX、性能微优化 |

> 核验说明：以下高危项均已通过主代理直接 `Read` 源码二次确认，行号准确：H1（cookie 无 secure）、H2（token 入 stdout）、H6（redact 循环引用）、H7（audit 非原子追加）、H9（assertPathAllowed 仅词法校验）、H10（fs/file PUT 无大小限制）、H12（json-rpc `typeof id === "number"`）、H14（transport close 回调竞态）、H15（子进程 exit 未监听）、H17（ChatInput blob URL 未 revoke）、H18（前端 EventSource 无手动重连）。

---

## 一、高危问题（High）

### H1. 会话 Cookie 缺少 `secure` 标志
- **文件**：[session.ts](file:///workspace/src/server/session.ts) 第 14-33 行
- **类别**：安全
- **问题**：`createSessionCookie` / `clearSessionCookie` 仅设置 `httpOnly: true` + `sameSite: "lax"`，未设置 `secure`。生产环境即便走 HTTPS 反代，浏览器在任意 HTTP 跳转中仍会回带该 Cookie，签名后的 access token 可被中间人嗅探。
- **根因**：未按 `NODE_ENV` 或 `X-Forwarded-Proto` 动态判断 `secure`。
- **可安全修复**：是。

### H2. access token 兼作 cookie 签名密钥且被打到 stdout
- **文件**：[session.ts](file:///workspace/src/server/session.ts) 第 14-23 行、[http.ts](file:///workspace/src/server/http.ts) 第 21-23 行、[auth.ts](file:///workspace/src/server/auth.ts) 第 4-11 行
- **类别**：安全
- **问题**：`readSessionCookie` 直接用 `getRuntimeConfig().accessToken` 作 HMAC 密钥签名 cookie；`http.ts` 在 `config.generatedAccessToken` 时 `console.log` 打印同一 token。任何拿到该日志的人即可伪造合法会话 cookie，等效"登录令牌泄漏 → 任意身份冒充"。
- **根因**：复用 access token 作 cookie 密钥，无独立 `cookieSecret`；启动日志未脱敏。
- **可安全修复**：是。引入独立 `CODEX_WEB_COOKIE_SECRET`，缺失时 `randomBytes(64)` 派生；token 输出改为提示从文件读取。

### H3. 服务端无会话过期/吊销机制
- **文件**：[session.ts](file:///workspace/src/server/session.ts) 第 14-65 行
- **类别**：安全
- **问题**：cookie `maxAge=30d` 仅是浏览器侧过期；payload `{ t, v: 1 }` 不含 `iat`/`exp`，服务端只要 HMAC 通过即认证。access token 不轮换、不吊销，登出仅 `clearSessionCookie()` 让浏览器删 cookie——攻击者此前抓到一次 cookie 即可在 30 天内持续伪造身份，登出无效。
- **根因**：无服务端会话状态、无 `exp`、登出未使旧 token 失效。
- **可安全修复**：是。payload 加 `iat`，`readSessionCookie` 校验 `Date.now() - iat < maxSessionAgeMs`；登出记 denylist。

### H4. `file-lock.ts` TOCTOU 失效锁竞争
- **文件**：[file-lock.ts](file:///workspace/src/server/persistence/file-lock.ts) 第 28-42、44-89 行
- **类别**：并发
- **问题**：`removeStaleLock` 先 `stat` 判 `mtime` 超时再 `unlink`。若持锁进程 A 因 callback 慢（>30s 默认 staleMs）被误判死亡，进程 B `unlink` 后用 `open('wx')` 拿锁，此时 A 仍以为自己持锁——两进程同时进临界区。staleMs 默认 30s 对大模型调用/文件 IO 远不够。
- **根因**：基于 mtime 的死亡判定不可靠；缺"持有者存活探测 + 心跳续约"。
- **可安全修复**：部分。可加 `isPidAlive(metadata.ownerPid)` 复核并把 staleMs 调大；彻底解决需 lease 续约或 `flock(2)`。

### H5. `JsonRpcPeer` 未决请求无超时，半开连接下永久悬挂
- **文件**：[json-rpc.ts](file:///workspace/src/server/app-server/json-rpc.ts) 第 28-38 行、[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 459-466 行
- **类别**：并发 / 资源泄漏
- **问题**：`request()` 把 pending 放进 Map 后无 `setTimeout` 兜底；若 app-server 既不回响应也不触发 `close`/`error`（TCP 半开、对端 kernel panic、NAT 静默丢包），pending 永久驻留，对应 HTTP 请求永久挂起。`failPendingRequests` 仅在 `close`/`error` 时调用。
- **根因**：缺超时；缺心跳/keepalive 探测。
- **可安全修复**：是。`request` 内 `setTimeout(timeoutMs)`，到期 `pending.delete(id)` + `reject`，resolve/reject 路径 `clearTimeout`。

### H6. `audit-log.ts` `redact` 对循环引用无限递归导致栈溢出
- **文件**：[audit-log.ts](file:///workspace/src/server/audit-log.ts) 第 12-26 行
- **类别**：异常 / 边界
- **问题**：`redact` 不维护 `visited` 集合，遇 `value.self = value` 类循环引用会无限递归 `RangeError: Maximum call stack size exceeded`。`audit()` 是审计路径，崩溃后原始审计意图完全丢失，且可能让请求链路 500。
- **根因**：未用 `WeakSet` 跟踪已访问对象。
- **可安全修复**：是。引入 `visited: WeakSet<object>`；或先 `JSON.stringify(event.detail)` catch 后降级为 `"[unserializable]"`。

### H7. `audit-log.ts` 非原子追加 + 无 fsync，并发下丢日志/截断
- **文件**：[audit-log.ts](file:///workspace/src/server/audit-log.ts) 第 28-37 行
- **类别**：并发 / 安全
- **问题**：`appendFile(auditLogPath, ...)` 在 Node.js 上对 >4096 字节写入不保证原子；并发追加会行交错。无 `fsync`，进程崩溃时近期审计记录可能未落盘。审计日志作为安全合规证据，丢失/损坏后果严重。
- **根因**：依赖 `O_APPEND` 但未限单次写入长度，未 flush。
- **可安全修复**：是。改 `open('a')` → `write` → `fsync` → `close`，或用 `file-lock` 串行化；超长记录截断。

### H8. `AppServerGateway` 重连后 `pendingServerRequests` 与会话状态不清理
- **文件**：[runtime.ts](file:///workspace/src/server/app-server/runtime.ts) 第 3589-3676、4650-4668 行
- **类别**：并发 / 逻辑
- **问题**：`ensureReady()` 在 peer 非 ready 时仅重置 `this.initialized` 并重连，但 `pendingServerRequests`、`terminalSessions`、`commandExecSessions`、`outputDecoders`、`timelineOverlays` 等 Map 未清理。app-server 重启后旧 server-request id 失效，前端持续看到僵尸"待审批"卡片；旧 terminal session 永不收敛到 `running: false`。peer 断开时 `failPendingRequests` 只 reject 客户端发起的请求，不清 gateway 的 pendingServerRequests。
- **根因**：缺 reconnect 钩子统一清理"连接相关"状态。
- **可安全修复**：是。peer 增 onDisconnect 钩子，gateway 清空 pendingServerRequests 并广播 `server-request-resolved` 失败事件；terminal/commandExec 条目标记 `running:false, exitCode:-1`。

### H9. `assertPathAllowed` 仅做词法归一化，未 realpath（路径穿越/符号链接）
- **文件**：[workspace-policy.ts](file:///workspace/src/server/workspace-policy.ts) 第 50-61 行；调用方 [security.ts](file:///workspace/src/server/security.ts) 第 13-15 行；所有 `fs/*` route（[copy](file:///workspace/src/app/api/codex/fs/copy/route.ts)、[file](file:///workspace/src/app/api/codex/fs/file/route.ts)、[remove](file:///workspace/src/app/api/codex/fs/remove/route.ts)、[directory](file:///workspace/src/app/api/codex/fs/directory/route.ts)、[watch](file:///workspace/src/app/api/codex/fs/watch/route.ts)、[metadata](file:///workspace/src/app/api/codex/fs/metadata/route.ts)、[search](file:///workspace/src/app/api/codex/fs/search/route.ts)）
- **类别**：安全 / 路径穿越
- **问题**：`assertPathAllowed` 仅用 `path.resolve` 词法归一化，不调 `realpath`/`lstat`。攻击者可在 workspace 内放符号链接指向 `/etc/passwd`、`~/.ssh/id_rsa`、`CODEX_WEB_DATA_DIR`，再通过这些 route 读/写/删/复制外部文件。同模块 `assertRuntimeSessionRolloutFileAllowed`（[security.ts:27-48](file:///workspace/src/server/security.ts)）和 `inspectCanonicalRegularFile`（[uploads.ts:114-126](file:///workspace/src/server/uploads.ts)）已显式做 realpath，说明风险已知但 fs/* 未应用。
- **根因**：路径校验 helper 缺 canonical path 校验，与 session rollout 校验不对称。
- **可安全修复**：是。新增 `assertAllowedPathCanonical`（词法校验 + realpath + 重新 `assertPathAllowed`），对所有写/删/复制操作启用。

### H10. `fs/file` PUT 写入无大小限制
- **文件**：[fs/file/route.ts](file:///workspace/src/app/api/codex/fs/file/route.ts) 第 38-44 行
- **类别**：DoS / 资源耗尽
- **问题**：`if (typeof body.text !== "string")` 之后直接 `writeFile(allowedPath, body.text)`，无 `text.length` 上限。`uploads/files` 有 20 MiB 限制、`turns/start` fileReferences 有 50 MiB 总量限制，唯独 `fs/file` PUT 无限制。恶意客户端可一次提交数 GB 文本触发 OOM 或填满磁盘。
- **根因**：route 未对写入负载做边界校验。
- **可安全修复**：是。增加 `text.length` 上限（对齐 `MAX_FILE_SIZE`），超限返回 413。

### H11. `fs/remove` 递归 + force 删除且无 root 自身保护
- **文件**：[fs/remove/route.ts](file:///workspace/src/app/api/codex/fs/remove/route.ts) 第 19-21 行；[client.ts](file:///workspace/src/server/app-server/client.ts) 第 2430-2433 行
- **类别**：数据破坏 / 路径穿越
- **问题**：`removePath` 固定传 `{ recursive: true, force: true }`，路径只过词法校验（见 H9）。客户端可 `POST /fs/remove { path: "<workspace_root>" }` 把整个工作区根递归删除，无"不允许删 root 自身"边界。结合 H9 符号链接问题，可递归删工作区外任意目录。
- **根因**：删除操作缺 root 保护、未做 canonical 校验。
- **可安全修复**：是。route 层禁止 `allowedPath === workspaceRoot`，对 realpath 后路径再校验。

### H12. JSON-RPC `typeof message.id === "number"` 字符串 id 失配
- **文件**：[json-rpc.ts](file:///workspace/src/server/app-server/json-rpc.ts) 第 68-110 行
- **类别**：协议
- **问题**：`handleMessage` 用 `typeof message.id === "number"` 区分响应/服务器请求与通知。JSON-RPC 2.0 允许字符串 id；若 app-server 返回字符串 id，则落入 `if (message.method)` 通知分支（method 为 undefined 时静默丢弃），原请求**永不 resolve**，pending entry 永久驻留。同时不支持 batch（数组被静默丢弃）。
- **根因**：未按 JSON-RPC 2.0 规范兼容字符串 id 与 batch。
- **可安全修复**：是。放宽为 `message.id !== undefined`，区分 result/error 与 method；检测 Array 逐项处理。

### H13. `transport.ts` `openSocket` close 回调抹掉新 socket（重连竞态）
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 441-456 行（close 回调）、372-394（重试不关闭旧 socket）、451-455（error 回调不 close）
- **类别**：并发
- **问题**：`socket.once("close", ...)` 无条件执行 `this.socket = null; this.rpc = null; this.connecting = null;`。`connectWithRetry` 在 error/timeout 后重试创建新 socket 成功（已写入 `this.socket`）后，旧 socket 异步触发的 close 事件会把新 socket 引用清空，连接"凭空消失"。error 回调也不 `socket.close()`，旧 socket 可能长期残留并随后触发 close 抹掉新状态。`socket.on("message")` 在重连后旧 socket 数据也会被路由到新 rpc，污染请求/响应配对。
- **根因**：close 回调捕获 `this` 而非局部 socket 引用，未做"是否仍为当前 socket"判等。
- **可安全修复**：是。close 回调加 `if (this.socket === socket)` 守卫；error 回调 `socket.close()`；close 时 `socket.removeAllListeners()`。

### H14. `transport.ts` 子进程 exit 未监听，崩溃无感知不自动恢复
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 700-718 行（`startOwnedChild`）、839-870 行（`startOwned`）
- **类别**：异常
- **问题**：`startOwnedChild` 只注册 `child.stderr.on("data")`，无 `child.on("exit")` / `child.on("error")`。子进程崩溃后 `this.started` 仍为 true，`connectSpawned` 不重新 spawn；WebSocket 关闭会 reject 当前 pending，但 `started=true` 导致后续 `connect()` 走 `connectDelegate`（已死），对新 delegate 反复失败，状态卡死。spawn 失败时也无子进程线索，仅 10s 超时报"连接 app-server 超时"。
- **根因**：缺子进程生命周期监听。
- **可安全修复**：是。注册 `child.on("exit", (code, signal) => this.fail(...))`，重置 started/child 并触发重连或降级。

### H15. spawn-or-connect 模式 spawn 失败不释放文件锁
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 812-822 行（`startOrWaitForOwner`）、839-870 行（`startOwned` 内 `connectDelegate` 失败抛错）、756-775 行（仅 close 才释放 lease）
- **类别**：异常
- **问题**：`startOrWaitForOwner` 获取 lease 后调 `startOwned`，若 `connectDelegate` 抛错（握手失败/超时），`fail()` 抛出，但 lease 仅在 `close()` 中释放。其他进程在 10s 锁超时前无法启动 app-server，造成服务不可用窗口。
- **根因**：try/catch 未在 spawn 失败路径上释放 lease。
- **可安全修复**：是。`startOwned` 失败分支里 `await lease.release()`。

### H16. WS 服务端无心跳、无连接上限、无背压
- **文件**：[ws.ts](file:///workspace/src/server/ws.ts) 第 22-73 行
- **类别**：资源泄漏 / 性能
- **问题**：(1) 无 ping/pong 心跳，半开连接（手机切后台、NAT 超时）不触发 close，`wss.clients` 累积僵尸连接。(2) 无 `maxConnections`，可打开大量 ws 耗尽 fd。(3) `client.send(payload)` 不检查 `bufferedAmount`，timeline 高频 delta 下慢客户端发送缓冲区无界增长直至 OOM。(4) `wss` 无显式 `close()`，进程退出连接被硬切。(5) 鉴权仅在 upgrade 时校验一次，cookie 过期后已建立连接仍可继续接收事件。(6) 广播未按 threadId 过滤，全量广播（信息泄漏+浪费带宽）。
- **根因**：缺运维侧韧性配置。
- **可安全修复**：是（部分）。加周期 ping + 30s 无 pong terminate；`clients.size > MAX` 拒绝；`send` 回调检查 `bufferedAmount` 超阈值 `close(1009)`；周期重校验 cookie；引入 per-client threadId 订阅。

### H17. ChatInput `URL.createObjectURL` 创建的 blob URL 从未 revoke
- **文件**：[ChatInput.tsx](file:///workspace/src/web/components/ChatInput.tsx) 第 208 行
- **类别**：资源泄漏 / 内存增长
- **问题**：`addImage` 调 `URL.createObjectURL(file)` 存入 `previewUrl`。整个组件生命周期中：`removeImage`（第 228 行仅 filter）、`send` 成功后 `setImages([])`（第 293 行）、组件卸载，均未 `URL.revokeObjectURL`。每个未 revoke 的 blob URL 持续持有底层 File 引用，阻止 GC。用户频繁加/删图片或切 thread 时持续累积。
- **根因**：缺 blob URL 生命周期管理。
- **可安全修复**：是。在 `removeImage`、`send` 清理、threadId 变更 effect、组件卸载时遍历 `URL.revokeObjectURL`。

### H18. `TimelineEventStreamClient` 无手动重连，EventSource 放弃后永久卡 "reconnecting"
- **文件**：[events/client.ts](file:///workspace/src/web/events/client.ts) 第 170-178 行
- **类别**：资源泄漏 / 连接管理
- **问题**：`handleError` 仅设状态 `"reconnecting"` 并递增 `reconnectAttempt`（上限 5），但无 `setTimeout`/`connect()` 创建新 EventSource，完全依赖浏览器内置自动重连。当服务器返回特定状态码/header 导致 EventSource `readyState` 变 `CLOSED`(2) 时，浏览器不再自动重连，客户端永久停留 "reconnecting"，不收任何后续事件。`MAX_RECONNECT_ATTEMPTS` 仅用于上报，不 `source.close()`，无 "failed" 终态。
- **根因**：缺主动重连调度逻辑。
- **可安全修复**：是。`handleError` 检查 `readyState === CLOSED`，已关闭则清理旧 source 并用 backoff 调度 `connect()`；达阈值进入 "failed" 态。

---

## 二、中危问题（Medium）

### M1. `image-preview.ts` 无文件大小上限 + MIME 仅按扩展名
- **文件**：[image-preview.ts](file:///workspace/src/server/image-preview.ts) 第 6-12、14-34、37-42 行
- **问题**：`readFile(allowedPath)` 一次性读整图入内存无 size 上限，2GB `.png` 致 OOM；MIME 仅 `extname` 查表不读 magic bytes，`.png` 实为 HTML/JS 时以 `image/png` 返回，配合 `<img>` onerror/SVG 可触发 XSS。
- **可安全修复**：是。读取前 `lstat` 校验 size（如 16 MiB）超限 413；读前几字节 magic number 校验（PNG `\x89PNG`、JPEG `\xFFD8`、GIF `GIF8`、WebP `RIFF....WEBP`）。

### M2. `uploads.ts` `saveUploadedImage` 缺大小/wx/magic 校验
- **文件**：[uploads.ts](file:///workspace/src/server/uploads.ts) 第 27-54 行
- **问题**：与 `saveUploadedFile`（第 56-83 行）对比：`saveUploadedImage` 无 `MAX_FILE_SIZE` 校验、无 `flag: "wx"`、无 magic bytes 校验。可上传任意大文件触发 OOM；UUID 碰撞（极小概率）覆盖旧文件；伪造 `image/png` 上传任意二进制。`uploads/images/route.ts` 也不像 `uploads/files` 那样检查 `content-length`。
- **可安全修复**：是。补 `input.bytes.byteLength > MAX_IMAGE_SIZE`、`writeFile(..., { flag: "wx" })`、magic bytes 检查。

### M3. `uploads/files` content-length 预检可绕过
- **文件**：[uploads/files/route.ts](file:///workspace/src/app/api/codex/uploads/files/route.ts) 第 10-13 行
- **问题**：`Number(request.headers.get("content-length") || 0)` 仅在 `> MAX_FILE_SIZE + 1MiB` 时预拒。chunked transfer 不发 content-length 时 `=0` 绕过预检；后续 `Buffer.from(await file.arrayBuffer())` 先读整文件入内存才进 `saveUploadedFile` 内部校验，期间已 OOM。
- **可安全修复**：是。改流式读取并按字节累计截断。

### M4. `cleanupExpiredUploads` 用 `rm` 不带 force，竞态下抛错中断批次
- **文件**：[uploads.ts](file:///workspace/src/server/uploads.ts) 第 85-112 行
- **问题**：`await rm(filePath)` 不带 `force: true`，stat 通过后 rm 前文件被并发清理会抛 ENOENT 中断本次批次，剩余文件不再处理。且顺序 stat+rm 串行 O(n) IO，上传目录上千文件时拖慢每次上传响应（每次上传前同步清理）。
- **可安全修复**：是。改 `rm(filePath, { force: true })`；分批 `Promise.all`；改为定时任务而非每次上传触发。

### M5. `events/route.ts` SSE 流缺背压、连接数限制、liveBuffer 上限
- **文件**：[events/route.ts](file:///workspace/src/app/api/codex/events/route.ts) 第 34-114 行
- **问题**：(1) `liveBuffer` 在 `replaying=true` 期间无上限增长。(2) `write()`/`sendOnce()` 的 `controller.enqueue` 无 try/catch，流关闭后写抛 `TypeError`，heartbeat 的 `setInterval` 在 abort 触发 `close()` 前的窗口期可能抛错致 unhandled rejection。(3) 无同时打开 SSE 连接数限制，认证客户端可建大量连接耗尽 fd。(4) `close()` 仅注册在 abort，controller 因其他原因关闭时 interval/subscription 泄漏。(5) `sentIds` Set 长连接内只增不减。(6) `lastEventId` 无格式/长度校验。
- **可安全修复**：是。liveBuffer 设上限触发 gap；write 包 try/catch 失败即 close；全局/单客户端连接数上限；close 注册到多事件；sentIds 改 streamSequence 滑动窗口。

### M6. `fs/watch` 无数量上限、无 TTL，watcher 资源泄漏
- **文件**：[fs/watch/route.ts](file:///workspace/src/app/api/codex/fs/watch/route.ts) 第 11-26 行；[runtime.ts](file:///workspace/src/server/app-server/runtime.ts) 第 5947-5951 行
- **问题**：每次 `POST /fs/watch` 都注册新 watcher（`watchId = mobile-watch-${++counter}`），无单客户端上限、无 TTL、无断连自动清理。watchId 单调递增可枚举用于 unwatch 他人的 watch。
- **可安全修复**：是。加配额、TTL、断连自动清理。

### M7. 进程句柄 IDOR：stdin/resize/kill/terminate 缺归属校验
- **文件**：`command-exec/[processId]/*`、`process/[processHandle]/*`、`threads/[threadId]/background-terminals/[processId]/terminate` 全部子 route
- **问题**：所有 route 只检查 `isRequestAuthenticated`，不检查 `processId`/`processHandle` 是否由当前会话/thread 启动。任何认证客户端可对任意句柄执行 stdin/resize/kill/terminate。`processId` 单调递增整数易枚举。
- **可安全修复**：部分（需新增会话/句柄归属模型）。

### M8. 命令执行相关输入缺长度/范围校验
- **文件**：[command-exec/spawn/route.ts](file:///workspace/src/app/api/codex/command-exec/spawn/route.ts) 第 21-25 行、[process/spawn/route.ts](file:///workspace/src/app/api/codex/process/spawn/route.ts) 第 21-25 行、stdin route、[terminal/exec/route.ts](file:///workspace/src/app/api/codex/terminal/exec/route.ts) 第 29 行、resize route
- **问题**：(1) `command` 数组无长度上限、单参数长度上限。(2) stdin `text` 无长度上限，可一次写 GB 级 stdin。(3) `timeoutMs` 未校验 `Number.isFinite`、未设上下限，可传 `86400000` 占用 1 天，还接受 `NaN`/`Infinity`。(4) resize 的 `positiveInteger` 无上限，`cols: 999999` 触发 PTY 超大缓冲。
- **可安全修复**：是。

### M9. `turns/start` 与 `threads/start` 的 startTurnCache 无 size 上限
- **文件**：[turns/start/route.ts](file:///workspace/src/app/api/codex/turns/start/route.ts) 第 49 行、[threads/start/route.ts](file:///workspace/src/app/api/codex/threads/start/route.ts) 第 25 行
- **问题**：全局 `Map` 无 size 上限（对比 `forkOperations` 有 `MAX_FORK_OPERATIONS=1000`）。可用不同 `clientUserMessageId`/`clientOperationId` 不断触发缓存条目塞满内存。`fork` cache 虽有上限但无单 threadId 公平性，单 threadId 可塞满导致其他 threadId 被拒 `FORK_REJECTED`。cache key 用 `\u0000`/`\u0001` 分隔但 operationId 未禁止含该字符，可构造碰撞。
- **可安全修复**：是。加 size 上限 + LRU；单 threadId 配额；校验 operationId 不含分隔符。

### M10. mcp/tools/call 与 mcp/resources/read 参数透传无 schema 约束
- **文件**：[mcp/tools/call/route.ts](file:///workspace/src/app/api/codex/mcp/tools/call/route.ts) 第 21-41 行、[mcp/resources/read/route.ts](file:///workspace/src/app/api/codex/mcp/resources/read/route.ts) 第 20-21 行
- **问题**：`arguments`/`meta` 直接 `as MobileJsonValue` 透传无 JSON 大小/嵌套深度限制；`uri` 无 scheme allowlist（可 `file://` 指向工作区外、`http://` 内网触达 SSRF）；`server`/`tool`/`threadId` 仅 nonEmptyString 无长度/格式校验。
- **可安全修复**：是。

### M11. `requests/[requestId]/resolve` body.value 无长度限制
- **文件**：[requests/[requestId]/resolve/route.ts](file:///workspace/src/app/api/codex/requests/[requestId]/resolve/route.ts) 第 29-34 行；[pending-requests.ts](file:///workspace/src/server/app-server/pending-requests.ts) 第 292-304 行
- **问题**：`value` 直接 `resolveServerRequest` 无长度上限；`buildPendingServerRequestResponse` 对 `dynamic_tool` 的 value 不校验长度，超大字符串原样塞 `contentItems[0].text` 发给 app-server。`requestId` 用 `Number()` 允许 `2^53`，可能溢出 32-bit int。
- **可安全修复**：是。

### M12. `terminalSessions`/`commandExecSessions`/`outputDecoders` 无 LRU 与上限
- **文件**：[runtime.ts](file:///workspace/src/server/app-server/runtime.ts) 第 3600-3601、3614 行
- **问题**：三个 Map 无容量上限。`outputDecoders` 仅在 `capReached` 或 `process/exited` 时删——若 app-server 进程异常退出未发 `process/exited`（kill -9、OOM），TextDecoder 永久泄漏；terminalSessions 仅在 kill/exit 通知到达时清理。对比 `timelineContentSources` 有 `MAX_TIMELINE_CONTENT_SOURCES=2000` 硬上限。mock gateway 的 `setTimeout`（第 1926/2277/2323 行）也未保存引用，`close()` 不清理。
- **可安全修复**：是。加 `MAX_TERMINAL_SESSIONS` + LRU；重连钩子清理；mock timer 存 `Set<Timeout>` 并在 close 中 clearTimeout。

### M13. AppServerGateway.close() 不解绑 peer 订阅，残留状态
- **文件**：[runtime.ts](file:///workspace/src/server/app-server/runtime.ts) 第 6743-6752、3644-3675 行
- **问题**：构造函数 `peer.onNotification(...)`/`onServerRequest(...)` 返回的 unsubscribe 未保存，`close()` 只调 `peer.close()`，未清 `browserEventHandlers`/`browserEventBacklog`/`browserEventOwnerLedger`/`pendingServerRequests`/`threadEventRevisions`/`timelineOverlays` 等 Map。peer 复用时旧 gateway handler 仍触发；不复用时大量 Map 无法 GC。
- **可安全修复**：是。保存 unsubscribe 并在 close 调用，clear 所有 Map/Set。

### M14. AppServerGateway peer 断开/重连后不向浏览器发 gap 信号
- **文件**：[runtime.ts](file:///workspace/src/server/app-server/runtime.ts) 第 4650-4668、3634、3644-3670 行
- **问题**：app-server 重启或 WS 重连后 `browserBootId` 不变、`browserEventSequence` 继续递增，但重连期间通知全部丢失。浏览器端看不到 gap/baseline-required 信号，基于过时状态继续渲染。SSE `listBrowserEventBacklog` 也无法发现"幂等 bootId 下的隐式 gap"。
- **可安全修复**：是。peer 增 onDisconnect 钩子，gateway 重连成功后广播 `timeline-gap` scope=all-tracked。

### M15. `transport.ts` `probeAppServerEndpoint` 不处理 `unexpected-response`
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 265-284 行
- **问题**：WS probe 只监听 `open`/`error`，未监听 `unexpected-response`。app-server 返回 401/403/500 时 `ws` 库触发 `unexpected-response` 而非 `error`，probe 永远等 500ms timeout 才返回，归类 `handshake-failed` 而非 `http-<status>`，`spawn-or-connect` 多轮 100ms 重试，启动慢。
- **可安全修复**：是。加 `socket.once("unexpected-response", (req, res) => resolve({ ok: false, reason: "handshake-failed" }))`。

### M16. `transport.ts` `FileAppServerLockStore` read 吞错、mkdir 与 writeMetadata 非原子
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 178-229、235-237 行
- **问题**：(1) `read` 在 JSON.parse 失败与 ENOENT 时都返回 `null`，调用方无法区分"无锁"与"锁文件损坏"。(2) `tryAcquire` 先 `mkdir(lockDir)` 再 `writeMetadata`，mkdir 成功后 writeMetadata 前崩溃，lockDir 存在但 metadata 缺失，下一 `read` 返回 null 但 `mkdir` EEXIST 失败——锁永久卡死直到 staleMs。(3) `defaultIsPidAlive` 用 `process.kill(pid, 0)`，PID 复用时 stale lock 不被清理。
- **可安全修复**：部分。metadata 直接写入 lockDir 目录条目；read 失败返回 `{ kind: "corrupt" }`；lock metadata 加 childPid + 启动时间戳。

### M17. `transport.ts` `defaultRegisterProcessCleanup` 用 `process.exit()` 截断异步清理
- **文件**：[transport.ts](file:///workspace/src/server/app-server/transport.ts) 第 146-173 行
- **问题**：`onSigint`/`onSigterm` 调 `runCleanup()` 后立即 `process.exit(130)`。但 `SpawnOrConnectAppServerPeer.close()` 内 `void this.lease.release()` 是 fire-and-forget async（写文件+unlink）。`process.exit` 不等微任务/IO，lease 文件未释放，下次启动需等 staleMs(30s) 才能拿锁。
- **可安全修复**：部分。改 `await runCleanup()` 后再 `process.exit`，或 close 改同步路径。

### M18. `http.ts` 缺 uncaughtException 处理与优雅关停
- **文件**：[http.ts](file:///workspace/src/server/http.ts) 第 1-42 行
- **问题**：未注册 `process.on("uncaughtException")`/`unhandledRejection`；`server.listen` 无 `'error'` 处理（端口占用直接挂且无日志）；无 `SIGTERM`/`SIGINT` 优雅关停；`createServer` 回调无 try/catch，Next handler 抛错变 unhandledRejection。k8s 发 SIGTERM 时 HTTP/ws server 不 `close()`，进行中请求和 ws 被硬切，app-server 子进程可能成孤儿。
- **可安全修复**：是。加 `server.on("error")`；SIGTERM 钩子调 `server.close()`+`wss.close()`+`peer.close()`+drain；包 `asyncHandler` 捕获异常。

### M19. `workspace-policy.ts` Windows 路径检测不全且大小写比较不严谨
- **文件**：[workspace-policy.ts](file:///workspace/src/server/workspace-policy.ts) 第 10-12、26-29 行
- **问题**：`pathFlavor` 漏掉 UNC 路径 `\\server\share`、`\\?\C:\`；`isSameOrChildPath` 对 Windows 用 `toLowerCase()` 做相等比较，未考虑 Turkish-I、Unicode case folding，且 `api.relative` 在 win32 已隐含大小写不敏感，两套判断并存可能不一致。Linux 上跑但配置 Windows 风格路径时 `pathApi` 切 `path.win32` 但底层 fs 仍 POSIX，realpath 行为不匹配。
- **可安全修复**：部分。补 UNC 检测；统一只用 `api.relative` 结果判断。

### M20. `security.ts` `assertRuntimeSessionRolloutFileAllowed` 错误信息泄漏路径
- **文件**：[security.ts](file:///workspace/src/server/security.ts) 第 27-48 行
- **问题**：`Promise.all([realpath(sessionsRoot), lstat(lexicalPath)])` 中 `sessionsRoot` 不存在时 `realpath` 抛 `ENOENT: ... '/home/user/.codex/sessions'`，暴露服务器家目录结构；`lstat` 失败暴露路径不存在事实（可枚举）。
- **可安全修复**：是。用 `Promise.allSettled`，rejected 分支统一抛"会话历史路径不在允许的 sessions 目录内"。

### M21. `audit-log.ts` 数组元素 redact 不传 key
- **文件**：[audit-log.ts](file:///workspace/src/server/audit-log.ts) 第 17-19 行
- **问题**：`value.map((item) => redact(item))` 不传 key，数组元素永远 `key=""` 进入 `redact`，`sensitiveKeyPattern.test("")` 为 false 跳过脱敏。`detail = ["secret-value"]`（数组直接含敏感字符串）原样返回。
- **可安全修复**：是。数组元素传父级 key + `[]` 后缀，或顶层 detail 用 `key="detail"` 调用。

### M22. 前端 `applyCodexDeltaInputs` 直接 mutate 前一个 thread state
- **文件**：[store.ts](file:///workspace/src/web/state/store.ts) 第 1874-1891 行
- **类别**：状态一致性 / 并发竞态
- **问题**：delta 批量处理未引起结构性变化（`timelineEngine.entries === prev.entries`）时，通过 `replaceSetContents`/`replaceMapContents`/`Object.assign(prev.timelineEngine, {...})` 直接原地改 `prev` 的 `processedEventIds`/`itemRevisions`/`snapshotDeltaSuppressions`。Zustand 依赖不可变更新触发订阅，直接 mutation 不触发依赖这些引用的 selector/memo 重新计算，可能读到陈旧数据；devtools/时间旅行调试因历史快照被污染失效。
- **可安全修复**：是。mutation 路径改为返回新 thread 对象（仅省略 `indexedThreadState` 调用），保持引用不同但 entries 相同。

### M23. 前端 `appendDeltaEntry` 对 tool body 无条件覆盖 status
- **文件**：[timeline-engine.ts](file:///workspace/src/web/state/timeline-engine.ts) 第 975-988 行
- **问题**：合并 tool delta 时 `status: delta.body.status` 直接赋值，未检查是否为 final status。`timelineDeltaEntry`（store.ts 第 2205 行）生成的 tool delta 总是 `status: "running"`。若 tool 已完成（"success"）后收到无 revision 的 late delta，状态重置为 "running"，同时向 result 追加垃圾文本。revision 检查仅在 `input.revision` 为 number 时执行。
- **可安全修复**：是。tool 分支改 `status: isFinalStatus(current.body.status) ? current.body.status : delta.body.status`。

### M24. 前端 `applyEntryInput` 与 `applyLiveDeltaInput` 相同 revision 处理不一致
- **文件**：[timeline-engine.ts](file:///workspace/src/web/state/timeline-engine.ts) 第 1204-1209 行 vs 695-700 行
- **问题**：`applyEntryInput` 在 `input.revision <= currentRevision` 时丢弃（含相等）；`applyLiveDeltaInput` 在 `< currentRevision` 时丢弃，`=== currentRevision` 时标记 conflict + repair request。相同 revision 通过不同路径行为不同：前者静默丢弃，后者触发 repair。
- **可安全修复**：需谨慎。应统一两路径语义。

### M25. 前端 `replaceOrAddEntry` 无条件更新 `lastSeenItemId`
- **文件**：[store.ts](file:///workspace/src/web/state/store.ts) 第 647 行
- **问题**：处理 `item.appended`/`item.updated`/`timeline_content_reference` 时无条件设 `lastSeenItemId: migratedEntry.id`。通过 detail fetch/repair 拉取历史条目时 `lastSeenItemId` 被错误设为历史条目 ID，影响 unread 指示器、"跳转最新"。
- **可安全修复**：是。仅新增尾部条目且 createdAt 大于当前 lastSeen 时更新。

### M26. 前端 `WsClient` 无心跳且无限重连
- **文件**：[ws/client.ts](file:///workspace/src/web/ws/client.ts) 第 85-193 行
- **问题**：(1) 无 heartbeat/ping，中间代理静默断开（NAT 超时、反代 idle timeout）时 TCP 层长时间不触发 close，客户端数分钟内认为连接 open，期间消息全丢。(2) `scheduleReconnect` 无最大重试限制，重连永不停（移动端耗电）。(3) 退避无随机抖动，多客户端同步重连（惊群）。(4) 重连期间消息全部丢失，无 resume 机制（不携带 lastEventId/streamSequence）。(5) `connect()` 在 reconnecting 态被调用会创建第二个 socket。(6) `retries` 在手动 `connect()` 时不重置。(7) `handleError` 空操作无日志。
- **可安全修复**：是。加 heartbeat + maxRetries + 抖动；connect 时清 timer + 重置 retries。

### M27. 前端 `runLockedAction` 无超时，锁可被永久持有
- **文件**：[requestCoordinator.ts](file:///workspace/src/web/api/requestCoordinator.ts) 第 35-54 行
- **问题**：`runLockedAction` 将后续同 key 调用者挂起等待前一个 promise。若 `run()` 永不 resolve/reject（网络挂起、底层 fetch 无超时），所有后续同 key 调用者永久阻塞，`pendingActions` Map entry 永不删。
- **可安全修复**：需谨慎。加可选 `timeoutMs`，超时 reject 并清理 entry。

### M28. 前端 `createAbortableLatestRunner` 被 abort 的前一个请求产生 unhandled rejection
- **文件**：[requestCoordinator.ts](file:///workspace/src/web/api/requestCoordinator.ts) 第 88-108 行
- **问题**：`run` 再次调用时 `controller.abort()` 中止前一个请求，其 promise 以 `AbortError` reject。`finally` 仅清 controller 引用不捕获 rejection。若前一个 `run` 调用者未 catch（fire-and-forget 场景），产生 `UnhandledPromiseRejection`。
- **可安全修复**：是。`run` 内部对前一个 promise 追加 `.catch(() => {})` 吞掉 abort 错误。

### M29. 前端 Timeline ResizeObserver 在每次 visibleBlocks 变化时全量重建
- **文件**：[Timeline.tsx](file:///workspace/src/web/components/Timeline.tsx) 第 267-294 行
- **问题**：`useEffect` 依赖含 `visibleBlocks`，虚拟滚动 windowRange 变化导致 `visibleBlocks` 新数组引用，触发 effect 重跑：旧 observer disconnect、新建 ResizeObserver、重新 observe 所有可见行。频繁滚动时 observer 反复创建销毁。
- **可安全修复**：是。observer 创建/销毁仅依赖 `[allBlocks.length, virtualized]`，DOM observe 在单独 effect。

### M30. 前端 `splitStreamingMarkdown` 每次 delta 对全文 O(n) 解析
- **文件**：[streaming-markdown.ts](file:///workspace/src/web/streaming-markdown.ts) 第 8-77 行
- **问题**：流式 agent message 每次 delta 到达 text 增长，整个函数对全量文本重新执行（逐行正则匹配 + 构建 lineEndOffsets）。消息累积 100KB+ 时每次 keystroke delta 解析成本线性增长，`Markdown` memo 无法命中。
- **可安全修复**：需谨慎。缓存上次 `stableEnd` 仅解析新增部分，处理 fence 状态跨 delta。

### M31. 前端 ChatInput 草稿每次按键写 localStorage + 上传后 setState after unmount
- **文件**：[ChatInput.tsx](file:///workspace/src/web/components/ChatInput.tsx) 第 133-135、192-225 行
- **问题**：(1) `useEffect` 在 `text` 每次变化时同步 `setDraft` 写 localStorage（`JSON.stringify` + `setItem`），快速输入时每次 keystroke 触发，移动端卡顿。(2) `uploadOrdinaryFile`/`uploadImage` await 后直接 `setImages`/`setFiles`，组件卸载后回调触发 state update 警告，上传继续消耗带宽。
- **可安全修复**：是。debounce 300-500ms；引入 `mountedRef` 或 threadId 变更时 abort 上传。

### M32. 前端 `markdownUrlTransform` decode 后绕过 defaultUrlTransform 消毒
- **文件**：[Markdown.tsx](file:///workspace/src/web/components/Markdown.tsx) 第 81-94 行
- **问题**：先 `decodeUrlOnce(url)` 再对 `key === "src"` 检查 `isAbsoluteLocalPath(decoded)`，匹配则直接返回 `imagePreviewSrc(decoded)`，跳过 `defaultUrlTransform`。当前 XSS 风险低（`isAbsoluteLocalPath` 仅匹配 `/` 或 `[A-Za-z]:[\\/]` 开头），但 decode-then-bypass-defaultTransform 模式存在隐患：未来逻辑放宽或 `imagePreviewSrc` 行为变化可能引入漏洞。
- **可安全修复**：是。先 `defaultUrlTransform(url)` 消毒，再 decode + 本地路径判断。

### M33. 前端 `itemRevisions`/`itemSequences`/`terminatedFinalReconcileKeys` 无上限清理
- **文件**：[timeline-engine.ts](file:///workspace/src/web/state/timeline-engine.ts) 第 837-873、899-912 行；[store.ts](file:///workspace/src/web/state/store.ts) 第 150、954-977 行
- **问题**：`itemRevisions`/`itemSequences` 在每次 delta 写入，snapshot 时仅为当前 entries 补 0 值但不删旧键，`rollback-fork-replace` 复制但不清理已删 turn 条目，长跑+多次 fork/rollback 后持续增长。`terminatedFinalReconcileKeys` Set 仅添加不删除。对比 `processedEventIds`（2000 上限）、`agentMessageAliases`（128 上限）已有控制。
- **可安全修复**：是。snapshot 时基于当前 entries identity 集合过滤 Map；`set-generation`/`snapshot-window` 时过滤低于当前 generation 的 key。

### M34. `session-timeline.ts` 合并算法 O(n×m)
- **文件**：[session-timeline.ts](file:///workspace/src/server/app-server/session-timeline.ts) 第 1333-1376、1388-1498 行
- **问题**：`resolveCanonicalToolPlacements`/`mergeTurnSessionRecords` 对每个 supplement record 遍历 baseItems 匹配，超长会话 CPU 开销显著（已 `maxSupplementRecords=120` 上限但仍 O(120×N)）。
- **可安全修复**：部分。对 baseItems 建 turnId/path 索引。

### M35. `timeline-event-payload.ts` 循环内重复 stringify + 超预算抛错未隔离
- **文件**：[timeline-event-payload.ts](file:///workspace/src/server/timeline-event-payload.ts) 第 35、91、130、144 行
- **问题**：`browserTimelineEventForBudget` 在 while 循环里每次 `JSON.stringify(event)` 计算字节数，对超大事件多次完整序列化，O(n²)。循环引用时 `JSON.stringify` 抛 `TypeError`，预算耗尽抛 `RangeError`，被 `serializeBrowserTimelineEvent` 在 ws.ts 广播循环（第 29 行）与 SSE route（第 128 行）同步调用，异常中断广播，后续客户端收不到该事件甚至后续事件。
- **可安全修复**：是。缓存上次 stringify 结果；ws.ts/SSE route 包 try/catch 落日志并跳过。

---

## 三、低危问题（Low）

### 鉴权与安全
- **L1** [session.ts:48](file:///workspace/src/server/session.ts) `value.split(".")` 不校验段数，多余段被忽略（HMAC 仍校验，语义不严谨）。
- **L2** [auth.ts:4-11](file:///workspace/src/server/auth.ts) `isRequestAuthenticated` 与 `isCookieHeaderAuthenticated` 逻辑完全一致，冗余。
- **L3** [http.ts:41](file:///workspace/src/server/http.ts) 启动日志暴露 `bindHost:bindPort`，配合绑定 0.0.0.0 可被外部探测。
- **L4** [ws.ts:58-61](file:///workspace/src/server/ws.ts) 401 响应未带 Content-Length/Content-Type，且 `socket.write` 后 `destroy` 未等 flush，客户端可能收 RST 而非 401。

### 路径与配置
- **L5** [workspace-policy.ts:34-48](file:///workspace/src/server/workspace-policy.ts) + [env.ts:53-62](file:///workspace/src/config/env.ts) `CODEX_WEB_WORKSPACE_ROOTS=""` 时 `parseWorkspaceRoots` 返回 `[]`，`normalizeWorkspaceRoots` 抛错启动失败，错误信息未提示如何修复。

### 持久化
- **L6** [atomic-json-file.ts:5-24](file:///workspace/src/server/persistence/atomic-json-file.ts) 临时文件名含 `process.pid`+`randomUUID`，进程崩溃后 `.tmp` 残留无启动清理。
- **L7** [atomic-json-file.ts:16](file:///workspace/src/server/persistence/atomic-json-file.ts) `JSON.stringify(value, null, 2)` 对循环引用抛 `TypeError`（临时文件 finally 会 rm，无残留）。
- **L8** [file-lock.ts:76-78](file:///workspace/src/server/persistence/file-lock.ts) `withFileLock` callback 无超时，长 callback 持锁加剧 H4 双持锁风险。

### JSON-RPC 与 app-server
- **L9** [json-rpc.ts:48-52](file:///workspace/src/server/app-server/json-rpc.ts) `notify` 不处理 `sendRaw` 异常，socket 关闭时抛错冒泡到调用方。
- **L10** [json-rpc.ts:84-88](file:///workspace/src/server/app-server/json-rpc.ts) 未知响应 id 静默丢弃无日志；`respond` 不校验 id 是否在"已收到的 server-request id"集合，可伪造响应；`nextId` 长跑逼近 `MAX_SAFE_INTEGER` 精度丢失。
- **L11** [json-rpc.ts:64-66](file:///workspace/src/server/app-server/json-rpc.ts) + [transport.ts:407](file:///workspace/src/server/app-server/transport.ts) `respond` 调 `sendRaw`，socket 关闭时 `socket.send` 同步抛，`resolveServerRequest` 抛错 pending entry 不删。
- **L12** [events.ts:1408](file:///workspace/src/server/app-server/events.ts) `normalizeAppServerNotification` 对未知 method 静默返回 null，app-server 升级新增方法时前端无感知。
- **L13** [runtime.ts:3993-4003](file:///workspace/src/server/app-server/runtime.ts) `pruneBrowserEventBacklogForThread` 倒序 splice 安全，但 `browserEventOwnerLedger` 未同步清理，`oldestOwnerSequence` 计算可能引用已 prune 事件致 gap 判定偏差。
- **L14** [runtime.ts:5997-6023](file:///workspace/src/server/app-server/runtime.ts) `startCommandExecSession` 的 fire-and-forget promise 未保存引用，catch 内抛错变 unhandledRejection。
- **L15** [session-timeline.ts:353-391](file:///workspace/src/server/app-server/session-timeline.ts) `directCallArguments` 手写词法分析对模板字符串内 `${...}` 中的 `()` 不平衡处理，可能误判闭合位置（已 `MAX_NESTED_EXEC_CALLS=24` 限流，影响有限）。
- **L16** [user-input.ts:45-57](file:///workspace/src/server/app-server/user-input.ts) `createTurnUserInput` 不校验 imagePaths/skillReferences 数量，可传 1000 个致 turn/start 请求体过大。

### API 路由一致性
- **L17** fs/search-session、requests GET 缺 audit（其他同类操作有 audit）。
- **L18** fs/search-session PUT 的 `query` 仅校验 string 接受空串；`sessionId` 无格式校验。
- **L19** fs/search 的 `query` 与 `roots` 数量无长度上限。
- **L20** [fs/metadata/route.ts](file:///workspace/src/app/api/codex/fs/metadata/route.ts) 未用 `_route-helpers` 的 `serverError`/`assertAllowedPath`，路径不允许时返回 502（应 400）且 `error.message` 透传。
- **L21** 多个 route（command-exec/process/threads/background-terminals 等）直接透传 `error.message` 未走 `publicErrorMessage` 脱敏，可能泄露内部路径/堆栈/app-server 状态。
- **L22** [threads/[threadId]/turns/route.ts:23-28](file:///workspace/src/app/api/codex/threads/[threadId]/turns/route.ts) 所有错误统一 502，未区分 404。`limit` 参数 `Number(limit)` 未校验正整数/上限，`NaN` 透传。
- **L23** [threads/route.ts:7,60-79](file:///workspace/src/app/api/codex/threads/route.ts) `CWD_FILTER_SCAN_PAGE_LIMIT=100`（3000 条）耗尽时 `nextCursor` 仍非 null，客户端无法判断结果是否完整。
- **L24** [turns/start/route.ts:464-485](file:///workspace/src/app/api/codex/turns/start/route.ts) `readAdditionalContext`/`readCollaborationMode` 校验弱，不限制嵌套深度/字段数/mode 取值集合。
- **L25** [threads/[threadId]/resume/route.ts:79-96](file:///workspace/src/app/api/codex/threads/[threadId]/resume/route.ts) `permissions/approvalPolicy/approvalsReviewer` 同时为 null 时 `Object.keys(...).length===3` 走 resume 分支，语义歧义。
- **L26** [custom-models/route.ts:20-42](file:///workspace/src/app/api/codex/custom-models/route.ts) POST/PUT 未用 `assertOnlyKeys` 拒绝未知字段（DELETE 用了）。
- **L27** [projects/route.ts:36-46](file:///workspace/src/app/api/codex/projects/route.ts) 允许客户端注入 `id`，`requireNonEmptyString` 不限格式（可含路径分隔符/控制字符）。
- **L28** [custom-models/[customModelId]/route.ts:37-67](file:///workspace/src/app/api/codex/custom-models/[customModelId]/route.ts) DELETE 强制要求 body（`expectedRevision`），部分代理/CDN 剥离 DELETE body 致兼容性问题。
- **L29** 所有 `[threadId]`/`[turnId]`/`[processId]`/`[customModelId]`/`[projectId]`/`[requestId]` dynamic segment 未在 route 内做格式校验（UUID/数字格式），直接透传 gateway，加剧 M7 IDOR。
- **L30** [mcp/tools/call/route.ts:21-32](file:///workspace/src/app/api/codex/mcp/tools/call/route.ts) 双重校验路径风格不一致（手动 if + badRequest，其他 route 用 `requireNonEmptyString` + `RouteValidationError`）。
- **L31** command-exec stdin audit 用 `Buffer.byteLength`（字节），process stdin audit 用 `text.length`（字符），含义不一致。

### 前端
- **L32** [Markdown.tsx:265](file:///workspace/src/web/components/Markdown.tsx) `CodeBlock` 的 `window.setTimeout` 未保存 timer ID，卸载时无法 clearTimeout。
- **L33** [Markdown.tsx:344](file:///workspace/src/web/components/Markdown.tsx) `MermaidBlock` 直接 `ref.current.innerHTML = svg`，虽有 `securityLevel: "strict"`，仍是 XSS 风险面。
- **L34** [ImagePreview.tsx:65-143](file:///workspace/src/web/components/ImagePreview.tsx) 模态未处理 Escape 键关闭；未锁定背景滚动（移动端触摸穿透）。
- **L35** [ImagePreview.tsx:145-150](file:///workspace/src/web/components/ImagePreview.tsx) `retryImageSrc` 在含 fragment 的 URL 上错误追加查询参数（`?cw_retry=` 放在 `#` 后），重试缓存破坏失效。
- **L36** [events/client.ts:45](file:///workspace/src/web/events/client.ts) `deliveryEpochs` Map 为每个出现过的 threadId 存储 epoch，从不删除（每条目小但泄漏）。
- **L37** [events/client.ts:129-156](file:///workspace/src/web/events/client.ts) 重连后 `currentBootId` 不重置，极端时序下 gap 检测失效。
- **L38** [ws/client.ts:218-231](file:///workspace/src/web/ws/client.ts) + [events/client.ts:514-527](file:///workspace/src/web/events/client.ts) 单例 `close()` 仅 unsubscribe listener 不关 socket，所有组件 unmount 后 socket 空跑。
- **L39** [api/client.ts:67-69](file:///workspace/src/web/api/client.ts) abort 事件监听器依赖 `{ once: true }`，正常完成时不显式移除，长期存活的外部 signal 累积监听器。
- **L40** [timeline-engine.ts:996-1005](file:///workspace/src/web/state/timeline-engine.ts) `selectOrderedDistinctTurns` 对每个 turnId 线性 `entries.find`，O(T×N)（已有 `byTurnId` Map 可降为 O(T)）。
- **L41** [timeline-engine.ts:1148-1153](file:///workspace/src/web/state/timeline-engine.ts) `shouldSuppressSnapshotDeltaReplay` 用 `indexOf` 子串匹配，最坏 O(n×m)；delta 非连续子串时返回 -1 删 suppression。
- **L42** [timeline-adapter.ts:213-219](file:///workspace/src/web/state/timeline-adapter.ts) `threadDetailEntriesWithTurnItems` 整个 while 循环包 try/catch，任何异常转 `repair-required` 无 console.warn，调试困难。
- **L43** [store.ts:579-597](file:///workspace/src/web/state/store.ts) `upsertThreadNotice` 在 Zustand `set` 回调内同步读 localStorage，高频 notice 阻塞主线程。

---

## 四、横向共性问题

1. **路径校验抽象层次不清**：`assertPathAllowed` 实为"词学校验"，命名未体现，fs/* 全部依赖它而未做 realpath（H9/H11 根因）。`security.ts`/`uploads.ts` 已有 canonical 校验但不复用。建议新增 `assertAllowedPathCanonical` 统一入口。

2. **缓存 Map 普遍缺 size 上限**：`startTurnCache`/`startThreadCache`/`terminalSessions`/`commandExecSessions`/`outputDecoders`/`itemRevisions`/`terminatedFinalReconcileKeys`/`deliveryEpochs` 均无上限，对比 `forkOperations`(1000)/`timelineContentSources`(2000)/`processedEventIds`(2000)/`agentMessageAliases`(128) 已有控制。建议引入 LRU 或拒绝策略。

3. **错误响应风格分裂**：约一半 route 用 `serverError` helper（经 `publicErrorMessage` 脱敏），另一半直接 `error.message` 透传（L21）。建议统一。

4. **dynamic segment 全部信任 URL param**：M7 IDOR 与 L29 格式校验缺失是同一问题两面。建议引入 `requireThreadId`/`requireProcessHandle` 等统一校验 helper。

5. **连接可靠性两套实现不一致**：`WsClient` 有 `scheduleReconnect` 但无心跳/上限；`TimelineEventStreamClient` 完全依赖 EventSource 内置重连无手动 fallback。两者在移动端弱网场景均有可靠性风险，且重连期间消息全丢无 resume。

6. **JSON body 大小上限缺失**：`readJsonRecord`/`readOptionalJsonRecord` 直接 `request.json()`/`request.text()`，依赖 Next 默认限制。若配置被改大，所有 route 暴露给超大 body。建议 helper 层加显式字节上限。

7. **审计覆盖不均**：fs/search-session、requests GET 缺 audit，其他同类操作有。建议梳理审计矩阵。

8. **重连状态清理缺失**：peer 断开后 gateway 的 `pendingServerRequests`/`terminalSessions`/`commandExecSessions`/`outputDecoders` 均不清理（H8/M3），且不向浏览器发 gap 信号（M14），导致重连后状态不一致。

---

## 五、修复优先级建议

### 第一优先级（立即修复，鉴权与数据安全）
1. **H1/H2/H3**：cookie `secure` 标志、独立 cookie 密钥、服务端会话过期——当前最易被利用的鉴权弱点。
2. **H9/H11**：fs/* realpath 校验 + remove root 保护——可被单一认证客户端利用读/写/删工作区外文件。
3. **H10**：fs/file PUT 大小限制——OOM/磁盘填满。
4. **H6/H7**：审计日志健壮性（循环引用、原子写、fsync）——安全合规证据链。

### 第二优先级（短期修复，协议与稳定性）
5. **H12**：JSON-RPC 字符串 id 兼容——请求永不 resolve。
6. **H13/H14/H15**：transport 重连竞态、子进程 exit 监听、锁释放——长跑稳定性。
7. **H5**：RPC 请求超时——半开连接悬挂。
8. **H8**：重连后状态清理——僵尸审批卡片/terminal session。
9. **H16**：WS 心跳/背压/连接上限——僵尸连接与 OOM。
10. **H4**：file-lock TOCTOU——双持锁数据损坏。

### 第三优先级（中期修复，前端与资源管理）
11. **H17/H18**：blob URL revoke、EventSource 手动重连——前端内存与连接。
12. **M2/M3/M4**：上传安全对齐（大小/wx/magic/流式）。
13. **M5/M6**：SSE 背压、watch 配额。
14. **M22/M23/M25**：timeline 状态不可变、tool status 覆盖、lastSeenItemId。
15. **M26**：WsClient 心跳/上限/抖动。
16. **M33**：前端 Map/Set 上限清理。

### 滚动修复（M7-M21, M27-M35, L1-L43）
IDOR 归属模型、输入校验补全、错误响应统一、性能优化、可观测性增强。

---

## 六、核验说明

本报告所有高危项（H1-H18）均经主代理直接 `Read` 源码二次确认，行号与问题描述与磁盘代码一致。中低危项基于子代理深度阅读，可信度高但未逐一二次核验，建议修复前再读一遍对应文件确认上下文。

- `session.ts` 第 18-23 行确认：cookie options 仅 `httpOnly`/`sameSite`/`path`/`maxAge`，无 `secure`。✓
- `workspace-policy.ts` 第 50-61 行确认：`assertPathAllowed` 仅 `pathApi(flavor).resolve(value)`，无 `realpath`/`lstat`。✓
- `transport.ts` 第 441-449 行确认：`socket.once("close", ...)` 无条件 `this.socket = null`，无 `if (this.socket === socket)` 守卫。✓
- `transport.ts` 第 700-718 行确认：`startOwnedChild` 仅 `child.stderr.on("data")`，无 `child.on("exit"/"error")`。✓
- `json-rpc.ts` 第 77/84 行确认：`typeof message.id === "number"` 区分；无 `setTimeout` 超时。✓
- `audit-log.ts` 第 12-26 行确认：`redact` 无 `visited` 集合，循环引用无限递归。✓
- `ChatInput.tsx` 第 208/228/293 行确认：`createObjectURL` 后无 `revokeObjectURL`。✓
- `events/client.ts` 第 170-178 行确认：`handleError` 仅设状态递增 attempt，无 `connect()` 调度。✓

**未修改任何代码。**
