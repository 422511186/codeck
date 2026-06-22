# Codex 移动端 Web

这是一个面向手机浏览器的 Codex Web 客户端。它通过 Codex app-server 协议连接后端机器上的 Codex，让用户可以在移动端远程进行开发、查看会话历史、发送消息和图片、确认权限、回答 question、fork 会话、编辑重发、切换模型和思考强度。

## 产品目标

- 移动端优先，只做手机 Web 工作台，不做电脑端布局。
- 能力上尽量 1:1 复刻 VS Code Codex 插件。
- 不重新实现 Codex agent，所有执行、权限、会话和工具行为都交给 Codex app-server。
- 浏览器不直接连接 app-server，而是通过本项目后端做安全代理。

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
- 登录方式：后端配置一个访问密钥 `CODEX_WEB_ACCESS_TOKEN`，手机端输入匹配后写入签名 session cookie。

## 当前状态

项目目前处于设计和协议确认阶段。

已经完成：

- 确认本机 Codex CLI 支持 `app-server`、`remote-control` 和协议生成命令。
- 生成 app-server TypeScript bindings 和 JSON Schema 快照。
- 写入移动端 Web 设计文档。

关键文件：

- `docs/superpowers/specs/2026-06-22-codex-web-design.md`：中文设计文档。
- `docs/generated/app-server-ts`：Codex app-server TypeScript 协议快照。
- `docs/generated/app-server-json-schema`：Codex app-server JSON Schema 协议快照。

## 个人模式配置

个人自用场景不需要数据库和用户表。建议使用环境变量：

```env
CODEX_WEB_ACCESS_TOKEN=sk-替换成你的访问密钥
CODEX_WEB_WORKSPACE_ROOTS=C:\Users\huang\workspace
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
```

说明：

- `CODEX_WEB_ACCESS_TOKEN` 是 Web 登录密钥，可以设置成你习惯的 `sk-...` 字符串。
- 如果这是实际模型/API key，不建议在浏览器长期保存；更稳妥的做法是把模型/API key 放在后端或 Codex 配置里，Web 登录单独使用一个随机长 token。
- `CODEX_WEB_WORKSPACE_ROOTS` 用来限制手机端能操作的工作区范围。
- 审批、question、WebSocket 连接状态等运行中状态默认放内存；服务重启后从 Codex app-server 重新读取会话即可。

## 文档语言约定

后续所有人工编写的项目文档都使用中文，包括 README、设计文档、实施计划、开发说明和测试说明。

例外：协议生成文件、代码里的类型名/API 名、命令、路径、第三方库名称保持原文，避免破坏可再生成性和可搜索性。
