# Codex 移动端 Web 设计

日期：2026-06-22
工作区：`C:\Users\huang\workspace\codex-web`

## 目标

构建一个移动端 Web 版本的 Codex，通过 Codex app-server 协议远程操作后端机器上的 Codex。产品目标是在手机浏览器里 1:1 复刻 VS Code Codex 插件的能力：会话、历史记录、fork、重新编辑发送、模型切换、思考强度切换、图片输入、权限确认、question 确认、终端/文件变更输出，以及面向远程开发的工作区能力。

后端不重新实现 Codex agent 行为。真正的执行、权限、持久化、模型路由、工具调用和会话状态都由 Codex 负责。这个 Web 应用只做一个安全、适合浏览器访问的 app-server 协议客户端。

## 当前上下文

项目最初是空目录。现在已经包含本设计文档、生成的协议文件、基础 `.gitignore`，并初始化了 git 仓库。

本机已安装 Codex CLI，npm 包为 `@openai/codex`，版本是 `0.141.0`。CLI 暴露了以下能力：

- `codex app-server`
- `codex app-server daemon`
- `codex app-server generate-ts`
- `codex app-server generate-json-schema`
- `codex remote-control`
- `codex --remote <ws://...>`

协议快照已经生成到：

- `docs/generated/app-server-ts`
- `docs/generated/app-server-json-schema`

生成出来的 app-server 协议覆盖了实现插件级体验所需的主要能力：

- 会话：`thread/start`、`thread/resume`、`thread/fork`、`thread/list`、`thread/search`、`thread/read`、`thread/turns/list`、`thread/turns/items/list`、`thread/rollback`、`thread/archive`、`thread/delete`、`thread/settings/update`。
- 回合：`turn/start`、`turn/steer`、`turn/interrupt`。
- 输入：文本、图片 URL、本地图片路径、skill、mention。
- 审批和提问：命令执行审批、文件变更审批、权限审批、工具向用户提问、MCP elicitation、动态工具调用、鉴权 token 刷新。
- 运行时输出：item 生命周期、agent 文本增量、reasoning 增量、命令输出、文件变更输出、patch 更新、计划更新、diff、终端交互、token 用量、模型 reroute。
- 配置：`model/list`、`modelProvider/capabilities/read`、`permissionProfile/list`、`collaborationMode/list`、`config/read`、`config/value/write`、`config/batchWrite`。
- 远程控制：启用、禁用、状态、配对、客户端列表、撤销客户端。
- 工作区/文件：读写文件、列目录、监听文件、复制/删除文件、进程和命令执行、后台终端。

## 方案选择

### 方案 A：CLI 文本包装

启动交互式 `codex` 进程，然后解析终端输出。

优点：原型简单。
缺点：很难做到完整复刻，解析脆弱，权限确认和 question 处理困难，历史/fork 语义不可靠。

结论：放弃。

### 方案 B：浏览器直接连接 app-server

把 Codex app-server 的 WebSocket 直接暴露给浏览器。

优点：后端逻辑最少，最贴近原始协议。
缺点：远程访问风险太高，浏览器会直接拿到后端机器控制能力，鉴权和多用户隔离困难，app-server 协议变动会直接冲击前端。

结论：不作为主架构。

### 方案 C：安全协议代理 + 移动端 Web 工作台

后端负责连接 app-server，把协议事件规范化后提供给浏览器，同时处理个人登录 token、工作区边界、上传文件和内存态请求队列。

优点：最接近 VS Code 插件能力，同时安全性和兼容性可控。后端可以通过重新生成协议绑定来吸收 app-server 变化。
缺点：实现量更大，测试面更宽。

结论：采用。

## 架构

系统分为四层：

1. Web 前端

   使用 React/Next.js 构建移动端浏览器工作台，以触控优先的视图展示 Codex 会话、消息时间线、审批、question、文件变更、终端输出、模型控制、思考强度控制、历史记录、fork 和编辑重发。

2. Web 后端

   使用 Node.js 服务端，负责校验个人登录 token、启动或连接 Codex app-server、校验请求、代理协议调用，并向浏览器广播规范化事件。

3. Codex app-server 适配层

   使用 `codex app-server generate-ts --experimental` 生成的类型构建 JSON-RPC/WebSocket 客户端。只有这一层允许直接说 app-server 原始协议。

4. Codex app-server

   运行在后端机器上的本地 Codex daemon，或者显式启动的 `codex app-server --listen ws://...` 进程。它负责真实的 Codex 执行、状态、审批、工具、文件和 shell 访问。

浏览器永远不直接连接 Codex app-server。浏览器只连接本项目自己的 Web 后端。

## 传输方式

后端启动时支持两种模式：

- 托管 daemon 模式：运行 `codex remote-control start --json` 或 `codex app-server daemon start`，然后连接返回的 endpoint。
- 显式监听模式：启动 `codex app-server --listen ws://127.0.0.1:<port>`，由后端监督该进程。

本地开发阶段优先使用显式监听模式，简单、可控。接近生产或远程访问时优先使用托管 daemon 模式，因为它更贴近 Codex remote-control 生命周期。

浏览器侧使用 WebSocket 接收实时事件；不需要流式更新的查询可以走 HTTP。后端可以暴露一个浏览器 WebSocket，并在其中复用多种规范化事件。

## 移动端前端产品形态

首屏就是移动端工作台，不做落地页。应用只针对手机屏幕和触控输入优化，桌面端布局不是产品目标。

核心移动端布局：

- 顶部栏：当前会话标题、运行状态、模型标识、精简菜单、连接状态。
- 主时间线：用户消息、agent 文本增量、reasoning 摘要、计划、命令执行、工具调用、审批、文件变更、diff、图片和 final answer。
- 底部固定输入框：文本输入、图片附加、发送、中断、精简设置入口。必须适配手机键盘和安全区。
- 底部导航：`Chats`、`Run`、`Files`、`Terminal`、`Settings`。
- 抽屉/底部 sheet：会话搜索和历史、fork/编辑操作、模型选择、思考强度选择、审批模式、权限、token 用量、MCP/工具状态。
- Diff/文件视图：全屏或底部面板形式，支持代码横向滚动和稳定的触控点击区域。
- 审批/question UI：使用底部弹层，按钮足够大，命令/文件摘要清晰；如果 app-server 提供 session 级审批选项，需要展示出来。

必须支持的交互：

- 用 cwd、workspace roots、模型、思考强度、sandbox/permissions 创建会话。
- 使用 `thread/list`、`thread/read`、`thread/resume`、`thread/turns/list`、`thread/turns/items/list` 恢复和切换会话历史。
- 使用 `thread/fork` fork 会话，并保留或覆盖 cwd/model/permissions。
- 使用 `thread/rollback` 回滚到某个 turn 边界，再通过 `turn/start` 发送替换后的输入，实现编辑重发。注意：`thread/rollback` 只修改 Codex 会话历史，不会自动回滚已落到本地文件系统的变更。如果被编辑掉的 turn 产生过文件变更，UI 必须警告用户，并提供 diff/revert 工作流。
- 通过 `turn/start` override 和必要时的 `thread/settings/update` 切换模型和思考强度。
- 通过 `UserInput` 的 `image` 和 `localImage` 发送图片；URL/data-backed 上传走 `image`，后端本地暂存文件走 `localImage`。
- 展示 `ServerRequest` 里的审批和 question，并返回 JSON-RPC response。
- 使用 `turn/interrupt` 中断正在运行的 turn。
- 当 app-server 标记当前 turn 可 steer 时，使用 `turn/steer` 继续补充指令。

## 后端职责

后端负责：

- 个人登录 token 校验：优先使用配置的 `CODEX_WEB_ACCESS_TOKEN`；未配置时启动阶段自动生成随机长 token。
- 浏览器 signed session cookie 和 Codex thread 的映射。
- 工作区 allowlist 和路径校验。
- app-server 进程监督。
- WebSocket 重连和事件恢复。
- JSON-RPC request id 跟踪。
- 内存中的待处理审批/question 队列。
- 浏览器安全可消费的事件规范化。
- 图片上传到本地目录暂存。
- 协议版本检查和生成绑定刷新。

后端不负责：

- agent prompting。
- shell 命令执行语义。
- 文件修改语义。
- 权限策略语义。
- thread 持久化格式。
- 模型/provider 实现。

## 协议映射

浏览器动作到 app-server request：

- 新建聊天：`thread/start`，然后 `turn/start`。
- 发送消息：`turn/start`。
- 运行中追加指令：`turn/steer`。
- 停止生成：`turn/interrupt`。
- 切换会话：`thread/resume` 加 `thread/turns/list`。
- Fork：`thread/fork`。
- 编辑历史消息：`thread/rollback`，然后 `turn/start`。
- 重命名：`thread/name/set`。
- 归档/删除：`thread/archive`、`thread/delete`。
- 模型列表：`model/list`。
- Provider 能力：`modelProvider/capabilities/read`。
- 权限配置列表：`permissionProfile/list`。
- 会话设置：`thread/settings/update`。
- 文件预览：`fs/readFile`、`fs/readDirectory`、`fs/watch`。
- 终端/进程工具：仅在 VS Code 插件级 UI 需要时使用 `command/exec` 和 `process/*`。

app-server request 到浏览器 UI：

- `item/commandExecution/requestApproval`：命令审批弹层。
- `item/fileChange/requestApproval`：文件变更审批弹层。
- `item/permissions/requestApproval`：权限升级审批弹层。
- `item/tool/requestUserInput`：question 弹层。
- `mcpServer/elicitation/request`：MCP elicitation 弹层。
- `item/tool/call`：动态工具渲染和响应桥接。
- `account/chatgptAuthTokens/refresh`：账号重新鉴权提示。
- `applyPatchApproval` 和 `execCommandApproval`：旧协议兼容审批 UI。

app-server notification 到浏览器流：

- `item/agentMessage/delta`、`item/reasoning/*`、`item/plan/delta`。
- `item/started`、`item/completed`。
- `item/commandExecution/outputDelta`、`command/exec/outputDelta`、`process/outputDelta`。
- `item/fileChange/outputDelta`、`item/fileChange/patchUpdated`、`turn/diff/updated`。
- `turn/started`、`turn/completed`、`turn/plan/updated`。
- `thread/status/changed`、`thread/settings/updated`、`thread/tokenUsage/updated`。
- `serverRequest/resolved`。
- `model/rerouted`、`model/verification`。
- warning、config warning、账号状态、remote-control 状态更新。

## 安全边界

远程开发意味着手机浏览器可以间接触发后端机器上的 shell 命令和文件写入。后端必须保守。

最低安全要求：

- 任何 app-server 访问前都必须先通过个人登录 token 登录 Web 应用。
- app-server 尽量只绑定 loopback。
- 如果 app-server 监听非 loopback 地址，必须使用 app-server WebSocket auth。
- 永远不把原始 app-server endpoint 或 token 暴露给浏览器。
- 维护配置文件/环境变量里的工作区 allowlist；拒绝 allowlist 外的 cwd 和 runtime roots。
- 图片上传只存到项目自有暂存目录，并只传递安全的本地路径。
- 除非用户主动选择允许更宽松的 Codex 权限配置，否则 server-request 审批必须显式确认。
- 映射到命令执行、文件写入、审批、权限变更、配置写入的浏览器动作可以写入本地追加日志；个人模式下不需要数据库审计表。
- 支持 remote-control 客户端列表、撤销和配对状态。

## 状态模型

个人自用模式不引入数据库。Web 应用自己的持久化状态尽量为零，因为 Codex 已经负责保存 thread 内容。

配置来源：

- `CODEX_WEB_ACCESS_TOKEN`：手机端登录用的独立 token。可以设置成用户习惯的 `sk-...` 字符串。配置存在时优先使用配置值；未配置时后端启动时自动生成随机长 token，并打印到控制台供登录使用。这个 token 不需要等同于模型/API key。
- `CODEX_WEB_WORKSPACE_ROOTS`：允许手机端操作的工作区根目录列表。
- `CODEX_WEB_BIND_HOST` 和 `CODEX_WEB_BIND_PORT`：Web 服务监听地址。
- Codex 模型/API key：优先留在后端环境变量或 Codex 自己的配置中，不放进前端代码。

运行中状态：

- signed session cookie：浏览器登录态，不需要用户表。登录成功后写入 cookie；后续请求不再反复提交 token。
- 内存 map：WebSocket 连接、thread 订阅、pending approvals/questions、request id 关联。
- 本地上传目录：图片暂存文件，按时间清理。
- 可选追加日志文件：记录敏感动作，个人模式下不需要数据库表。

Codex 会话内容仍保留在 Codex 状态里。Web 应用通过 app-server 方法读取，不在自己的数据库复制一份。

## 错误处理

- app-server 连接断开：显示断连状态，指数退避重连，在重连或明确失败前保留待处理浏览器动作。
- app-server 进程崩溃：由后端监督重启，然后通过 `thread/loaded/list` 和 `thread/resume` 重新加载活跃会话。
- 协议不匹配：启动失败并给出明确提示，要求重新生成协议绑定。
- 审批/question 超时：展示 app-server 的实际处理结果，不在浏览器侧编造默认决定。
- 上传失败：阻止发送，并展示失败附件。
- 工作区路径被拒绝：在调用 app-server 前拒绝，并写入本地日志。
- 编辑重发遇到文件变更：如果 rollback 会留下过期的工作区修改，要求用户先查看或回滚相关 diff。

## 测试策略

单元测试：

- JSON-RPC request/response 关联。
- app-server 事件规范化。
- 内存审批/question 队列。
- 工作区路径校验。
- 模型/思考强度设置映射。
- 图片上传暂存和清理。

集成测试：

- 启动 app-server、initialize、列模型、创建 thread、发送文本、接收增量。
- 以本地暂存路径发送图片。
- 触发命令审批并回答。
- fork 一个 thread，并确认新 thread 可以加载。
- rollback 并重新发送编辑后的输入。
- 恢复历史 thread，并分页加载 turns/items。

移动端浏览器测试：

- 手机视口打开后直接进入工作台，没有落地页。
- 会话列表以移动端 sheet 打开，并能切换历史。
- 虚拟键盘打开时，底部固定输入框仍能发送文本和图片。
- 审批 sheet 的触控控件可用。
- question sheet 的触控控件可用。
- 模型和思考强度能从紧凑 sheet 更新到下一次 turn。
- fork 和编辑重发流程不依赖桌面侧边栏。
- diff、terminal、settings 面板在窄屏上可用。

人工验证：

- 在同一局域网的手机或手机尺寸浏览器上运行 Web 应用。
- 确认浏览器不能直接访问原始 app-server。
- 确认所有远程动作都进入审计日志。
- 确认审批、question、输出、历史等能力与 VS Code 插件能力一致，只是导航形态改为移动端。

## 实施顺序

1. 搭建 TypeScript 项目，包含后端、前端、共享协议包、生成的 app-server bindings。
2. 实现 app-server client：JSON-RPC transport、生成类型、request 关联、notification stream。
3. 加入个人登录 token、工作区 allowlist、app-server 进程监督、浏览器 WebSocket。
4. 实现会话列表、历史、resume 和实时 timeline 渲染。
5. 实现文本输入、模型、思考强度、审批策略和图片上传。
6. 实现来自 `ServerRequest` 的审批和 question。
7. 实现 fork、rollback/编辑重发、interrupt、steer。
8. 实现文件/diff/terminal 面板。
9. 加入审计日志、错误恢复、重连/replay 和生产级加固。

## 非目标

- 重新实现 Codex 模型或工具执行。
- 使用终端文本解析作为主集成方式。
- 把原始 app-server token 暴露给浏览器。
- 构建营销落地页。
- 支持用户表、团队账号、权限分组或不可信多租户。
- 构建桌面端布局。

## 风险

- app-server 协议仍是 experimental，可能变化。生成的 bindings 和 schema 快照必须可刷新。
- 完整复刻 VS Code UI 细节时，可能需要在实现阶段观察插件实际行为。
- 部分 remote-control 流程可能依赖 Codex desktop/app 的安装状态。
- 本地图片处理必须符合 app-server 对 `localImage` 路径的要求。
- 完整插件级能力还会涉及许多较小视图：账号、rate limits、MCP 状态、插件/skill 面板、warning、review mode、realtime、external-agent import。
