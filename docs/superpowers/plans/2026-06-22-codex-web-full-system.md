# Codex 移动端 Web 完整系统实施拆解

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成一个移动端 Web Codex 客户端，通过 Codex app-server 协议覆盖 VS Code Codex 插件的远程开发能力，而不是停留在 MVP。

**Architecture:** 前端保持手机单列工作台；后端作为唯一 app-server 协议代理，负责登录、工作区边界、app-server 进程/连接管理、事件规范化、上传暂存和审计日志。Codex agent、会话持久化、权限语义和工具执行仍由 Codex app-server 负责。

**Tech Stack:** TypeScript、Next.js App Router、React、Node.js、ws、Vitest、Playwright、Codex app-server generated TypeScript bindings。

---

## 完整验收边界

完成状态必须同时满足这些条件：

- 手机端 Web 可登录，浏览器无法直接拿到原始 app-server endpoint 或 token。
- Web 后端可在 `spawn`、`external`、`mock`、`off` 模式下运行；真实模式可连接 Codex app-server。
- 会话历史、搜索、读取、resume、turns/items 分页能从 Codex app-server 获取并在移动端切换。
- 新建会话、发送文本、发送图片、选择模型、选择思考强度、选择权限配置能通过 app-server 执行。
- 运行中的 turn 能展示 agent 文本增量、reasoning、计划、工具调用、命令输出、文件变更、diff 和 token 用量。
- 审批、question、MCP elicitation、动态工具调用等 `ServerRequest` 能在移动端弹层确认并回传 response。
- 支持 fork、rollback/编辑重发、interrupt、steer。
- Files、Terminal、Settings、Run 面板在手机视口可用。
- 所有敏感动作写入本地追加审计日志，不引入数据库。
- 完整验证包含单元测试、集成测试、手机端 E2E 和真实 Codex app-server 人工验收。

## Task 1: app-server 真实连接和状态基础

**Files:**

- Modify: `src/config/env.ts`
- Create: `src/server/app-server/transport.ts`
- Create: `src/server/app-server/runtime.ts`
- Create: `src/server/app-server/client.ts`
- Create: `src/app/api/codex/status/route.ts`
- Create: `src/app/api/codex/threads/route.ts`
- Create: `src/app/api/codex/models/route.ts`
- Modify: `src/components/MobileWorkbench.tsx`
- Test: `tests/unit/app-server-runtime.test.ts`
- Test: `tests/unit/codex-client.test.ts`
- Test: `tests/e2e/mobile-shell.spec.ts`

- [x] 支持 `CODEX_WEB_APP_SERVER_MODE=spawn|external|mock|off`。
- [x] 支持 `CODEX_WEB_APP_SERVER_URL` 连接已有 app-server。
- [x] 默认 `spawn` 模式只绑定 `127.0.0.1`。
- [x] `mock` 模式返回稳定会话和模型，供浏览器测试使用。
- [x] HTTP API 读取状态、会话列表、模型列表。
- [x] 移动端登录后展示会话历史和默认模型。
- [ ] 真实 `spawn` 模式下增加集成测试：启动 app-server、initialize、`thread/list`、`model/list`。

## Task 2: 会话读取、切换和分页

**Files:**

- Modify: `src/server/app-server/client.ts`
- Create: `src/app/api/codex/threads/[threadId]/route.ts`
- Create: `src/app/api/codex/threads/[threadId]/turns/route.ts`
- Create: `src/components/ThreadTimeline.tsx`
- Create: `src/components/ThreadHistorySheet.tsx`
- Test: `tests/unit/thread-view-model.test.ts`
- Test: `tests/e2e/thread-history.spec.ts`

- [ ] `thread/read` 支持 `includeTurns=true`。
- [ ] `thread/turns/list` 和 `thread/turns/items/list` 支持分页。
- [ ] 移动端可以从历史列表切换会话。
- [ ] timeline 渲染 user message、agent message、reasoning、plan、command、file change、tool call。
- [ ] 会话切换后顶部标题、状态、模型和 token 用量同步。

## Task 3: 新建会话和发送输入

**Files:**

- Modify: `src/server/app-server/client.ts`
- Create: `src/app/api/codex/threads/start/route.ts`
- Create: `src/app/api/codex/turns/start/route.ts`
- Modify: `src/components/MobileWorkbench.tsx`
- Create: `src/components/Composer.tsx`
- Test: `tests/unit/user-input.test.ts`
- Test: `tests/e2e/send-message.spec.ts`

- [x] `thread/start` 支持 cwd、workspace roots、model、permissions；思考强度按 app-server 协议在 `turn/start` 传递。
- [x] `turn/start` 支持文本输入。
- [x] 输入框适配手机键盘和安全区。
- [x] 发送后立即出现本地 pending 用户消息，并在 app-server 响应后替换为真实 turn。
- [x] 发送失败时保留输入草稿并展示错误。

## Task 4: 实时事件流和 timeline 更新

**Files:**

- Modify: `src/server/app-server/json-rpc.ts`
- Create: `src/server/app-server/events.ts`
- Modify: `src/server/ws.ts`
- Create: `src/lib/timeline-reducer.ts`
- Modify: `src/components/ThreadTimeline.tsx`
- Test: `tests/unit/timeline-reducer.test.ts`
- Test: `tests/e2e/realtime-stream.spec.ts`

- [x] app-server notification 规范化为浏览器事件。
- [x] `agentMessage/delta` 能增量更新当前 timeline。
- [x] reasoning、plan、command output、diff 能增量更新当前 timeline。
- [x] file output、token usage 能增量更新当前 timeline。
- [x] WebSocket 断线后显示断连状态，重连后重新读取当前 thread。
- [x] 同一 item 的 delta 不重复、不乱序追加。

## Task 5: 审批、question 和 ServerRequest 响应

**Files:**

- Modify: `src/server/app-server/json-rpc.ts`
- Create: `src/server/app-server/pending-requests.ts`
- Create: `src/app/api/codex/requests/[requestId]/resolve/route.ts`
- Create: `src/components/ApprovalSheet.tsx`
- Create: `src/components/QuestionSheet.tsx`
- Test: `tests/unit/pending-requests.test.ts`
- Test: `tests/e2e/approval-question.spec.ts`

- [x] JSON-RPC peer 能区分 server request、notification、response。
- [x] 命令审批显示为底部 sheet。
- [x] 文件变更审批、权限审批显示为底部 sheet。
- [x] `ToolRequestUserInput` 和 MCP elicitation 显示问题、选项。
- [x] 命令审批的用户选择会回传 JSON-RPC response。
- [x] question、MCP elicitation、文件审批、权限审批的用户选择会回传 JSON-RPC response。
- [x] `serverRequest/resolved` 后自动关闭对应 sheet。
- [x] 动态工具调用 `item/tool/call` 能显示、执行并回传 `DynamicToolCallResponse`。

## Task 6: 图片发送和附件暂存

**Files:**

- Modify: `src/config/env.ts`
- Create: `src/server/uploads.ts`
- Create: `src/app/api/codex/uploads/images/route.ts`
- Modify: `src/components/Composer.tsx`
- Test: `tests/unit/uploads.test.ts`
- Test: `tests/e2e/send-image.spec.ts`

- [x] 手机端可选择图片并上传到后端暂存目录。
- [x] 暂存路径必须位于项目 uploads 目录。
- [x] `turn/start` 使用 `localImage` 或 `image` 输入。
- [x] 上传失败阻止发送并保留草稿。
- [x] 暂存文件按时间清理。

## Task 7: fork、编辑重发、interrupt、steer

**Files:**

- Create: `src/app/api/codex/threads/[threadId]/fork/route.ts`
- Create: `src/app/api/codex/threads/[threadId]/rollback/route.ts`
- Create: `src/app/api/codex/turns/[threadId]/interrupt/route.ts`
- Create: `src/app/api/codex/turns/[threadId]/steer/route.ts`
- Create: `src/components/TurnActionsSheet.tsx`
- Test: `tests/e2e/fork-edit-resend.spec.ts`

- [x] Fork 后切换到新 thread。
- [x] 编辑重发先 rollback，再以新输入 `turn/start`。
- [x] rollback 涉及文件变更时提示用户查看 diff。
- [x] 运行中可以 interrupt。
- [x] 可 steer 时显示追加指令入口。

## Task 8: Files、Diff、Terminal、Settings 面板

**Files:**

- Create: `src/components/FilesPanel.tsx`
- Create: `src/components/DiffPanel.tsx`
- Create: `src/components/TerminalPanel.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/app/api/codex/fs/*`
- Create: `src/app/api/codex/terminal/*`
- Test: `tests/e2e/mobile-panels.spec.ts`

- [x] Files 面板使用 `fs/readDirectory`、`fs/readFile`。
- [x] Diff 面板使用 `turn/diff/updated` 和 thread diff 数据。
- [x] Terminal 面板展示 `command/exec` 或 `process/*` 输出。
- [x] Settings 面板支持模型、思考强度、权限配置、remote-control 状态。

## Task 9: 安全、审计和生产验证

**Files:**

- Create: `src/server/workspace-policy.ts`
- Create: `src/server/audit-log.ts`
- Modify: `README.md`
- Create: `docs/testing.md`

- [x] 所有 cwd、runtime roots、文件路径都经过 allowlist 校验。
- [x] 原始 app-server URL 和 token 永远不返回给浏览器。
- [x] 敏感动作写入本地 append-only 审计日志。
- [x] README 说明真实运行、局域网访问、token、app-server 模式和安全边界。
- [x] 真实 Codex app-server 人工验收流程写入 `docs/testing.md`。
