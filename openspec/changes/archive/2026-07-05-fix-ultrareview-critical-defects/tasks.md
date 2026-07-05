## 1. Web 代理路径与请求体校验

- [x] 1.1 为 `terminal/exec`、`threads?cwd`、`feedback.extraLogFiles`、external agent config、Windows Sandbox setup 编写失败优先的 route/handler 单测，覆盖缺失字段、错误类型、workspace 外路径和允许路径透传
- [x] 1.2 实现上述 route 的严格 JSON body 校验和 `assertRuntimePathAllowed` 校验，确保 malformed 请求返回 400 且不调用 app-server
- [x] 1.3 运行相关 route 单测，确认路径校验和 malformed body 场景全部通过

## 2. Skills config 与 config read

- [x] 2.1 为 `/api/codex/skills/config` 编写失败优先单测，覆盖字符串 `"false"` 被拒绝、boolean `false` 原样透传
- [x] 2.2 为 `GET /api/codex/config/value` 编写失败优先单测，覆盖已认证读取和未认证 401
- [x] 2.3 实现 Skills config boolean 校验和 config value GET route
- [x] 2.4 运行相关配置与 Skills route 单测

## 3. Timeline turns 顺序

- [x] 3.1 为 `resumeThread()` 与 `listThreadTurns()` 编写失败优先单测，覆盖 app-server desc page 被转换为会话正序、`lastTurnId` 使用最新 turn
- [x] 3.2 实现 app-server client 的 turns 正序适配，并显式传递 `sortDirection: "desc"`
- [x] 3.3 运行 app-server client 相关单测

## 4. JSON-RPC pending 生命周期

- [x] 4.1 为 JSON-RPC transport 编写失败优先单测，覆盖 request 发出后 socket close/error 会 reject 并清空 pending
- [x] 4.2 实现 pending request 统一失败入口，并在 WebSocket close/error 时调用
- [x] 4.3 运行 JSON-RPC 与 transport 相关单测

## 5. 登录、登出与浏览器事件流

- [x] 5.1 为登录返回路径 sanitizer 编写失败优先单测，覆盖 `return`、历史 `next`、外部 URL、scheme URL 和 protocol-relative URL
- [x] 5.2 为登出流程编写失败优先单测，覆盖调用 `resetTimelineEventStreamClient()` 关闭已有 EventSource
- [x] 5.3 实现登录返回路径站内化和登出事件流关闭
- [x] 5.4 运行 auth/session 与 web events 相关单测

## 6. Server request 与审批卡协议适配

- [x] 6.1 为 `serverRequest/resolved` 编写失败优先单测，覆盖 runtime 删除 pending request 并向浏览器发送 string `requestId`
- [x] 6.2 为 `dynamic_tool` 响应编写失败优先单测，覆盖 `submit` 构造成功响应、`fail` 构造失败响应
- [x] 6.3 为 `file_approval` 卡片编写失败优先单测，覆盖 request 中存在 diff/patch/file changes 时渲染可审查内容
- [x] 6.4 实现 server request resolved notification、dynamic tool action values 和 file approval diff 展示
- [x] 6.5 运行 pending requests、runtime/events、approval cards 相关单测

## 7. 收敛验证

- [x] 7.1 运行所有本变更影响范围的定向 Vitest 套件
- [x] 7.2 运行 OpenSpec status/apply 校验，确认任务状态与变更 artifacts 一致
