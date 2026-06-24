# Codex Web 后端

这是 Codex app-server 协议的 Web 后端代理。当前仓库已移除所有前端页面、React 组件、移动端 UI 原型、视觉审计和浏览器 E2E 测试，只保留后端 API、WebSocket、鉴权、安全边界、审计日志和协议适配层。

## 产品边界

- 当前范围不包含任何前端界面。
- 不重新实现 Codex agent，执行、权限、会话和工具行为仍交给 Codex app-server。
- 外部调用方不直接连接 app-server，而是通过本项目后端做安全代理。
- 后续如果重新建设移动端 Web，需要重新创建设计和实现计划。

## 技术架构

```text
外部调用方
  -> Node.js / TypeScript Web 后端
  -> Codex app-server 协议适配层
  -> 后端机器上的 codex app-server
```

核心技术选择：

- 后端：Node.js、TypeScript。
- API 路由：Next.js route handlers，经自定义 Node server 承载。
- 协议：Codex app-server JSON-RPC/WebSocket。
- 状态存储：个人模式不使用数据库；配置走环境变量，运行中状态放内存，Codex 会话仍由 Codex app-server 管理。
- 登录方式：优先使用后端配置的 `CODEX_WEB_ACCESS_TOKEN`；如果没有配置，后端启动时自动生成一个随机长 token 并打印到控制台。

## 当前保留能力

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
CODEX_WEB_ACCESS_TOKEN=sk-替换成你的登录token
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

默认使用 `spawn` 模式：Web 后端在需要读取 Codex 数据时自动启动本机 `codex app-server --listen ws://127.0.0.1:<port>`。

可选配置：

```env
CODEX_WEB_APP_SERVER_MODE=spawn
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
```

如果你已经自己启动了 Codex app-server，可以使用 external 模式：

```env
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://127.0.0.1:31317
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

- app-server 默认只绑定 loopback，原始 app-server URL 和 Web 登录 token 不通过状态接口暴露。
- 文件读取、终端 cwd、新建会话 cwd、runtime workspace roots 和图片路径会经过 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 校验。
- 图片上传目录额外允许作为 `localImage` 来源，但不会自动扩大 Files/Terminal 的工作区范围。
- 发送消息、上传图片、执行终端命令、审批响应、fork、rollback、interrupt、steer、新建会话等敏感动作会写入 append-only JSONL 审计日志。
- 审计日志会递归脱敏 key 中包含 `token`、`secret`、`password`、`url` 的字段。
- 这是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。对外网开放前需要额外接入反向代理、TLS、IP allowlist 和更强认证。

## 文档语言约定

后续所有人工编写的项目文档都使用中文，包括 README、设计文档、实施计划、开发说明和测试说明。

例外：协议生成文件、代码里的类型名/API 名、命令、路径、第三方库名称保持原文，避免破坏可再生成性和可搜索性。
