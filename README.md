# Codex 移动端 Web

这是一个面向手机浏览器的 Codex Web 客户端。它通过 Codex app-server 协议连接后端机器上的 Codex，让用户可以在移动端远程进行开发、查看会话历史、发送消息和图片、确认权限、回答 question、fork 会话、编辑重发、切换模型和思考强度。

## 产品目标

- 移动端优先，只做手机 Web 工作台，不做电脑端布局。
- 能力上尽量 1:1 复刻 VS Code Codex 插件。
- 不重新实现 Codex agent，所有执行、权限、会话和工具行为都交给 Codex app-server。
- 浏览器不直接连接 app-server，而是通过本项目后端做安全代理。

## 本次范围边界

本次完整系统开发覆盖移动端远程开发主链路：登录、会话、发送文本/图片、模型与思考强度、审批/question、fork/编辑重发、文件、diff、终端、设置、安全与测试。

以下能力本次不作为必须实现项，可以在代码中保留已有基础接口或预留入口，但不纳入完成验收：

- 插件、插件市场、插件共享。
- 实时音频。
- MCP 的完整工具调用和资源工作流。
- 环境导入/外部 agent 配置。
- 反馈上传。

## 技术架构

```text
手机浏览器
  -> Next.js / React / TypeScript 移动端 UI
  -> Node.js / TypeScript Web 后端
  -> Codex app-server 协议适配层
  -> 后端机器上的 codex app-server
```

核心技术选择：

- 前端：Next.js、React、TypeScript。
- 后端：Node.js、TypeScript。
- 协议：Codex app-server JSON-RPC/WebSocket。
- 状态存储：个人模式不使用数据库；配置走环境变量/配置文件，运行中状态放内存，Codex 会话仍由 Codex app-server 管理。
- 登录方式：优先使用后端配置的 `CODEX_WEB_ACCESS_TOKEN`；如果没有配置，后端启动时自动生成一个随机长 token 并打印到控制台。手机端输入匹配后写入签名 session cookie。

## 当前状态

项目目前已经完成移动端工作台地基，并持续接入真实 Codex app-server：个人 token 登录、签名 session cookie、移动端工作台、浏览器 WebSocket、app-server JSON-RPC adapter、app-server 连接管理、会话列表/读取/新建/发送 API、归档会话列表与恢复、模型列表 API、实时事件流、审批/question 请求确认、图片上传后通过 `localImage` 发送、fork/编辑重发/interrupt/steer、会话 shell command、elicitation 暂停/恢复计数、会话 metadata 更新、上下文 items 注入、Guardian 拦截动作批准、账号用量与额度重置 credit 操作，以及 Files、Diff、Terminal、Settings 面板。

已经完成：

- 确认本机 Codex CLI 支持 `app-server`、`remote-control` 和协议生成命令。
- 生成 app-server TypeScript bindings 和 JSON Schema 快照。
- 写入移动端 Web 设计文档。
- 搭建 Next.js/React/TypeScript 移动端页面和 Node.js 自定义 server。
- 实现个人模式登录，不需要数据库。
- 加入单元测试和手机视口 Playwright 冒烟测试。
- 支持 `spawn`、`external`、`mock`、`off` 四种 app-server 运行模式。
- 移动端登录后可以读取 app-server 会话历史、归档会话、模型列表、实时 timeline。
- 支持发送文本和图片；图片先进入后端暂存目录，再作为 `localImage` 交给 Codex app-server。
- 支持命令审批、文件审批、权限审批和 question 的移动端确认；MCP 相关能力保留已有基础接口，但不纳入本次完整验收。
- 支持 fork、rollback 后编辑重发、interrupt 当前 turn、steer 运行中的 turn、归档/恢复会话、发送会话 shell command、暂停/恢复 elicitation 计数。
- 支持会话 metadata 更新、原始 items 注入、Guardian 拦截动作批准、账号 token 用量读取、鉴权状态读取、额度重置 credit 消费和加购提醒。
- 支持移动端 Files、Diff、Terminal、Settings 面板。
- 支持 workspace allowlist 和本地 JSONL 审计日志。

关键文件：

- `docs/superpowers/specs/2026-06-22-codex-web-design.md`：中文设计文档。
- `docs/generated/app-server-ts`：Codex app-server TypeScript 协议快照。
- `docs/generated/app-server-json-schema`：Codex app-server JSON Schema 协议快照。

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

如果没有配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时登录 token。手机访问 `http://<后端机器局域网 IP>:3000` 后输入该 token 登录。

## 第一阶段验收

运行：

```bash
npm run verify
npm run test:e2e
```

期望：

- 类型检查和单元测试通过。
- 手机视口 E2E 测试通过。
- `npm run dev` 启动后，手机可以访问 Web 页面。
- 未配置 `CODEX_WEB_ACCESS_TOKEN` 时，控制台会打印临时 token。
- 登录后能看到移动端工作台、底部导航和连接状态。

## 个人模式配置

个人自用场景不需要数据库和用户表。可以使用环境变量显式配置登录 token：

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

- `CODEX_WEB_ACCESS_TOKEN` 是 Web 登录 token，可以设置成你习惯的 `sk-...` 字符串。
- 如果配置了 `CODEX_WEB_ACCESS_TOKEN`，后端优先使用这个值登录。
- 如果没有配置，后端启动时生成一个随机长 token，只在当前进程有效，并打印到控制台供你手机登录。
- 这个 token 是 Web 登录用的独立 token，不需要等同于模型/API key。真正模型/API key 仍然放在后端或 Codex 配置里。
- `CODEX_WEB_WORKSPACE_ROOTS` 用来限制手机端能操作的工作区范围。
- `CODEX_WEB_UPLOAD_DIR` 是图片暂存目录；未配置时默认使用项目当前工作目录下的 `uploads`。
- `CODEX_WEB_AUDIT_LOG_PATH` 是审计日志路径；未配置时默认使用项目当前工作目录下的 `logs/audit.jsonl`。
- 审批、question、WebSocket 连接状态等运行中状态默认放内存；服务重启后从 Codex app-server 重新读取会话即可。

## app-server 模式

默认使用 `spawn` 模式：Web 后端启动后，在需要读取 Codex 数据时自动启动本机 `codex app-server --listen ws://127.0.0.1:<port>`，浏览器不会看到这个 endpoint。

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

测试或前端联调用 mock 模式：

```env
CODEX_WEB_APP_SERVER_MODE=mock
```

完全关闭 app-server 接入用 off 模式：

```env
CODEX_WEB_APP_SERVER_MODE=off
```

## 安全边界

- app-server 默认只绑定 loopback，原始 app-server URL 和 Web 登录 token 不返回给浏览器。手机浏览器只访问本项目 Web 后端。
- 文件读取、终端 cwd、新建会话 cwd、runtime workspace roots 和图片路径会经过 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 校验。
- 图片上传目录额外允许作为 `localImage` 来源，但不会自动扩大 Files/Terminal 的工作区范围。
- 发送消息、上传图片、执行终端命令、审批响应、fork、rollback、interrupt、steer、新建会话等敏感动作会写入 append-only JSONL 审计日志。
- 审计日志会递归脱敏 key 中包含 `token`、`secret`、`password`、`url` 的字段。
- 这是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。对外网开放前需要额外接入反向代理、TLS、IP allowlist 和更强认证。

## 测试与验收

自动化验证：

```bash
npm run verify
npm run test:e2e
npm run build
```

真实 Codex app-server 人工验收流程见 `docs/testing.md`。

## 文档语言约定

后续所有人工编写的项目文档都使用中文，包括 README、设计文档、实施计划、开发说明和测试说明。

例外：协议生成文件、代码里的类型名/API 名、命令、路径、第三方库名称保持原文，避免破坏可再生成性和可搜索性。
