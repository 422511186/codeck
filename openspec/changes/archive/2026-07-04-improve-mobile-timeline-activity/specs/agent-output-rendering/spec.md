## ADDED Requirements

### Requirement: Timeline 活动按 turn 聚合为可展开摘要
移动端 timeline SHALL 将同一 turn 内连续的 Thinking、工具调用、shell/bash、read/list/search、文件变更和验证类输出聚合为轻量 activity block。activity block SHALL 默认展示摘要行，并允许用户展开查看原始活动详情。

#### Scenario: 默认显示活动摘要
- **WHEN** 一个 turn 内产生多个 reasoning、tool、command 或 diff entry
- **THEN** timeline MUST 默认显示一个或多个 activity block 摘要
- **AND** 摘要 MUST 不把每个底层 entry 都以同等重量的独立卡片铺满首屏

#### Scenario: 展开后保留原始详情
- **WHEN** 用户展开 activity block
- **THEN** 系统 MUST 显示被聚合的原始活动详情
- **AND** 详情 MUST 包含原始命令、工具名、参数、输出、路径、diff 或错误信息中可用的内容

#### Scenario: 活动分组不改变 timeline 事实源
- **WHEN** timeline 执行 rewind、fork、snapshot repair 或 SSE delta 幂等处理
- **THEN** 系统 MUST 继续基于底层 timeline entry 的稳定身份和 turn metadata 处理
- **AND** activity block MUST NOT 引入新的可见重复项或丢弃底层事件

#### Scenario: 失败活动在摘要层可见
- **WHEN** 被聚合的活动中包含失败命令、错误工具调用或错误事件
- **THEN** activity block 摘要 MUST 明确显示失败状态
- **AND** 用户 MUST 不需要展开才能知道该组活动存在失败

### Requirement: 活动摘要使用移动端可扫读文案
活动摘要 SHALL 使用短文案表达动作类别和数量，例如 `Read files · 6`、`Searched files · 1`、`Ran commands · 2`、`Files changed · 7 · +55 -36`。摘要 SHALL 避免显示完整绝对路径、长 JSON 参数或 Markdown 原始标记。

#### Scenario: read/list/search 动作摘要
- **WHEN** 工具或命令活动包含 read、list、search 等结构化动作
- **THEN** 摘要 MUST 分别显示读取文件、浏览目录或搜索文件的动作类别和数量
- **AND** 展开后 MUST 能查看具体路径或搜索结果摘要

#### Scenario: shell/bash 命令摘要
- **WHEN** 工具活动表示 shell/bash 命令
- **THEN** 摘要 MUST 优先显示命令摘要和运行状态
- **AND** cwd、完整路径和长输出 MUST 放在展开详情中

#### Scenario: 纯文本预览清洗
- **WHEN** 摘要预览来自 Markdown、reasoning 文本、工具参数或输出
- **THEN** 预览 MUST 移除明显 Markdown 控制标记
- **AND** 预览 MUST 在移动端宽度内截断或换行，不能横向溢出

#### Scenario: 未识别工具兜底
- **WHEN** 系统收到尚未识别的工具或 raw response variant
- **THEN** timeline MUST 显示通用活动摘要
- **AND** 展开详情 MUST 保留可读的工具名、类型、参数或结果
- **AND** 系统 MUST NOT 只显示未经整理的大段 JSON 作为默认摘要

## MODIFIED Requirements

### Requirement: 工具卡片折叠态摘要面向移动端阅读优化
工具卡片或 activity row 折叠态 SHALL 优先展示用户能快速理解的动作、工具名或命令摘要，低优先级元数据（如 cwd、完整路径、长 JSON 参数）SHALL 放到次要区域或展开内容中。卡片或 activity row SHALL 保留可追踪性，但默认展示 MUST 避免把 agent 正文回答明显下推。

#### Scenario: 命令工具优先显示命令
- **WHEN** timeline 渲染 `toolKind` 为 `command` 的工具活动
- **THEN** 折叠态标题或摘要行 MUST 优先显示命令内容
- **AND** cwd MUST 不作为标题最前面的主要文本

#### Scenario: 非命令工具保留工具身份
- **WHEN** timeline 渲染 MCP、dynamic、file、web 或 image 工具活动
- **THEN** 折叠态 MUST 显示工具身份或动作名称
- **AND** 长参数或长路径 MUST 不导致标题横向溢出

#### Scenario: 连续工具活动合并摘要
- **WHEN** 同一 turn 内连续出现多个 read、list、search、command、MCP 或 dynamic 工具活动
- **THEN** timeline MUST 可以将它们合并到同一个 activity block
- **AND** activity block 摘要 MUST 显示每类活动的数量或关键状态

#### Scenario: 活动与 assistant 消息按原始顺序穿插
- **WHEN** 同一 turn 内真实顺序为 assistant 消息、工具活动、assistant 消息、文件变更、assistant 消息
- **THEN** timeline MUST 按该原始顺序渲染为消息、activity、消息、activity、消息
- **AND** 系统 MUST NOT 仅按 entry role 将所有 activity 提前集中显示在用户消息之后

### Requirement: 推理过程默认折叠为「思考中…」并保留可展开
`reasoning_delta` 事件在 agent 进行中 SHALL 渲染为运行中的 `Thinking...` 活动；卡片或活动块 SHALL 保留运行中状态，并在已经收到推理文本时允许用户查看已到达内容。turn 完成后 SHALL 保留为 `Thinking` 活动，仍默认折叠，可点击展开查看完整推理文本。

#### Scenario: 进行中且尚无文本
- **WHEN** agent 开始 reasoning 但尚未收到任何 `reasoning_delta` 文本
- **THEN** timeline MUST 显示一条 `Thinking...` 运行中活动
- **AND** 活动 MUST 有微动效以表明在进行

#### Scenario: 进行中且已有文本
- **WHEN** agent 仍在产生 `reasoning_delta` 且至少已有一段推理文本到达
- **THEN** timeline MUST 显示运行中的 `Thinking...` 活动
- **AND** 用户 MUST 能在卡片或活动详情中看到或展开查看已到达的推理文本
- **AND** 活动 MUST 继续显示运行中状态

#### Scenario: summary 分段事件不中断展示
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 后继续收到 `item/reasoning/summaryTextDelta`
- **THEN** timeline MUST 继续把 summary delta 追加到对应 Thinking 活动
- **AND** MUST 不因为 summary part 事件本身没有文本而丢弃后续推理内容

#### Scenario: summary 分段先创建思考卡片
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 或 reasoning `item/started` 且尚无文本 delta
- **THEN** timeline MUST 立即显示一条运行中的 `Thinking...` 活动
- **AND** 后续 `item/reasoning/summaryTextDelta` 或 `item/reasoning/textDelta` MUST 追加到同一条 Thinking 活动

#### Scenario: reasoning summary 请求与展示链路完整
- **WHEN** Web 发起一个支持 reasoning 的 turn
- **THEN** 请求参数或会话设置 MUST 明确保留可公开展示的 reasoning summary 配置
- **AND** Web MUST 渲染 app-server 已公开发送的 reasoning summary/content/delta
- **AND** Web MUST NOT 伪造模型未公开发送的隐藏推理内容

#### Scenario: turn 完成
- **WHEN** 该 turn 的 reasoning 流结束
- **THEN** Thinking 活动 MUST 保留在 timeline 中
- **AND** 活动标题 MUST 改为 `Thinking`
- **AND** 活动 MUST 仍默认折叠
- **AND** 用户点击 MUST 可展开查看完整推理文本

### Requirement: 文件 diff 每个文件一张卡片
当 agent 修改文件、`turn_diff_updated` 事件到达时，移动端 timeline SHALL 默认在 activity block 中显示文件变更汇总；用户展开后 SHALL 能按文件查看每个被修改文件的 diff 详情。多个文件默认 MUST 不以多张同等重量的折叠卡片挤占首屏。

#### Scenario: 单文件改动
- **WHEN** agent 修改了 1 个文件
- **THEN** timeline MUST 显示文件变更摘要
- **AND** 摘要 MUST 包含该文件路径或文件名以及增删行数
- **AND** 展开后 MUST 能查看该文件的 unified diff

#### Scenario: 多文件改动
- **WHEN** agent 一次修改了 N 个文件
- **THEN** timeline MUST 默认显示一条文件变更汇总，包含文件数量和总增删行数
- **AND** 展开后 MUST 能按文件查看 N 个 diff 详情

### Requirement: Timeline execution events are never silently dropped
Web timeline SHALL render every app-server execution-related historical item and realtime notification that represents user-visible agent work, including shell commands, command/process output, file changes, MCP/dynamic tools, collaboration or exploration tool calls, sub-agent activity, web search, image operations, skill loading activity, and raw response items that have no later normalized `ThreadItem`.

#### Scenario: Historical command item is visible
- **WHEN** `thread/read` or turns pagination returns a `commandExecution` item
- **THEN** timeline MUST render a command or tool activity for that item
- **AND** the activity MUST include the command text, status, and any aggregated output that exists

#### Scenario: Realtime command output is visible
- **WHEN** WebSocket 或 SSE receives command output through `item/commandExecution/outputDelta`, `command/exec/outputDelta`, or `process/outputDelta`
- **THEN** timeline MUST append the output to a visible running command or tool activity
- **AND** subsequent deltas for the same execution MUST update the same activity instead of creating unrelated orphan text

#### Scenario: Exploration and collaboration tool calls are visible
- **WHEN** app-server returns or emits an exploration, collaboration, sub-agent, MCP, dynamic tool, file change, skill loading, web, image, or search item
- **THEN** timeline MUST render a visible activity that identifies the event kind and status
- **AND** the item MUST NOT be dropped solely because the exact protocol variant is newer than the original Web adapter

#### Scenario: Raw response message items remain readable
- **WHEN** app-server emits raw response items of type `message`, `agent_message`, reasoning, shell, function, custom tool, or tool output before a normalized `ThreadItem` exists
- **THEN** timeline MUST normalize each item into a readable agent message, Thinking activity, command activity, tool activity, or system/error fallback
- **AND** user-visible agent text MUST NOT be shown only as raw JSON
