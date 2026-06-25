## Why

仓库当前只剩后端代理和 app-server 协议适配，已经具备 114 个 HTTP route 和 `/ws` 实时通道，但没有任何前端入口可消费这些能力。需要一套**移动端 web 前端**来覆盖个人用户的日常使用场景：在手机浏览器里管理多个 Codex 项目、和 agent 对话、确认审批、查看执行结果。

本变更确立这套前端的**功能形态与 UI 形态**，作为后续实现的契约基线。设计上参考 opencode 的 web app（聊天 + agent 执行视图 + diff/工具/审批），但**全面剪裁为移动端 web 单一形态**，砍掉桌面、原生 app、通知、语音、文件树、独立终端、Share 公开链接等不适合手机的能力。

## What Changes

- 新增**移动端 web 前端**，作为 `/api/codex/*` 和 `/ws` 的唯一消费者。
- 新增**三层导航**：登录页 → 项目页 → 项目内会话列表 → 会话聊天页。三个页都有独立 URL，支持刷新和直链。
- 新增**项目管理**：用户主动添加工作区路径作为项目，列表存 localStorage；项目页是首屏。
- 新增**会话列表**：项目内 tab 切换「进行中 / 已归档」，每条显示会话名 + 最后一条 user 消息，按最后活动时间倒序；运行中会话用「正在运行」替代时间戳。
- 新增**会话聊天页**：单栏 timeline、Plan/Build segmented 开关、模型完整显示、⋮ 底部抽屉、所有长输出（命令/diff/推理/MCP/计划）默认折叠为卡片就地展开。
- 新增**审批内嵌卡片**：在 timeline 中按顺序内嵌，失效审批标灰；不做跨会话 inbox。
- 新增**底部输入区**：单行 + ⤢ 触发全屏编辑器；图片只能从相册选、单张；草稿按会话存 localStorage；发送按钮在 agent 跑中变为中断；旁边一个「↺ 重发上一条」入口。
- 新增**设置页最小集**：默认模型与模式、账号、Token 用量、登出 Web。
- 新增**前端状态适配**：网络断开顶部细横幅、WS 无限重试、会话 timeline 内存缓存、错过期间全量回填、session 失效自动跳回登录页。
- 不做：桌面端布局、原生 app、Web Push 通知、语音 / Realtime、Share 公开链接、文件浏览 / 文件树、独立终端 PTY、会话搜索、项目搜索、下拉刷新、ster、跨会话审批 inbox。

## Capabilities

### New Capabilities
- `mobile-web-shell`: 移动端 web 壳体，包含登录、路由、主题、断线横幅、session 失效跳转、页间过渡。
- `project-management`: 用户在前端 localStorage 维护的项目（工作区）列表：添加、重命名、移除、排序，作为首屏。
- `thread-list-view`: 项目内会话列表，进行中 / 已归档 tab 切换、排序、会话条信息、运行状态标识、空状态。
- `thread-chat-view`: 单个会话聊天页 timeline 主体：用户/agent 消息块、markdown、相对时间、长按菜单、无限滚动、跳到最新、自动滚动策略。
- `agent-output-rendering`: agent 流式输出的呈现：默认折叠卡片就地展开，覆盖命令、diff、推理、MCP 工具调用、计划条、系统消息。
- `approval-inline-cards`: 内嵌在 timeline 中的审批卡片：command/file/permissions/question 等待 resolve 的呈现与交互；失效时灰化。
- `chat-input-area`: 底部输入区：单行 + 全屏编辑器、图片相册选单张、草稿按会话保存、发送/中断/重发按钮族。
- `thread-controls`: 会话级控制：头部 Plan/Build segmented、模型切换、底部抽屉（重命名 / 归档 / 压缩上下文 / Fork）。
- `settings-minimal`: 最小集设置：默认模型与模式、账号状态、Token 用量、登出 Web。

### Modified Capabilities
（无；本变更只新增前端能力，不修改任何已有后端 spec 的 requirement。）

## Impact

- **新增前端代码**：`src/app/(mobile)/` 下的 Next.js page 路由（登录、项目、会话列表、会话聊天、设置），共享组件、状态层、WS 连接管理、localStorage 适配器。
- **依赖**：可能新增 markdown 渲染器、mermaid 渲染器、diff 渲染器等前端依赖。具体选型在 design.md 决定。
- **后端 API**：无需修改。前端只消费现有 `/api/codex/*` 和 `/ws`。如果实施阶段发现缺口，单独提变更。
- **localStorage 数据形态**：项目列表、项目别名、按会话的草稿、用户上次浏览位置（如有）将占用前端持久化层，需要约定 key 命名空间。
- **不影响**：app-server 协议、后端审计日志、workspace allowlist、session cookie 机制、运行模式（spawn/external/mock/off）。
