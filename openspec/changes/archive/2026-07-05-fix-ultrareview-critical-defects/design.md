## Context

当前移动端 Web 后端是浏览器到 Codex app-server 的安全代理。Ultrareview 发现的问题横跨 API route、app-server JSON-RPC transport、timeline event stream、审批卡和登录状态：部分路径字段未经 allowlist 校验即透传，部分协议通知没有转发或响应构造不匹配，部分 timeline 分页/恢复没有保持正序，长连接在登出后仍可能保留。

现有约束：
- 项目仍是个人自托管模式，不引入多用户权限模型。
- 现有 OpenSpec 明确列为 Open Questions 的取舍不纳入本次修复。
- 本次只做第一批高影响缺陷，优先修复安全边界、协议适配和数据正确性。

## Goals / Non-Goals

**Goals:**

- 让 Web 代理入口在调用 app-server 前拒绝明显 malformed body 和 workspace 外路径。
- 让 app-server 断线时已发 JSON-RPC 请求有确定失败路径，HTTP route 不永久悬挂。
- 让 thread resume 与 turns pagination 始终给前端正序 timeline。
- 让登出、登录重定向和 event stream 符合 Web session 边界。
- 让 server request resolved、dynamic tool response、config read 等协议适配与生成协议/规格一致。
- 为每类修复补定向回归测试，按 TDD 顺序先写失败用例。

**Non-Goals:**

- 不修复所有 ultrareview 中的 UI/文档漂移问题，例如页面过渡动画、相对时间、所有布局细节。
- 不改变个人自托管模型，不新增数据库、CSRF token 或多用户隔离。
- 不重构整个 app-server client/runtime，只做本次缺陷所需的最小边界改动。

## Decisions

1. 路径校验集中复用现有 `assertRuntimePathAllowed`。
   - 理由：当前 Files/Process/Turns 已使用这套策略，Windows/POSIX 行为已有测试。
   - 取舍：对 `feedback.extraLogFiles` 只允许 workspace roots 和 uploadDir，不允许浏览器任意指定日志路径；系统日志应由 app-server 的 `includeLogs` 自己处理。

2. app-server transport 在 WebSocket close/error 时 reject 所有 pending JSON-RPC。
   - 理由：这比自动重连更小，且不触碰 `process-exec` 中“是否自动重连”的 Open Question。
   - 取舍：断线中的请求会失败并由 route 返回 502；用户需要重试，但不会无限等待。

3. timeline turns 适配层统一把 app-server desc page reverse 成会话正序。
   - 理由：`threadDetail()` 和 rollback/fork 计算都把数组顺序视为会话顺序，分页 prepend 也要求页内正序。
   - 取舍：继续使用 app-server desc pagination 以拿最新窗口，只在 Web mobile view 适配层调整顺序。

4. 登录返回路径只接受站内绝对路径。
   - 理由：保留当前 `next` 兼容，同时新增规格要求的 `return` 支持，阻断外部跳转。
   - 取舍：非法返回值回退 `/projects`；不在本变更中统一历史 `/` 与 `/projects` 路由分歧。

5. server request 适配最小补齐而非重做审批模型。
   - 理由：本次必须修动态工具响应、外部 resolved 通知和 `requestId` 类型一致性；“审批卡保留灰态”的完整 UI 模型可在后续批次细化。
   - 取舍：本批优先避免 stale pending 可操作和错误响应；若需要完整历史灰态卡，可继续扩展 timeline entry 模型。

## Risks / Trade-offs

- `feedback.extraLogFiles` 收紧后，依赖浏览器传任意本机日志路径的临时调试流程会失败 → 使用 `includeLogs` 或把日志路径放到明确允许目录。
- app-server 断线 pending 立即失败可能暴露原先被悬挂掩盖的错误 → route 已有 502 错误通道，前端可按现有失败路径处理。
- turns pagination reverse 若 app-server 未来改默认排序，测试会捕获；代码应显式传 `sortDirection: "desc"`。
- 登录返回路径收紧可能改变手工构造的外部 `next` 链接行为 → 外部跳转本身不属于受支持功能。
