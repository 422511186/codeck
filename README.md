# codeck

> Codex app-server 协议的 Web 后端代理 + 移动端 Web 前端。

codeck 让你在手机浏览器上使用 Codex：一个 Node.js / TypeScript 安全代理桥接外部调用方到后端机器上的 Codex app-server，配套一套移动端 Web UI，支持项目管理、会话聊天、agent 输出渲染、审批、Plan/Build 切换、模型选择等能力。

codeck 不重新实现 Codex agent，执行、权限、会话和工具行为仍然交给 Codex app-server。外部调用方不直接连接 app-server，而是通过 codeck 后端做安全代理。

## 目录

- [特性](#特性)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [配置](#配置)
- [自定义模型](#自定义模型)
- [app-server 模式](#app-server-模式)
- [部署](#部署)
- [验证](#验证)
- [安全边界](#安全边界)
- [文档语言约定](#文档语言约定)
- [贡献](#贡献)
- [License](#license)

## 特性

- **移动端优先的会话 UI**：会话 timeline（用户消息 + agent 消息 markdown/mermaid + 折叠卡片）、历史无限滚动、自动滚策略、「跳到最新」浮动按钮、WS 增量更新 + 断线重连 + 全量回填。
- **完整的审批交互**：command_approval / file_approval / permissions_approval / question / mcp_elicitation / dynamic_tool 等 inline 审批卡片。
- **富输入 composer**：自动增高文本区、`+` 添加面板（图片 / 文件 / 引用 Skill / 设定目标）、权限 chip、模型 / 思考档位 chip、send / interrupt、草稿持久化。
- **Plan / Build 工作流**：segmented 切换、来源敏感模型选择器、底部抽屉（重命名 / 归档 / 压缩 / Fork）、Plan 末尾「转 Build 执行」、会话名自动生成。
- **模型切换与恢复**：已有会话可在自定义模型与 Codex 目录模型间切换，切换失败时可恢复原模型或阻塞并提供恢复操作。
- **安全代理后端**：个人 token 登录 + 签名 session cookie、app-server JSON-RPC adapter、实时事件转发、workspace allowlist、append-only JSONL 审计日志与敏感字段脱敏。
- **多种 app-server 运行模式**：`spawn` / `external` / `spawn-or-connect` / `mock` / `off`。

## 技术架构

codeck 不是前后端分离部署，而是 **Next.js 全栈单体**：前端 UI 和后端 API 属于同一个 Next 应用，跑在同一个自定义 Node server、同一个端口上。真正独立的进程是 Codex app-server。

```text
手机浏览器
  │  HTTP + WebSocket
  ▼
┌─────────────────────────────────────────────┐
│ 单个 Node.js 进程 (dist/server/http.js)          │
│                                                 │
│  createServer (node:http)  ← 唯一监听端口         │
│    ├── Next.js requestHandler → 前端页面 + /api/* │
│    └── attachBrowserWebSocket → /ws 实时事件通道   │
│                                                 │
│  app-server 适配层 (JSON-RPC over WebSocket)     │
└─────────────────────┬───────────────────────────┘
                      │ ws://
                      ▼
             Codex app-server (独立进程)
```

核心技术选择：

- **后端**：Node.js、TypeScript、Next.js 自定义 server。
- **前端**：React 19、Next.js 16 app router、Zustand、react-markdown + mermaid。
- **API 路由**：Next.js route handlers，经自定义 Node server 承载。
- **协议**：Codex app-server JSON-RPC / WebSocket。
- **状态存储**：个人模式不使用数据库；服务端项目目录、自定义模型目录与会话模型绑定保存在 `CODEX_WEB_DATA_DIR` 的版本化 JSON 文件中，其他运行中状态放内存，Codex 会话仍由 Codex app-server 管理。
- **登录方式**：优先使用后端配置的 `CODEX_WEB_ACCESS_TOKEN`；如果没有配置，后端启动时自动生成一个随机长 token 并打印到控制台。

要点：

- **前后端合体的原因**：使用 Next.js custom server 模式。入口 `src/server/http.ts` 自己 `createServer` 起一个 Node HTTP server，把 Next 的 `requestHandler` 塞进去。因此前端页面和 `/api/codex/*` 接口（App Router route handlers）由同一个 Next 应用、同一个端口、同一套构建产物 `.next/` 承载。
- **为什么用自定义 server 而不是 `next start`**：项目需要一个原生 `/ws` 长连接把 Codex 实时事件推给浏览器。自定义 server 让 HTTP（交给 Next）和 WebSocket upgrade（`attachBrowserWebSocket`）挂在同一个 server 上。
- **真正分离的边界**在这个 Web 服务与 Codex app-server 之间，不在前后端之间。适配层通过 JSON-RPC over WebSocket 连到 app-server（spawn / external / spawn-or-connect 模式）。

### 前端路由

- `/`：项目列表（首屏）
- `/login`：token 登录
- `/projects`：项目列表（合并仅当前设备与服务端项目记录，按 `cwd` 聚合会话）
- `/projects/[projectId]`：项目内会话列表（进行中 / 已归档）
- `/threads/[threadId]`：会话页（timeline + composer + Plan/Build + 模型切换 + 底部抽屉）
- `/settings`：默认模型与模式、自定义模型入口、主题、账号状态、Token 用量、登出
- `/settings/custom-models`：自定义模型创建、编辑和删除

### 前端目录与调用边界

- `src/app/`：Next.js App Router 页面和 API route handlers。
- `src/app/api`：浏览器访问的 HTTP API。
- `src/web/api`：浏览器侧 fetch 封装，统一处理 cookie、401 跳转和 `{ ok, error }` 协议。
- `src/web/ws`、`src/web/events`：浏览器侧事件连接与分发。
- `src/web/storage`：localStorage 封装。
- `src/web/state`：Zustand 前端运行时状态。
- `src/web/components`：复用 UI 组件。
- `src/web/**` 是浏览器代码，不导入 `src/server/**`；前端外部副作用统一通过 `src/web/api`、`src/web/ws` 或 `src/web/events` 走。

### 后端能力与关键文件

- 个人 token 登录和签名 session cookie。
- app-server JSON-RPC adapter 和连接管理。
- 会话、turn、turn items、统一模型目录、自定义模型、账号、配置、插件、技能、MCP、文件、进程、终端、remote-control、上传图片等后端 API。
- Codex app-server 实时事件到 codeck WebSocket 的转发。
- workspace allowlist、本地 JSONL 审计日志和敏感字段脱敏。

关键文件：

- `src/app/api`：后端 API route handlers。
- `src/server`：HTTP server、WebSocket、鉴权、运行时、app-server 适配层。
- `src/shared`：后端共享类型。
- `docs/generated/app-server-ts`：Codex app-server TypeScript 协议快照。
- `docs/generated/app-server-json-schema`：Codex app-server JSON Schema 协议快照。

### 后端 API 约定

- 除 `/api/health`、`/api/auth/login`、`/api/auth/session` 外，所有 `/api/codex/*` 接口都要求有效 session cookie。
- 成功响应通常包含 `{ "ok": true }`，失败响应通常包含 `{ "ok": false, "error": "错误说明" }`。
- 浏览器事件通道包括 `/ws` 和 `/api/codex/events`，用于转发 Codex app-server 通知、待确认请求和连接状态。
- 主要 API 分组：
  - `/api/codex/status`、`/api/codex/models`、`/api/codex/settings`：状态、模型和设置。
  - `/api/codex/custom-models*`：自定义模型目录 CRUD；mutation 使用目录 revision 做乐观并发控制。
  - `/api/codex/threads/:threadId/model/switch`、`model/recover`：已有会话的模型切换与失败恢复。
  - `/api/codex/threads*`、`/api/codex/turns*`：会话、turn、回滚、fork、压缩、review、目标、realtime。
  - `/api/codex/uploads/images`、`/api/codex/images/preview`：图片上传和预览。
  - `/api/codex/requests*`：审批、question、MCP elicitation 和动态工具请求处理。
  - `/api/codex/fs*`、`/api/codex/process*`、`/api/codex/terminal*`：文件、进程和终端能力。
  - `/api/codex/plugins*`、`/api/codex/plugin-skills*`、`/api/codex/skills*`、`/api/codex/mcp*`：插件、Skill 和 MCP。

## 快速开始

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

如果没有配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时登录 token，用它在 `/login` 登录即可。

## 配置

> 环境变量前缀 `CODEX_WEB_` 是 codeck 的运行时配置契约，保持不变。

个人模式示例（`.env`）：

```env
CODEX_WEB_ACCESS_TOKEN=替换成你的登录token
CODEX_WEB_WORKSPACE_ROOTS=C:\Users\huang\workspace
CODEX_WEB_UPLOAD_DIR=C:\Users\huang\workspace\codeck\uploads
CODEX_WEB_AUDIT_LOG_PATH=C:\Users\huang\workspace\codeck\logs\audit.jsonl
CODEX_WEB_DATA_DIR=C:\Users\huang\workspace\codeck\data
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
CODEX_WEB_APP_SERVER_MODE=spawn
```

说明：

- `CODEX_WEB_ACCESS_TOKEN` 是 codeck 后端的访问 token。未配置时后端启动会生成一个随机长 token，只在当前进程有效，并打印到控制台。这个 token 不需要等同于模型 / API key —— 真正的模型 / API key 仍然放在后端环境或 Codex 配置里。
- `CODEX_WEB_WORKSPACE_ROOTS` 用来限制后端允许操作的工作区范围。
- `CODEX_WEB_UPLOAD_DIR` 是附件暂存目录；未配置时默认使用项目当前工作目录下的 `uploads`。上传文件默认 24 小时清理；普通文件单文件 20 MiB、单条消息最多 10 个、合计最多 50 MiB。
- `CODEX_WEB_AUDIT_LOG_PATH` 是审计日志路径；未配置时默认使用项目当前工作目录下的 `logs/audit.jsonl`。
- `CODEX_WEB_DATA_DIR` 保存 `projects.json`、`custom-models.json` 和 `thread-model-bindings.json`；未配置时默认使用项目当前工作目录下的 `data`，生产环境必须持久化并备份。
- 审批、question、WebSocket 连接状态等运行中状态默认放内存；服务重启后从 Codex app-server 重新读取会话即可。

### localStorage 命名空间

前端在浏览器用 `codex-web:` 命名空间保存本地状态：

- `codex-web:projects`：项目列表 `{ id, name, path, addedAt, lastUsedAt }[]`
- `codex-web:settings`：来源敏感默认模型、默认模式与主题；自定义默认保存 `customModelId`，Codex 默认保存模型标识
- `codex-web:drafts`：草稿 `{ [threadId]: string }`

## 自定义模型

自定义模型只定义模型标识和运行时元数据，不管理 provider、base URL 或凭据。新会话、已有会话切换和重启恢复都会读取 Codex 当前配置正在使用的 provider；provider 的名称变化不会删除模型定义或已有绑定。

- 新建自定义模型的上下文窗口默认是 `200000`，允许修改为 `1` 到 `1000000`。
- 窗口大于 `272000` 时，模型标识必须精确存在于 app-server 的权威 `model/list` 中才能用于新建或切换；codeck 不会生成或修改 `model_catalog_json`。
- 自定义目录编辑不会静默改变已绑定会话。选择器会显示「配置有更新」，用户明确「重新应用」后才重建运行时。
- 切换不会自动 compact。已知用量达到目标窗口的 90% 时，需先使用现有手动压缩入口。
- text-only 模型不会删除草稿图片，但在移除图片或切回支持 image 的模型前禁止发送。历史消息中的图片不影响切换。

## app-server 模式

默认使用 `spawn` 模式：codeck 后端在需要读取 Codex 数据时自动启动本机 `codex app-server --listen ws://127.0.0.1:<port>`。这个模式表示「当前 Web 后端拥有子进程」，适合单个本机开发服务，不承诺多个 Web 后端之间复用同一个 app-server。

```env
CODEX_WEB_APP_SERVER_MODE=spawn
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
```

如果你已经自己启动了 Codex app-server，或者有多个 Web 后端需要复用同一个 app-server，推荐使用 `external` 模式：

```env
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://127.0.0.1:31317
```

本机开发如果希望「有就复用，没有就自动启动」，可以使用 `spawn-or-connect`。必须配置固定 host/port；启动时会先探测该 endpoint，已有可用 app-server 时直接连接，不会再 spawn。端口未监听时会通过跨进程锁启动一个新 app-server；如果端口被非 app-server 占用或 WebSocket 握手失败，会报明确错误，不会静默换随机端口。

```env
CODEX_WEB_APP_SERVER_MODE=spawn-or-connect
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
# 可选，保存启动锁和 owner pid 元数据
CODEX_WEB_APP_SERVER_STATE_DIR=/tmp/codex-web-app-server
```

测试或后端联调用 `mock` 模式；完全关闭 app-server 接入用 `off` 模式：

```env
CODEX_WEB_APP_SERVER_MODE=mock
# 或
CODEX_WEB_APP_SERVER_MODE=off
```

## 部署

- **宿主机 tarball 自托管**（主路径）：打包、验证、systemd 部署、升级回滚和安全边界见 [`docs/release.md`](docs/release.md)。
- **Docker / Docker Compose**：适合希望用容器固定 Node.js 运行环境的自托管场景；镜像构建、Compose 配置、external app-server、验证、升级和回滚见 [`docs/docker-deployment.md`](docs/docker-deployment.md)。

发布验证不得停止、重启、复用或抢占当前运行在 `23000` 端口的服务；需要启动服务的 smoke test 必须显式使用非 `23000` 端口。

## 验证

```bash
npm run verify
```

期望：

- TypeScript 类型检查通过。
- 后端单元测试通过。
- 默认不会运行真实 Codex app-server 集成测试；如需运行见 [`docs/testing.md`](docs/testing.md)。

## 安全边界

- app-server 默认只绑定 loopback，原始 app-server URL 和 Web 登录 token 不通过状态接口暴露。状态接口只返回 mode、state、是否复用、是否由当前进程拥有、pid 是否已知、错误类别等安全诊断字段。
- 文件读取、终端 cwd、新建会话 cwd、runtime workspace roots 和图片路径会经过 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 校验。
- 附件上传目录额外允许作为图片或受控普通文件引用来源，但不会自动扩大 Files / Terminal 的工作区范围；路径会执行 canonical 普通文件和符号链接校验。
- 发送消息、上传图片、执行终端命令、审批响应、fork、rollback、interrupt、steer、新建会话等敏感动作会写入 append-only JSONL 审计日志。
- 审计日志会递归脱敏 key 中包含 `token`、`secret`、`password`、`url` 的字段。
- 项目目录、自定义模型与绑定文件只由后端在 `CODEX_WEB_DATA_DIR` 下创建，文件权限为 `0600`；浏览器不能指定持久化路径，文件中不保存 provider 配置或凭据。
- 这是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。**对外网开放前需要额外接入反向代理、TLS、IP allowlist 和更强认证。**

## 文档语言约定

后续所有人工编写的项目文档都使用中文，包括 README、设计文档、实施计划、开发说明和测试说明。

例外：协议生成文件、代码里的类型名 / API 名、命令、路径、第三方库名称保持原文，避免破坏可再生成性和可搜索性。

## 贡献

欢迎 issue 和 PR。提交前请确保 `npm run verify` 通过，并遵循上面的文档语言约定。

## License

[MIT](LICENSE) © 2026 huangzy (422511186)
