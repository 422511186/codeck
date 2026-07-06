# Codex Web

这是 Codex app-server 协议的 Web 后端代理 + 移动端 Web 前端。

## 产品边界

- **后端**：Node.js / TypeScript 安全代理，桥接外部调用方到后端机器上的 Codex app-server。
- **前端**：移动端 Web UI（React 19 + Next.js 16 app router），支持项目管理、会话列表、会话聊天、agent 输出渲染、审批、Plan/Build 切换、模型选择、目标设置和设置页。
- 不重新实现 Codex agent，执行、权限、会话和工具行为仍交给 Codex app-server。
- 外部调用方不直接连接 app-server，而是通过本项目后端做安全代理。

## 技术架构

```text
移动端浏览器
  -> Next.js Web 前端 (React 19)
  -> Node.js / TypeScript Web 后端 (API + WebSocket)
  -> Codex app-server 协议适配层
  -> 后端机器上的 codex app-server
```

核心技术选择：

- 后端：Node.js、TypeScript、Next.js 自定义 server。
- 前端：React 19、Next.js 16 app router、Zustand、react-markdown + mermaid。
- API 路由：Next.js route handlers，经自定义 Node server 承载。
- 协议：Codex app-server JSON-RPC/WebSocket。
- 状态存储：个人模式不使用数据库；配置走环境变量，运行中状态放内存，Codex 会话仍由 Codex app-server 管理。
- 登录方式：优先使用后端配置的 `CODEX_WEB_ACCESS_TOKEN`；如果没有配置，后端启动时自动生成一个随机长 token 并打印到控制台。

### 运行架构：单进程全栈

本项目不是前后端分离部署，而是 **Next.js 全栈单体**：前端 UI 和后端 API 属于同一个 Next 应用，跑在同一个自定义 Node server、同一个端口上。真正独立的进程是 Codex app-server。

```text
手机浏览器
  │  HTTP + WebSocket
  ▼
┌─────────────────────────────────────────┐
│ 单个 Node.js 进程 (dist/server/http.js)                 │
│                                                        │
│  createServer (node:http)  ← 唯一监听端口                │
│    ├── Next.js requestHandler → 前端页面 + /api/* 路由   │
│    └── attachBrowserWebSocket → /ws 实时事件通道         │
│                                                        │
│  app-server 适配层 (JSON-RPC over WebSocket)            │
└──────────────────────┬─────────────────────────────────┘
                       │ ws://
                       ▼
              Codex app-server (独立进程)
```

要点：

- **前后端合体的原因**：使用 Next.js custom server 模式。入口 `src/server/http.ts` 自己 `createServer` 起一个 Node HTTP server，把 Next 的 `requestHandler` 塞进去。因此前端页面和 `/api/codex/*` 接口（App Router route handlers，见 `src/app/api/**/route.ts`）由同一个 Next 应用、同一个端口、同一套构建产物 `.next/` 承载。
- **为什么用自定义 server 而不是 `next start`**：项目需要一个原生 `/ws` 长连接把 Codex 实时事件推给浏览器。自定义 server 让 HTTP（交给 Next）和 WebSocket upgrade（`attachBrowserWebSocket`）挂在同一个 server 上。
- **真正分离的边界**在这个 Web 服务与 Codex app-server 之间，不在前后端之间。适配层通过 JSON-RPC over WebSocket 连到 app-server（spawn / external / spawn-or-connect 模式）。
- **构建与启动**：`npm run build` 分两步，`next build` 产出 `.next/`（页面 + API 路由），esbuild 把 `src/server/http.ts` 打成单文件 `dist/server/http.js`（依赖 external，运行时从 `node_modules` 解析）。`npm run start` 即 `import` 该文件启动上述进程；这也是部署时仍需 `npm ci --omit=dev` 安装生产依赖的原因。

## 前端能力

- **路由**：
  - `/`：项目列表（首屏）
  - `/login`：token 登录
  - `/projects`：项目列表（localStorage 管理，按 `cwd` 聚合会话）
  - `/projects/[projectId]`：项目内会话列表（进行中 / 已归档）
  - `/threads/[threadId]`：会话页（timeline + composer + Plan/Build + 模型切换 + 底部抽屉）
  - `/settings`：默认模型与模式、主题、账号状态、Token 用量、登出
- **核心交互**：
  - 会话 timeline：用户消息 + agent 消息（markdown + mermaid）+ 折叠卡片（命令/diff/推理/MCP/系统消息/错误）
  - 历史无限滚动 + 自动滚策略 + 「跳到最新」浮动按钮
  - WS 增量更新 + 断线重连 + 全量回填
  - 审批卡片：command_approval / file_approval / permissions_approval / question / mcp_elicitation / dynamic_tool
  - composer：自动增高文本区 + `+` 添加面板 + 权限 chip + 模型/思考档位 chip + send/interrupt + 草稿持久化
  - `+` 添加面板：列表式 bottom sheet，提供图片、引用 Skill、设定/编辑目标；隐藏尚未支持的文件和插件入口
  - 图片：相册单图、上传进度、失败重试；Skill 引用支持多选并作为结构化输入发送
  - 目标：从添加面板设置、编辑或清除当前会话目标；Web UI 只暴露目标描述，不暴露 token budget
  - Plan/Build segmented + 模型选择器 + 底部抽屉（重命名/归档/压缩/Fork）
  - Plan 末尾「转 Build 执行」按钮 + 会话名自动生成（首句）
- **localStorage 命名空间**：`codex-web:`
  - `codex-web:projects`：项目列表 `{ id, name, path, addedAt, lastUsedAt }[]`
  - `codex-web:settings`：默认模型、默认模式与主题 `{ defaultModel, defaultMode, theme }`
  - `codex-web:drafts`：草稿 `{ [threadId]: string }`

## 前端目录与调用边界

- `src/app/`：Next.js App Router 页面和 API route handlers。
- `src/app/login`、`src/app/projects`、`src/app/projects/[projectId]`、`src/app/threads/[threadId]`、`src/app/settings`：移动端页面。
- `src/app/api`：浏览器访问的 HTTP API。
- `src/web/api`：浏览器侧 fetch 封装，统一处理 cookie、401 跳转和 `{ ok, error }` 协议。
- `src/web/ws`、`src/web/events`：浏览器侧事件连接与分发。
- `src/web/storage`：localStorage 封装。
- `src/web/state`：Zustand 前端运行时状态。
- `src/web/components`：复用 UI 组件。
- `src/web/**` 是浏览器代码，不导入 `src/server/**`。
- 前端外部副作用统一通过 `src/web/api`、`src/web/ws` 或 `src/web/events` 走。

## 后端能力

- 个人 token 登录和签名 session cookie。
- app-server JSON-RPC adapter 和连接管理。
- 会话、turn、turn items、模型、账号、配置、插件、技能、MCP、文件、进程、终端、remote-control、上传图片等后端 API。
- Codex app-server 实时事件到本项目 WebSocket 的转发。
- `spawn`、`external`、`mock`、`off` 四种 app-server 运行模式。
- workspace allowlist、本地 JSONL 审计日志和敏感字段脱敏。
- app-server TypeScript bindings 和 JSON Schema 协议快照。

关键文件：

- `src/app/api`：后端 API route handlers。
- `src/server`：HTTP server、WebSocket、鉴权、运行时、app-server 适配层。
- `src/shared`：后端共享类型。
- `docs/generated/app-server-ts`：Codex app-server TypeScript 协议快照。
- `docs/generated/app-server-json-schema`：Codex app-server JSON Schema 协议快照。

## 后端 API 约定

- 除 `/api/health`、`/api/auth/login`、`/api/auth/session` 外，所有 `/api/codex/*` 接口都要求有效 session cookie。
- 成功响应通常包含 `{ "ok": true }`，失败响应通常包含 `{ "ok": false, "error": "错误说明" }`。
- 浏览器事件通道包括 `/ws` 和 `/api/codex/events`，用于转发 Codex app-server 通知、待确认请求和连接状态。
- 主要 API 分组：
  - `/api/codex/status`、`/api/codex/models`、`/api/codex/settings`：状态、模型和设置。
  - `/api/codex/threads*`、`/api/codex/turns*`：会话、turn、回滚、fork、压缩、review、目标、realtime。
  - `/api/codex/uploads/images`、`/api/codex/images/preview`：图片上传和预览。
  - `/api/codex/requests*`：审批、question、MCP elicitation 和动态工具请求处理。
  - `/api/codex/fs*`、`/api/codex/process*`、`/api/codex/terminal*`：文件、进程和终端能力。
  - `/api/codex/plugins*`、`/api/codex/plugin-skills*`、`/api/codex/skills*`、`/api/codex/mcp*`：插件、Skill 和 MCP。
- `POST /api/codex/threads/:threadId/goal` 底层仍兼容 `tokenBudget` 字段；当前 Web UI 保存目标时只提交目标描述，并通过 Web API 封装发送 `tokenBudget: null` 清空历史预算。

## 本地运行

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm run dev
```

如果没有配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时登录 token。

## Release 发布

第一版 release 采用宿主机 tarball 自托管部署作为主路径；打包、验证、systemd 部署、升级回滚和安全边界见 `docs/release.md`。

Docker 和 Docker Compose 是新增部署路径，适合希望用容器固定 Node.js 运行环境的自托管场景；镜像构建、Compose 配置、external app-server、验证、升级和回滚见 `docs/docker-deployment.md`。

发布验证不得停止、重启、复用或抢占当前运行在 `23000` 端口的服务；需要启动服务的 smoke test 必须显式使用非 `23000` 端口。

## 验证

运行：

```bash
npm run verify
```

期望：

- TypeScript 类型检查通过。
- 后端单元测试通过。
- 默认不会运行真实 Codex app-server 集成测试；如需运行见 `docs/testing.md`。

## 个人模式配置

```env
CODEX_WEB_ACCESS_TOKEN=替换成你的登录token
CODEX_WEB_WORKSPACE_ROOTS=C:\Users\huang\workspace
CODEX_WEB_UPLOAD_DIR=C:\Users\huang\workspace\codex-web\uploads
CODEX_WEB_AUDIT_LOG_PATH=C:\Users\huang\workspace\codex-web\logs\audit.jsonl
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
CODEX_WEB_APP_SERVER_MODE=spawn
```

说明：

- `CODEX_WEB_ACCESS_TOKEN` 是本项目后端的访问 token。
- 如果没有配置，后端启动时生成一个随机长 token，只在当前进程有效，并打印到控制台。
- 这个 token 不需要等同于模型/API key。真正模型/API key 仍然放在后端环境或 Codex 配置里。
- `CODEX_WEB_WORKSPACE_ROOTS` 用来限制后端允许操作的工作区范围。
- `CODEX_WEB_UPLOAD_DIR` 是图片暂存目录；未配置时默认使用项目当前工作目录下的 `uploads`。
- `CODEX_WEB_AUDIT_LOG_PATH` 是审计日志路径；未配置时默认使用项目当前工作目录下的 `logs/audit.jsonl`。
- 审批、question、WebSocket 连接状态等运行中状态默认放内存；服务重启后从 Codex app-server 重新读取会话即可。

## app-server 模式

默认使用 `spawn` 模式：Web 后端在需要读取 Codex 数据时自动启动本机 `codex app-server --listen ws://127.0.0.1:<port>`。这个模式表示“当前 Web 后端拥有子进程”，适合单个本机开发服务，不承诺多个 Web 后端之间复用同一个 app-server。

可选配置：

```env
CODEX_WEB_APP_SERVER_MODE=spawn
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
```

如果你已经自己启动了 Codex app-server，或者有多个 Web 后端需要复用同一个 app-server，推荐使用 external 模式：

```env
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://127.0.0.1:31317
```

本机开发如果希望“有就复用，没有就自动启动”，可以使用 `spawn-or-connect`。必须配置固定 host/port；启动时会先探测该 endpoint，已有可用 app-server 时直接连接，不会再 spawn。端口未监听时会通过跨进程锁启动一个新 app-server；如果端口被非 app-server 占用或 WebSocket 握手失败，会报明确错误，不会静默换随机端口。

```env
CODEX_WEB_APP_SERVER_MODE=spawn-or-connect
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
# 可选，保存启动锁和 owner pid 元数据
CODEX_WEB_APP_SERVER_STATE_DIR=/tmp/codex-web-app-server
```

测试或后端联调用 mock 模式：

```env
CODEX_WEB_APP_SERVER_MODE=mock
```

完全关闭 app-server 接入用 off 模式：

```env
CODEX_WEB_APP_SERVER_MODE=off
```

## 安全边界

- app-server 默认只绑定 loopback，原始 app-server URL 和 Web 登录 token 不通过状态接口暴露。状态接口只返回 mode、state、是否复用、是否由当前进程拥有、pid 是否已知、错误类别等安全诊断字段。
- 文件读取、终端 cwd、新建会话 cwd、runtime workspace roots 和图片路径会经过 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 校验。
- 图片上传目录额外允许作为 `localImage` 来源，但不会自动扩大 Files/Terminal 的工作区范围。
- 发送消息、上传图片、执行终端命令、审批响应、fork、rollback、interrupt、steer、新建会话等敏感动作会写入 append-only JSONL 审计日志。
- 审计日志会递归脱敏 key 中包含 `token`、`secret`、`password`、`url` 的字段。
- 这是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。对外网开放前需要额外接入反向代理、TLS、IP allowlist 和更强认证。

## 文档语言约定

后续所有人工编写的项目文档都使用中文，包括 README、设计文档、实施计划、开发说明和测试说明。

例外：协议生成文件、代码里的类型名/API 名、命令、路径、第三方库名称保持原文，避免破坏可再生成性和可搜索性。
