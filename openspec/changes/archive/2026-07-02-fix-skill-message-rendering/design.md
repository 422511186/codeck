## Context

当前移动端聊天页在发送 Skill 引用时，输入区使用结构化 `skillReferences` 传给后端；但服务端回读 `ThreadItem.userMessage.content` 后，移动端转换层只处理 `text`、`localImage` 和 `image`，其他片段统一兜底为 `[type]`。因此 `type: "skill"` 被渲染成 `[skill]`，导致用户消息展示与发送前的 chip 状态不一致。

工具过程卡片也存在移动端信息优先级问题。`commandExecution` 历史项被映射为 `toolKind: "command"`，当前 `ToolCard` 标题按 `server · tool` 展示，而 `server` 对命令通常是工作目录。手机宽度有限时，长路径会挤掉真正有价值的命令内容。

## Goals / Non-Goals

**Goals:**

- 保持 Skill 引用为结构化 timeline 数据，不再把它混入用户正文。
- 用户消息在本地乐观态、服务端回读、分页历史、snapshot repair 后展示一致。
- 用户能看到消息引用了哪些 Skill，但 `[skill]` 不再出现在正文。
- 命令/工具卡片折叠态优先展示动作名称或命令本身，长路径等元数据降级到展开内容或次要区域。
- 保留执行过程卡片，继续满足可追踪、可调试要求。

**Non-Goals:**

- 不改变 app-server 的 `UserInput` 协议。
- 不改变 Skill picker 的选择、校验和发送流程。
- 不隐藏推理、命令、工具、diff 等执行过程事件。
- 不新增桌面端布局；验证目标仍以手机浏览器为准。

## Decisions

### Decision: 在移动端 timeline item 中增加 Skill 引用字段

`MobileTimelineItem` 和前端 `TimelineEntry` SHALL 增加可选 `skillReferences` 字段，字段元素复用现有 `{ name, path }` 结构。`userMessageView()` 在遇到 `content.type === "skill"` 时 SHALL 收集 `name/path` 并返回空文本片段，而不是走未知类型兜底。

理由：这保持了正文文本的纯净，也让渲染层能决定用 chip、标签或其他轻量 UI 展示 Skill 引用。备选方案是直接过滤 `skill` 不显示，但历史消息会丢失“当时引用了哪个 Skill”的可见性。

### Decision: 用户消息组件负责渲染只读 Skill chip

`UserMessage` SHALL 在正文上方或下方以轻量 chip 渲染 `skillReferences`。chip 只显示 Skill 名称，必要时可用 `path` 做稳定 key 或辅助信息，但不应把完整路径放进主视觉区域。

理由：输入区已经用 chip 表达“引用 Skill”，发送后保持同一语义最符合用户预期。备选方案是把 Skill 名称拼进正文，例如 `引用 Skill: openai-docs`，但这会重新污染可复制文本。

### Decision: 本地乐观消息也携带 Skill 引用

发送时创建的本地乐观 `user-message` entry SHALL 携带本次发送的 `skillReferences`。服务端返回同一消息后，去重和替换逻辑 SHALL 保留这些引用，避免发送瞬间 chip 消失或回读后才出现。

理由：移动端用户会立即看到发送结果；如果乐观态与服务端态不一致，会被误判为引用丢失。备选方案是只依赖服务端回读，但这会引入闪烁和短暂错误展示。

### Decision: 命令类 ToolCard 标题优先展示命令

当 `ToolEntry.toolKind === "command"` 时，折叠态标题 SHALL 优先展示 `entry.tool` 或可读命令摘要；`entry.server` 中的 cwd SHALL 作为展开内容或次要元数据展示。非命令工具仍可使用 `server · tool`，但标题需要避免长路径占据主要空间。

理由：命令本身才是用户判断过程是否相关的关键信息。备选方案是截断 cwd 后仍展示在标题前方，但在手机上仍会抢占最有限的横向空间。

## Risks / Trade-offs

- [Risk] 增加 timeline 数据字段后，部分转换和测试可能遗漏 `skillReferences` → Mitigation：同时覆盖 app-server 转换、前端 timeline conversion、用户消息组件测试。
- [Risk] 过滤 `skill` 后未知用户输入类型仍需可见，不能误删其他协议片段 → Mitigation：只显式处理 `skill`，保留未知类型兜底；可顺带评估 `mention` 是否需要单独展示。
- [Risk] 命令标题调整可能改变现有测试断言或用户对路径的可见性 → Mitigation：把 cwd 放到展开内容或次要文案，保持可追踪但降低默认权重。
- [Risk] chip 过多时挤占移动端空间 → Mitigation：chip 行允许换行，名称过长使用省略；正文布局不被横向撑开。
