# agent-output-rendering Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 所有长输出默认折叠为卡片
Agent 流式产生的长详情内容（命令完整输出、文件 diff、MCP/dynamic 工具长结果、raw response fallback、公开 reasoning 长文本）SHALL 默认折叠在内联活动日志的详情区域中，用户点击后就地展开 / 收起，不弹出新页或抽屉。短活动本身 MUST 以内联日志行默认可见，MUST NOT 因为属于工具或 reasoning 就被强制显示为独立折叠卡片。

#### Scenario: 短活动默认可见
- **WHEN** agent 输出工具加载、读取文件、搜索、短命令名或文件变更摘要
- **THEN** timeline MUST 在内联活动日志中默认显示这些短明细
- **AND** MUST NOT 只用一张折叠卡片隐藏所有短明细

#### Scenario: 长详情就地展开
- **WHEN** 用户点击内联活动日志的展开按钮
- **THEN** 长详情 MUST 在原位置就地展开
- **AND** MUST 不跳转到任何新页面或弹出抽屉

### Requirement: 命令折叠态只显示命令
当 agent 调用 shell 命令时 SHALL 在 timeline 上以折叠卡片呈现，折叠状态下 SHALL 优先显示命令本身或命令摘要（如 `npm test`），不显示输出内容。若命令项同时包含工作目录等元数据，折叠态主标题 MUST 不让长路径优先于命令内容。

#### Scenario: 命令折叠呈现
- **WHEN** agent 发起一次 shell 命令调用
- **THEN** 折叠卡片 MUST 显示完整命令行或在空间不足时显示命令摘要
- **AND** MUST 不预览任何输出
- **AND** 工作目录等长元数据 MUST 不抢占命令标题的主要位置

#### Scenario: 展开后查看输出
- **WHEN** 用户点击命令卡片展开
- **THEN** 卡片 MUST 显示该命令的完整输出
- **AND** 输出区 MUST 限制最高 N 行（建议 24 行），超出部分内部可滚动
- **AND** 若存在工作目录等元数据，展开后 MUST 仍可查看

### Requirement: 工具卡片折叠态摘要面向移动端阅读优化
工具、命令、MCP、dynamic、file、web、image 或 runtime loading 活动在移动端 SHALL 优先以内联活动日志行呈现。默认状态 SHALL 展示用户能快速理解的动作、工具名、命令摘要或短明细；低优先级元数据（如 cwd、完整路径、长 JSON 参数）SHALL 放到展开详情中。系统 SHALL 保留可追踪性，但默认展示 MUST 避免把 agent 正文明显下推。

#### Scenario: 命令工具优先显示命令
- **WHEN** timeline 渲染 `toolKind` 为 `command` 的工具活动
- **THEN** 默认明细 MUST 优先显示命令内容或短命令摘要
- **AND** cwd MUST 不作为默认明细最前面的主要文本

#### Scenario: 非命令工具保留工具身份
- **WHEN** timeline 渲染 MCP、dynamic、file、web 或 image 工具活动
- **THEN** 默认明细 MUST 显示工具身份或动作名称
- **AND** 长参数或长路径 MUST 不导致标题横向溢出

#### Scenario: 连续工具活动合并为内联日志
- **WHEN** 同一 turn 内连续出现多个 read、list、search、command、MCP、dynamic 或 runtime loading 活动
- **THEN** timeline MAY 将它们合并到同一个内联活动日志组
- **AND** 该日志组 MUST 使用具体动作摘要和默认可见短明细

### Requirement: 正在运行的命令卡片显示 spinner
agent 当前仍在执行的命令卡片 SHALL 在右侧显示 spinner 并附「运行中」标签，与已完成命令区分。

#### Scenario: 运行中命令
- **WHEN** `command_output_delta` 还在持续到达
- **THEN** 命令卡片右侧 MUST 显示 spinner
- **AND** MUST 附「运行中」标签

#### Scenario: 命令完成
- **WHEN** 该命令的输出流结束
- **THEN** spinner 和「运行中」标签 MUST 消失

### Requirement: 命令失败用左侧红色色条
命令以非 0 退出码结束时 SHALL 在折叠卡片左侧显示红色色条，用于一眼区分成功与失败。

#### Scenario: 命令失败
- **WHEN** 命令退出码 ≠ 0
- **THEN** 卡片左侧 MUST 显示红色色条

#### Scenario: 命令成功
- **WHEN** 命令退出码 = 0
- **THEN** 卡片左侧 MUST 不显示色条

### Requirement: MCP 工具调用与命令同构呈现
agent 调用 MCP 工具时 SHALL 在 timeline 上使用与 shell 命令一致的折叠卡片样式。

#### Scenario: MCP 工具卡片
- **WHEN** agent 触发一次 MCP 工具调用
- **THEN** timeline MUST 用与命令卡片相同的折叠卡片呈现
- **AND** 折叠态 MUST 显示工具名与服务器名
- **AND** 展开后 MUST 显示完整调用结果

### Requirement: 文件 diff 每个文件一张卡片
当 agent 修改文件或 `turn_diff_updated` 事件到达时，移动端 timeline SHALL 默认以内联活动日志显示文件变更汇总；用户展开后 SHALL 能按文件查看每个被修改文件的 diff 详情。多个文件默认 MUST 不以多张同等重量的折叠卡片挤占首屏。

#### Scenario: 单文件改动
- **WHEN** agent 修改了 1 个文件
- **THEN** timeline MUST 显示文件变更内联日志
- **AND** 默认明细 MUST 包含该文件路径或文件名以及增删行数
- **AND** 展开后 MUST 能查看该文件的 unified diff

#### Scenario: 多文件改动
- **WHEN** agent 一次修改了 N 个文件
- **THEN** timeline MUST 默认显示一条文件变更汇总，包含文件数量和总增删行数
- **AND** 展开后 MUST 能按文件查看 N 个 diff 详情

### Requirement: diff 卡片折叠态显示文件路径与行数变化
diff 卡片折叠状态下 SHALL 显示文件路径以及增删行数（如 `+12 / -5`）。

#### Scenario: 折叠态信息
- **WHEN** diff 卡片处于折叠状态
- **THEN** 卡片 MUST 显示文件相对路径
- **AND** MUST 显示该文件的 `+N / -M` 行数变化

### Requirement: diff 展开使用 unified diff 样式
diff 卡片展开后 SHALL 使用 unified diff 渲染，行内显示 + / - 前缀和新增、删除染色。

#### Scenario: 展开 diff
- **WHEN** 用户展开 diff 卡片
- **THEN** 内容 MUST 以 unified diff 形式渲染
- **AND** 新增行 MUST 用绿色（或浅绿底色）
- **AND** 删除行 MUST 用红色（或浅红底色）

### Requirement: diff 卡片纯展示不带操作
diff 卡片 SHALL 不提供任何「采纳」「回滚」「撤销」之类的操作按钮，仅供查看。

#### Scenario: 卡片操作约束
- **WHEN** diff 卡片渲染（无论折叠或展开）
- **THEN** 卡片 MUST 不显示采纳、撤销、回滚等操作按钮

### Requirement: 推理过程默认折叠为「思考中…」并保留可展开
`reasoning_delta` 事件在 agent 进行中 SHALL 渲染为内联 `Thinking...` 活动日志；日志 SHALL 保留运行中状态，并在已经收到公开 reasoning 文本时允许用户展开查看已到达内容。turn 完成后 SHALL 保留为 `Thinking` 活动，仍默认只显示短摘要，可点击展开查看完整公开 reasoning 文本。

#### Scenario: 进行中且尚无文本
- **WHEN** agent 开始 reasoning 但尚未收到任何 `reasoning_delta` 文本
- **THEN** timeline MUST 显示一条运行中的 `Thinking...` 内联活动
- **AND** 活动 MUST 有微动效以表明在进行

#### Scenario: 进行中且已有文本
- **WHEN** agent 仍在产生 `reasoning_delta` 且至少已有一段推理文本到达
- **THEN** timeline MUST 显示运行中的 `Thinking...` 内联活动
- **AND** 用户 MUST 能展开查看已到达的公开推理文本
- **AND** 活动 MUST 继续显示运行中状态

#### Scenario: summary 分段事件不中断展示
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 后继续收到 `item/reasoning/summaryTextDelta`
- **THEN** timeline MUST 继续把 summary delta 追加到对应 Thinking 活动
- **AND** MUST 不因为 summary part 事件本身没有文本而丢弃后续推理内容

#### Scenario: summary 分段先创建思考活动
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 或 reasoning `item/started` 且尚无文本 delta
- **THEN** timeline MUST 立即显示一条运行中的 `Thinking...` 内联活动
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
- **AND** 活动 MUST 仍默认只显示短摘要
- **AND** 用户点击 MUST 可展开查看完整公开推理文本

### Requirement: 推理卡片折叠态高度与其他卡片一致
推理过程卡片折叠状态下的高度 SHALL 与命令、diff、MCP 等其他折叠卡片保持一致，不显得突兀。

#### Scenario: 高度一致
- **WHEN** 推理卡片处于折叠状态
- **THEN** 其外观高度 MUST 与其他折叠卡片一致

### Requirement: 计划事件在 timeline 顶部固定计划条
当一个 turn 内出现 `plan_delta` 时 SHALL 在 timeline 顶部以 sticky 形式渲染计划条；用户可手动折叠，默认展开。

#### Scenario: 出现计划
- **WHEN** turn 内出现 `plan_delta`
- **THEN** 系统 MUST 在 timeline 顶部渲染一个 sticky 计划条
- **AND** 计划条 MUST 默认展开

#### Scenario: 用户折叠
- **WHEN** 用户点击计划条上的折叠按钮
- **THEN** 计划条 MUST 折叠为单行标题
- **AND** 用户再次点击 MUST 重新展开

### Requirement: 计划步骤完成态显示勾选与灰色
计划条内已完成的步骤 SHALL 显示勾选标记并使用灰色文字。

#### Scenario: 已完成步骤
- **WHEN** 某个计划步骤已完成
- **THEN** 该步骤前 MUST 显示勾选标记
- **AND** 文字 MUST 使用灰色

### Requirement: 计划步骤不可点击跳转
计划步骤 SHALL 仅作展示，不允许点击跳转到 timeline 中对应位置。

#### Scenario: 步骤点击
- **WHEN** 用户点击计划条中的某个步骤
- **THEN** 系统 MUST 不执行任何跳转或滚动

### Requirement: 临时进行中状态使用微动效
表示「进行中」的临时状态（思考中、运行中、上传中等）SHALL 使用微动效（如 spinner 或脉冲），不使用大型加载动画。

#### Scenario: 视觉一致
- **WHEN** 多种进行中状态同时存在
- **THEN** 动效 MUST 风格一致
- **AND** MUST 不遮挡正文阅读

### Requirement: 错误统一以内嵌错误卡片呈现
所有错误（turn 跑挂、命令失败、`warning` 事件、网络异常等）SHALL 在 timeline 上以内嵌错误卡片呈现，不弹 alert、不跳页。

#### Scenario: 错误卡片样式
- **WHEN** 出现错误事件
- **THEN** timeline MUST 插入一张错误卡片
- **AND** 卡片 MUST 显示错误简述

#### Scenario: 错误卡片无重试
- **WHEN** 错误卡片渲染
- **THEN** 卡片 MUST 不显示「重试」按钮

### Requirement: Timeline 上 token 消耗不显示
即便后端发送 `token_usage_updated` 事件，timeline SHALL 不显示任何 token 消耗或耗时数据；该信息仅在设置页可见。

#### Scenario: 不显示成本
- **WHEN** 收到 `token_usage_updated`
- **THEN** timeline MUST 不渲染任何 token 数字或耗时

### Requirement: Markdown code blocks follow theme colors
Agent 消息中的 Markdown fenced code block SHALL 使用应用主题 token 渲染背景、文字、边框和滚动区域。语法高亮库的默认样式 MUST NOT 把代码块背景固定为与当前主题不匹配的颜色。

#### Scenario: Light theme code block
- **WHEN** 用户在明亮主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用明亮主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定暗色背景覆盖整个代码区域

#### Scenario: Dark theme code block
- **WHEN** 用户在暗黑主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用暗黑主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定浅色背景覆盖整个代码区域

### Requirement: Markdown code copy button remains visible
Markdown 代码块的复制按钮 SHALL 在明亮主题和暗黑主题下都清晰可见、可点击，并使用当前主题 token 表达默认状态、复制成功状态和复制失败状态。复制按钮 MUST 与代码正文分区布局，不得依赖覆盖在代码右上角的 absolute 浮层作为唯一布局。

#### Scenario: Light theme code copy button
- **WHEN** 用户在明亮主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分

#### Scenario: Dark theme code copy button
- **WHEN** 用户在暗黑主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分

#### Scenario: Copy success state
- **WHEN** 用户点击代码块复制按钮且复制成功
- **THEN** 按钮 MUST 显示复制成功状态

#### Scenario: Copy failure state
- **WHEN** 用户点击代码块复制按钮且复制失败
- **THEN** 按钮 MUST 显示复制失败状态

### Requirement: Code block copy works outside secure contexts
Markdown 代码块复制 SHALL 在 secure context 与非 secure context（如局域网 HTTP）下都可用。系统 MUST 优先使用 Clipboard API，并在其不可用或失败时回退到兼容复制路径；无论成功或失败，复制按钮 MUST 给出可见反馈，MUST NOT 静默失败。

#### Scenario: Clipboard API unavailable on LAN HTTP
- **WHEN** 页面运行在非 secure context 且 `navigator.clipboard.writeText` 不可用
- **AND** 用户点击代码块复制按钮
- **THEN** 系统 MUST 通过兼容回退路径尝试复制完整代码原文
- **AND** 成功时按钮 MUST 显示复制成功状态

#### Scenario: Copy failure is visible
- **WHEN** 用户点击代码块复制按钮
- **AND** Clipboard API 与兼容回退路径都失败
- **THEN** 按钮 MUST 显示复制失败状态
- **AND** MUST NOT 假装复制成功

### Requirement: Code block copy control does not cover code text
Markdown 代码块的复制控件 SHALL 以独立工具栏或同等非覆盖布局呈现，MUST NOT 以浮层方式遮挡代码正文。用户在默认窄屏宽度下阅读代码时，首行与后续正文 MUST 保持完整可见。

#### Scenario: Copy button stays outside code content
- **WHEN** agent 消息渲染包含 fenced code block
- **THEN** 复制按钮 MUST 位于代码正文之外的独立区域
- **AND** 代码正文区域 MUST NOT 被复制按钮覆盖

#### Scenario: Narrow mobile width keeps first line readable
- **WHEN** 用户在移动端宽度查看较短代码块
- **THEN** 代码首行文本 MUST 完整可读
- **AND** MUST NOT 因为复制按钮占位而被裁切或遮挡
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

### Requirement: Live timeline snapshots preserve streamed output
running 会话中，HTTP thread snapshot SHALL NOT 无条件覆盖已经通过 timeline event stream 追加到 timeline 的 live entries。系统 SHALL 以事件流作为运行中输出主路径；snapshot 仅用于初始化、显式 repair、断线缺口恢复或 turn 完成后的权威替换。任何 snapshot 与事件流合并都 MUST 保留 turn 元数据并遵守幂等规则，避免重复追加 agent message、reasoning、command/tool output。

#### Scenario: startTurn response does not erase live deltas
- **WHEN** 用户发送消息后 timeline event stream 已经追加 agent/reasoning/tool delta
- **AND** `startTurn` HTTP 响应随后返回一个不包含这些 delta 的 thread snapshot 或轻量 turn 状态
- **THEN** timeline MUST 保留已经追加的 live entries
- **AND** MUST NOT 通过全量 `setThreadEntries` 清空或回退这些输出

#### Scenario: polling snapshot is not the running main path
- **WHEN** 会话处于 running 状态且 timeline event stream 正常连接
- **THEN** 客户端 MUST NOT 高频轮询 `readThread` 来获取完整 timeline
- **AND** 运行中输出 MUST 由事件流增量更新

#### Scenario: repair snapshot does not duplicate live deltas
- **WHEN** 断线恢复或事件缺口触发 snapshot repair
- **AND** 本地 timeline 已经有更新的 event stream delta
- **THEN** repair 结果 MUST replace 或按 revision 合并当前 timeline
- **AND** MUST NOT 将 snapshot 已包含的文本与后到旧 delta 重复拼接

#### Scenario: completed snapshot can finalize live entries
- **WHEN** turn 完成后 snapshot 或 `item_updated` 返回同 id 的完整 agent/reasoning/tool item
- **THEN** timeline MUST 用完整 item 更新对应 live entry
- **AND** MUST 保持该 entry 的相对位置稳定
- **AND** MUST 保留该 entry 的 `turnId` 或等价 turn 标识

### Requirement: Opening a running thread avoids duplicate immediate reads
打开会话页时，系统 SHALL 使用不含 turns 的 metadata 与一页 bounded latest items 建立首屏基线，并避免在首屏响应后立即发起重复 repair。running fallback SHALL 以 timeline event stream 为实时主路径；只有确认 gap、completion reconcile 或显式 missing-output recovery 才能读取 generation-scoped bounded latest page。系统 MUST NOT 通过 `readThread` 完整 timeline polling 作为 running fallback。

#### Scenario: running thread initial load
- **WHEN** 用户打开一个 status 为 active/running 的会话
- **THEN** 页面 MUST 发起 metadata 与一页 bounded latest items 读取
- **AND** MUST 在首屏响应刚应用后不再立即读取同一 latest page 或完整 timeline
- **AND** 后续可见输出 MUST 由 timeline event stream 驱动

#### Scenario: delayed fallback repair
- **WHEN** 会话仍处于 running 状态且事件流报告确认 gap 或当前 turn 在等待窗口内没有任何可见输出
- **THEN** 页面 MAY 为当前 HistoryStamp 和目标 turn 发起一次 bounded latest-page repair
- **AND** repair MUST 遵守 watermark、权威窗口和 live overlay 合并规则
- **AND** MUST NOT 降级为完整 `readThread` polling

### Requirement: Reasoning display is consistent across live and historical paths
Web timeline SHALL 在 normalized 状态中保留 app-server 已公开发送的 reasoning summary、content 和 delta，并在 live、completion、raw response 与 bounded page 之间按强 identity 收敛；展示层 MUST 与 Codex App/VS Code 一致，不渲染完成态 reasoning card。turn 运行且当前没有后续可见 activity 或 agent 输出时，页面 MAY 显示一个不可展开的临时 `Thinking...` 占位；同一 turn MUST 最多出现一个该占位。刷新、完成或重连后 MUST NOT 把历史 reasoning 恢复为多条 `Thinking` 行。

#### Scenario: Live reasoning survives completion in normalized state
- **WHEN** reasoning delta 已通过 event stream 进入 normalized timeline
- **AND** 后续收到相同强 identity 的 reasoning item completion
- **THEN** 系统 MUST 用完成项更新同一 logical reasoning entry
- **AND** MUST NOT 因完成项文本为空而清空已保存的 reasoning 文本
- **AND** 展示层 MUST 不渲染完成态 reasoning card

#### Scenario: Historical reasoning remains hidden after reload
- **WHEN** 用户刷新页面或重新进入会话
- **AND** bounded latest/history page 中存在 reasoning summary/content 或 raw response reasoning
- **THEN** normalized timeline MUST 保留 reasoning identity 与正文供恢复合并
- **AND** 前端 MUST NOT 为这些完成项生成历史 `Thinking` 行

#### Scenario: Running reasoning uses one transient placeholder
- **WHEN** 当前 turn 正在运行，最后一个可见阶段只有未完成 reasoning
- **THEN** 页面 MAY 显示一个 `Thinking...` 占位
- **AND** 新 tool、command、diff 或 agent output 到达后该占位 MUST 被活动摘要或正文取代
- **AND** MUST NOT 展示 reasoning summary 正文或累积多个占位

#### Scenario: Similar reasoning identities remain distinct in state
- **WHEN** 同一 turn 的两个 reasoning items 拥有不同稳定 itemId
- **AND** 两条文本相同或互为包含
- **THEN** normalized timeline MUST 保留两个独立 logical entries
- **AND** 展示层隐藏完成态 reasoning 时 MUST NOT 反向修改或合并底层 identity

### Requirement: Reasoning remains stable across live, completion and repair
reasoning 输出 SHALL 在 live delta、reasoning started、item completion、raw response completion 和 snapshot repair 之间使用稳定 logical item identity 合并。完成项文本为空时 MUST NOT 清空已保存的 reasoning 文本；repair 后旧 reasoning delta MUST NOT 重复追加。缺少正文但携带有效 `contentRef` 的 reasoning 仍是可恢复的 logical item，turn finalize MUST NOT 从 normalized 状态删除；展示层 MAY 按完成态 reasoning 隐藏规则不为其生成 render block。

#### Scenario: Empty reasoning completion preserves live text
- **WHEN** reasoning delta 已显示文本
- **AND** 后续 completion item 的 reasoning 文本为空
- **THEN** timeline MUST 保留已显示 reasoning 文本
- **AND** normalized entry MAY 标记为完成，且展示层 MUST 隐藏该完成项

#### Scenario: Historical repair keeps reasoning once
- **WHEN** snapshot repair 返回已完成 reasoning item
- **AND** 旧 generation 的 reasoning delta 后到
- **THEN** 前端 MUST 忽略旧 delta
- **AND** normalized timeline MUST 只保留一个对应 logical reasoning entry

#### Scenario: Empty truncated reasoning remains expandable
- **WHEN** reasoning item 的 inline 文本为空但 completeness 为 truncated 且携带有效 contentRef
- **AND** turn 随后完成或 snapshot repair 到达
- **THEN** normalized timeline MUST 保留 reasoning identity、contentRef 与未完整状态
- **AND** 完成态展示隐藏不得删除该 continuation

### Requirement: Tool output remains stable across live, completion and repair
命令、MCP、dynamic tool、file output 等工具输出 SHALL 在 delta、completion item 和 snapshot repair 之间按稳定 item identity 合并。completion item 没有聚合输出时 MUST NOT 清空已流式显示的输出；snapshot 已覆盖的工具输出 delta MUST NOT 重复追加。

#### Scenario: Empty tool completion preserves streamed output
- **WHEN** command/tool output delta 已显示输出
- **AND** 后续 completion item 没有聚合输出
- **THEN** timeline MUST 保留已显示输出
- **AND** 工具卡片状态 MUST 根据 completion 更新为 success 或 failed

#### Scenario: Replayed tool output is not duplicated
- **WHEN** snapshot repair 已包含工具输出 `one\ntwo\n`
- **AND** 补发 delta 再次包含 `two\n`
- **THEN** timeline MUST NOT 把输出变成 `one\ntwo\ntwo\n`

### Requirement: Completed items update in place
agent message、reasoning、tool 和 diff 的完成项 SHALL 更新对应 live entry 的内容和状态，不得因为 completion 到达较晚而追加到 timeline 错误位置。

#### Scenario: Agent completion updates live entry
- **WHEN** agent message delta 已创建 live entry
- **AND** 后续收到同 item id 的 completed agent message
- **THEN** 前端 MUST 原位更新该 entry
- **AND** entry 的 turn metadata MUST 保留

### Requirement: Reasoning and tool output survive snapshot races
agent reasoning、tool output 和 agent message 在 live stream、snapshot repair、historical reload 之间 SHALL 保持稳定。旧 snapshot 或误触发 repair MUST NOT 删除已经显示且属于当前历史的 reasoning/tool 输出；补发 delta 也 MUST NOT 造成重复显示。

#### Scenario: Historical reasoning is present before stale snapshot returns
- **WHEN** 页面已从 cache 或 live event 显示当前历史中的 reasoning entry
- **AND** 一个旧的 initial snapshot 随后返回且不包含该 reasoning entry
- **THEN** 客户端 MUST NOT 用该旧 snapshot 删除当前历史中的 reasoning entry
- **AND** historical reload 或后续 repair MUST 仍能显示该 reasoning 内容

#### Scenario: Tool output replay after repair
- **WHEN** snapshot repair 已包含某 tool output 的完整文本
- **AND** SSE replay 又补发该 tool output 的旧 delta
- **THEN** 客户端 MUST 忽略 snapshot 已覆盖的旧 delta
- **AND** MUST 保留后续真正的新 tail delta

### Requirement: Agent output idempotency does not suppress new history
agent message、reasoning 和 tool output 的重复抑制 SHALL 区分当前历史 generation。客户端 MUST 保留同一 generation 内 snapshot replay 和 duplicate event 的幂等保护，但 MUST NOT 让 rollback/fork 前旧历史的 revision、event ordering 或 snapshot suppression 状态删除新历史中的合法输出。

#### Scenario: Reasoning item id reused in new generation
- **WHEN** rewind 或 fork rollback 后新 turn 产生与旧历史相同 `itemId` 的 reasoning output
- **AND** 新 output 的 revision 小于或等于旧历史记录的 revision
- **THEN** timeline MUST 显示新 reasoning output
- **AND** MUST NOT 因旧历史 revision 将其判断为 stale

#### Scenario: Tool output after snapshot generation changes
- **WHEN** snapshot repair 已覆盖旧 generation 中某 tool output
- **AND** 新 generation 中同 item id 的 tool output delta 到达
- **THEN** 客户端 MUST 保留该新 tool delta
- **AND** MUST NOT 用旧 snapshot suppression 把它当作 replay 丢弃

#### Scenario: Agent message replay in same generation
- **WHEN** 同一 generation 内 snapshot 已包含某 agent message 的完整文本
- **AND** SSE replay 补发该 snapshot 已覆盖的旧 delta
- **THEN** 客户端 MUST 继续忽略该旧 delta
- **AND** MUST NOT 产生重复输出

### Requirement: Agent output cards are deduplicated within a turn
agent message、reasoning logical entry 和 tool activity SHALL 在同一 turn 内按稳定 logical item identity 去重。来自 live、completed、snapshot、overlay 或 supplement 的记录只有在拥有相同强 identity，或携带可唯一证明同一 logical item 的显式 alias/source slot 时才能合并。系统 MUST NOT 仅依据文本相同、文本包含、工具 metadata、文件路径或数组位置建立 identity；不同稳定 itemId 的输出即使内容等价也 MUST 保留为独立 normalized entry。完成态 reasoning 的展示隐藏规则不等同于数据去重。

#### Scenario: Duplicate reasoning sources share one identity
- **WHEN** 同一 turn 的 reasoning 通过 live delta 和 completed item 到达
- **AND** 两条记录拥有相同 generation、turnId 和 itemId
- **THEN** normalized timeline MUST 只保留一个 reasoning logical entry
- **AND** 该 entry MUST 使用更完整的文本和完成状态，展示层不渲染完成态 card

#### Scenario: Similar reasoning items remain distinct
- **WHEN** 同一 turn 包含两个不同稳定 itemId 的 reasoning entries
- **AND** 两条 entries 的文本相同或一条文本包含另一条
- **THEN** normalized timeline MUST 保留两个独立 reasoning entries
- **AND** MUST NOT 让后一条占用前一条的事件位置

#### Scenario: Identical agent reply in different turns
- **WHEN** 两个不同 turn 都回复 `1 + 1 = 2`
- **THEN** timeline MUST 保留两条 agent message
- **AND** MUST NOT 因文本相同跨 turn 去重

#### Scenario: Tool output duplicate in same logical item
- **WHEN** 同一 tool call 的 output 通过 live overlay 和 snapshot 同时出现
- **AND** 两个来源拥有相同强 identity 或显式唯一 alias
- **THEN** timeline MUST 只显示一张 tool card
- **AND** card MUST 原位使用更完整状态与输出

#### Scenario: Repeated identical tool executions remain visible
- **WHEN** 同一 turn 合法执行两次 metadata 和 output 都相同的 tool call
- **AND** 两次执行拥有不同稳定 itemId
- **THEN** timeline MUST 保留两个 tool activities
- **AND** supplement 去重 MUST 对候选执行一对一消费

### Requirement: 昂贵输出渲染按可见性和展开状态延迟
Agent 输出中需要大量主线程工作的内容 SHALL 按可见性和用户展开状态延迟渲染。昂贵内容包括 Markdown 代码高亮、Mermaid、长 diff 行、长命令输出、长工具结果和长 reasoning 文本。

#### Scenario: 离屏代码块不立即高亮
- **WHEN** 历史 agent 消息包含 fenced code block
- **AND** 该消息不在 timeline 可见窗口内
- **THEN** 系统 MUST NOT 同步执行代码高亮
- **AND** 该消息进入可见窗口后 MUST 能渲染主题一致的代码块

#### Scenario: Mermaid 按需渲染
- **WHEN** agent 消息包含 Mermaid 代码块
- **AND** 用户尚未滚动到该消息或该消息尚未进入渲染窗口
- **THEN** 系统 MUST NOT 立即加载 Mermaid 并生成 SVG
- **AND** 该块进入可见窗口后 MUST 渲染为 Mermaid 图或显示可读错误

#### Scenario: 折叠卡片不构造完整长内容 DOM
- **WHEN** 命令、工具、reasoning 或 diff 卡片处于折叠状态
- **THEN** 系统 MUST 只渲染标题、摘要和必要状态
- **AND** MUST NOT 为折叠内容同步构造完整长文本或 diff rows DOM

### Requirement: 长输出默认有界展示
命令输出、工具结果、reasoning 文本、diff、inline activity 展开详情和超长 agent 消息 SHALL 在默认展示状态下限制 DOM 文本量或行数。系统 MUST 保留查看完整内容的路径，但默认状态和普通展开态 MUST 避免把完整大文本直接挂载到主 timeline。

#### Scenario: 命令输出超过展示上限
- **WHEN** 命令输出超过默认展示上限
- **THEN** 折叠态 MUST 只显示命令摘要和状态
- **AND** 展开态 MUST 在内部滚动区域展示有限预览
- **AND** 用户 MUST 能通过明确操作查看或复制完整输出

#### Scenario: 工具结果超过展示上限
- **WHEN** MCP、dynamic、web 或 file 工具结果文本很长
- **THEN** 默认卡片 MUST 显示工具身份和摘要
- **AND** MUST NOT 将完整结果直接推入首屏 DOM

#### Scenario: Diff 超过展示上限
- **WHEN** diff 行数超过默认展示上限
- **THEN** 折叠态 MUST 只显示文件路径和增删统计
- **AND** 展开态 MUST 使用内部滚动或分段渲染显示 diff 预览
- **AND** 用户 MUST 能访问完整 diff 文本

#### Scenario: Inline activity 展开长文本
- **WHEN** 用户展开包含长参数、stdout、stderr、result、raw response 或 fallback 文本的 inline activity
- **THEN** 展开区域 MUST 使用有界预览、内部滚动或分段渲染
- **AND** MUST NOT 直接在主 timeline 中挂载完整长文本 `<pre>`

### Requirement: Agent Markdown 分阶段完成
Agent Markdown SHALL 分阶段渲染：离屏历史先以纯文本或轻量结构展示，进入可见窗口后再解析 Markdown；代码高亮和 Mermaid 在 Markdown 基础上可继续延迟到对应 block 可见或用户展开。流式 live agent 消息 SHALL 渐进渲染已稳定完成的块，未完成尾巴保持轻量文本；系统 MUST NOT 对每个 delta 重新执行完整 Markdown 解析或代码高亮。

#### Scenario: Streaming agent text
- **WHEN** agent message 正在持续收到 `agent_message_delta`
- **THEN** 当前 live 消息的未完成尾巴 MUST 使用轻量文本渲染路径
- **AND** 已稳定完成的段落或闭合代码块 MAY 使用 Markdown 渲染
- **AND** MUST NOT 对每个 delta 重新执行完整 Markdown 解析或代码高亮

#### Scenario: Idle visible message
- **WHEN** agent message 已完成且进入可见窗口
- **THEN** 系统 MUST 在空闲时调度 Markdown 渲染
- **AND** 渲染完成后 MUST 保持复制代码、表格、列表和链接等既有能力

#### Scenario: Incomplete fenced code stays plain while streaming
- **WHEN** live agent 消息包含尚未闭合的 fenced code block
- **THEN** 该未闭合代码块 MUST 保留在轻量文本尾巴中
- **AND** MUST NOT 提前渲染为可复制代码块控件
### Requirement: 完整内容访问不依赖首屏 DOM
长输出的完整内容 SHALL 可通过用户明确操作访问，例如展开更多、复制完整内容、打开详情视图或按需加载完整文本。系统 MUST NOT 把“默认截断”解释为数据丢失。

#### Scenario: 用户请求完整命令输出
- **WHEN** 用户在命令卡片上选择查看完整输出
- **THEN** 系统 MUST 展示或提供完整命令输出
- **AND** 若完整输出需要额外读取，加载失败时 MUST 显示内嵌错误状态

#### Scenario: 用户复制完整 agent 代码块
- **WHEN** 用户点击已渲染代码块的复制按钮
- **THEN** 系统 MUST 复制该代码块完整原文
- **AND** MUST NOT 只复制默认预览截断内容

#### Scenario: 用户查看完整 diff
- **WHEN** diff 默认预览被截断
- **AND** 用户请求查看完整 diff
- **THEN** 系统 MUST 提供完整 diff 的可读路径
- **AND** MUST 保持移动端页面主 timeline 不被完整 diff DOM 卡死

### Requirement: Timeline 活动按 turn 聚合为可展开摘要
移动端 timeline SHALL 将同一 turn 内连续的 Thinking、工具调用、shell/bash、read/list/search、文件变更和验证类输出聚合为轻量 activity block。activity block SHALL 默认只展示摘要行，并允许用户先展开 activity block 查看动作列表，再展开单条动作查看原始活动详情。

#### Scenario: 默认显示活动摘要
- **WHEN** 一个 turn 内产生多个 reasoning、tool、command 或 diff entry
- **THEN** timeline MUST 默认显示一个或多个 activity block 摘要
- **AND** 摘要 MUST 不把每个底层 entry 都以同等重量的独立卡片铺满首屏
- **AND** 摘要 MUST 不默认显示底层动作列表

#### Scenario: 展开后保留原始详情
- **WHEN** 用户展开 activity block 并继续展开其中某条动作
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

### Requirement: 移动端活动以内联日志穿插展示
移动端 timeline SHALL 将 agent 运行中的工具、读取、搜索、命令、Skill/工具加载、文件变更和公开 reasoning 等活动渲染为 Codex App 风格的内联活动日志。内联活动日志 SHALL 作为消息流的一部分穿插在 assistant 消息之间，默认只显示具体活动标题摘要；展开 activity block 后显示动作列表，展开单条动作后显示完整详情。内联活动日志 MUST NOT 显示统一的 `Activity` 标题、厚卡片边框、强调色左边框或独立卡片容器。snapshot、pagination、overlay 或 JSONL repair 补齐活动但缺少可靠文本锚点时，系统 MUST 使用同 turn 的安全语义插入点，至少将活动放在 user message 之后、最终 assistant 回复之前，且该顺序 MUST 在 store normalize、刷新、历史分页和 overlay 合并后保持稳定。系统 MUST NOT 因找不到锚点就统一追加到 turn 末尾。

#### Scenario: 活动不显示 Activity 卡片
- **WHEN** 一个 turn 产生 tool、command、diff、reasoning 或 runtime loading 活动
- **THEN** timeline MUST 渲染具体活动标题摘要
- **AND** timeline MUST NOT 显示 `Activity` 作为用户可见标题
- **AND** 活动 MUST NOT 使用厚卡片、蓝色左侧强调条或独立卡片容器

#### Scenario: 活动按真实顺序穿插
- **WHEN** 同一 turn 内真实顺序为 assistant 消息、工具活动、assistant 消息、文件变更、assistant 消息
- **THEN** timeline MUST 按该原始顺序渲染为 assistant 消息、内联活动日志、assistant 消息、内联活动日志、assistant 消息
- **AND** 系统 MUST NOT 将该 turn 的所有活动集中堆到用户消息下方或所有 assistant 文本之前

#### Scenario: Repair fallback keeps activity before final assistant
- **WHEN** snapshot/JSONL repair 为同一 turn 补齐 tool、command、read、search、runtime loading 或 Thinking 活动
- **AND** repair 过程无法找到匹配的 assistant 文本锚点
- **AND** 该 turn 已有 user message 和最终 assistant message
- **THEN** 补齐活动 MUST 渲染在该 turn 的 user message 之后、最终 assistant message 之前
- **AND** 系统 MUST NOT 仅因为缺少锚点就把这些活动追加到最终 assistant message 之后
- **AND** 该顺序 MUST 在 store 根据 `createdAt` 归一化后保持不变

#### Scenario: Snapshot load keeps repaired order stable
- **WHEN** 首屏读取、startTurn 返回 thread、rewind 或 fork 得到的 snapshot 中同一 turn 为 user message、最终 assistant message、补齐 activity
- **THEN** timeline MUST 将补齐 activity 渲染在 user message 之后、最终 assistant message 之前
- **AND** 后续 store replace 或 merge MUST NOT 把 activity 再排回最终 assistant message 之后

#### Scenario: Paginated history preserves activity before final assistant
- **WHEN** 历史分页返回同一 turn 的 user message、activity、最终 assistant message
- **THEN** prepend 到 timeline 后 MUST 保持 user message、activity、最终 assistant message 的顺序
- **AND** fallback timestamp MUST NOT 导致 activity 被排序到最终 assistant message 之后

#### Scenario: Overlay fallback inserts activity inside owning turn
- **WHEN** app-server overlay 提供一个有 `turnId` 的 activity
- **AND** 当前 snapshot 中同一 turn 已有 user message 和最终 assistant message
- **AND** overlay item 无法匹配到已有 snapshot item
- **THEN** overlay activity MUST 插入到该 turn 的 user message 之后、最终 assistant message 之前
- **AND** 系统 MUST NOT 把该 overlay activity 追加到整个 timeline 末尾

#### Scenario: 只合并连续活动
- **WHEN** 多个 activity entries 在同一 turn 中连续出现
- **THEN** timeline MAY 将这些连续 entry 派生为同一个内联活动日志组
- **AND** 合并 MUST 在遇到 assistant、user、system 或 error entry 时停止

### Requirement: 内联活动标题使用具体动作摘要
内联活动日志 SHALL 使用具体动作摘要作为标题，例如 `Loaded 4 tools`、`已读取 2 个文件已运行 1 条命令`、`Files changed · 3 · +42 -18`、`Thinking...` 或 `Thinking`。标题 MUST 表达发生了什么，MUST NOT 使用泛化的 `Activity`、`Used activity` 或类似无语义标签。

#### Scenario: Loaded tools 标题
- **WHEN** 活动组只包含 runtime Skill、tool instruction 或工具加载类活动
- **THEN** 标题 MUST 显示 `Loaded N tools` 或等价的具体加载摘要
- **AND** 展开 activity block 后 MUST 显示每个已知 Skill 或工具名称

#### Scenario: 文件读取和命令组合标题
- **WHEN** 活动组包含 read/search/list/command 等执行动作
- **THEN** 标题 MUST 汇总每类动作的数量
- **AND** 标题 MUST 能表达读取、搜索、浏览目录或运行命令中实际发生的动作

#### Scenario: 文件变更标题
- **WHEN** 活动组包含文件变更或 diff
- **THEN** 标题 MUST 显示被修改文件数量和总增删行数
- **AND** 标题 MUST 不要求用户展开才能知道有文件被改动

### Requirement: 内联活动支持两级展开详情
除 Thinking、文件变更和失败详情等有单层详情要求的 activity 外，内联活动日志 SHALL 使用两级展开结构：activity block 默认只显示摘要行；用户展开 activity block 后 MUST 显示该组内的动作列表；用户展开单条动作后 MUST 显示该动作的完整可用详情。

#### Scenario: 默认只显示摘要行
- **WHEN** 一个 activity block 包含多条 read、search、list、command 或通用 tool 活动
- **THEN** timeline MUST 默认只显示该 block 的摘要行
- **AND** timeline MUST NOT 默认显示每条底层动作的短明细列表

#### Scenario: 展开 activity block 显示动作列表
- **WHEN** 用户展开适用两级结构的 activity block
- **THEN** timeline MUST 显示该 block 内每条动作的短标题列表
- **AND** 每条动作 MUST 保留独立的展开入口
- **AND** 动作列表 MUST 使用短路径、搜索目标、短命令名或工具名称，避免默认显示长参数和完整输出

#### Scenario: 展开单条动作显示详情
- **WHEN** 用户展开适用两级结构的 activity block 中的一条动作
- **THEN** timeline MUST 显示该动作的完整可用详情
- **AND** 详情 MUST 包含原始命令、工具名、参数、输出、路径、diff 或错误信息中可用的内容
- **AND** 其他未展开动作 MUST 继续只显示短标题

### Requirement: Thinking details render in one layer
移动端 timeline 中的 Thinking 活动 SHALL 保留内联活动日志摘要，但展开后 MUST 直接显示公开 reasoning 内容。系统 MUST NOT 在展开区域再次显示一个需要点击的 Thinking 子行。

#### Scenario: Completed thinking expands directly
- **WHEN** timeline 渲染已完成且包含公开文本的 Thinking 活动
- **AND** 用户展开 Thinking 摘要
- **THEN** 展开区域 MUST 直接显示公开 reasoning 文本
- **AND** MUST NOT 再显示第二个 `Thinking` 展开按钮

#### Scenario: Running thinking expands directly
- **WHEN** timeline 渲染运行中且已有公开文本的 Thinking 活动
- **AND** 用户展开 `Thinking...` 摘要
- **THEN** 展开区域 MUST 直接显示当前已到达的公开 reasoning 文本
- **AND** 摘要仍 MUST 表达运行中状态

### Requirement: File change details render in one layer
移动端 timeline 中的文件变更活动 SHALL 保留文件变更汇总摘要，但展开后 MUST 直接显示每个文件的 diff 或文件输出详情。系统 MUST NOT 要求用户先展开文件变更汇总、再展开单个文件行，才能看到 diff 内容。

#### Scenario: Single file change expands directly
- **WHEN** timeline 渲染单个文件变更
- **AND** 用户展开文件变更摘要
- **THEN** 展开区域 MUST 直接显示该文件路径、增删行数和 diff 内容
- **AND** MUST NOT 再显示一个需要点击的文件子行

#### Scenario: Multiple file changes expand as file blocks
- **WHEN** timeline 渲染多个连续文件变更
- **AND** 用户展开文件变更摘要
- **THEN** 展开区域 MUST 按文件显示每个文件的路径、增删行数和 diff 或文件输出
- **AND** 每个文件详情 MUST 在同一展开区域内可读

### Requirement: Timeline file activities use diff view
移动端 timeline 中的文件变更 activity 展开后 SHALL 使用结构化 diff view 展示变更内容。diff view MUST 显示文件路径、增删统计、hunk、行号和新增/删除染色，并 MUST 保留复制完整 diff 的路径。系统 MUST NOT 在文件变更 activity 展开后只以纯文本 `<pre>` 展示 diff。

#### Scenario: Diff entry expands with structured diff view
- **WHEN** timeline 中 `body.kind` 为 `diff` 的文件变更 activity 被展开
- **THEN** 展开区域 MUST 显示该文件路径和 `+N -N` 统计
- **AND** 展开区域 MUST 以 diff view 显示 hunk、旧行号、新行号以及新增/删除染色
- **AND** 展开区域 MUST 提供复制完整 diff 的操作

#### Scenario: File tool activity expands with structured diff view
- **WHEN** timeline 中 `toolKind` 为 `file` 的 activity 包含 diff、patch 或文件输出文本
- **AND** 用户展开 `Files changed` 摘要
- **THEN** 展开区域 MUST 使用 diff view 或等价可读 diff fallback 展示该文本
- **AND** 用户 MUST 不需要再展开文件子行才能看到变更内容

#### Scenario: Multiple file activities stay one-layer
- **WHEN** 一个 activity section 中包含多个文件变更 entry
- **AND** 用户展开 `Files changed` 摘要
- **THEN** 展开区域 MUST 按 entry 顺序直接显示每个文件的路径、统计和 diff view
- **AND** MUST NOT 为每个文件再渲染需要点击的第二层展开按钮

#### Scenario: Long diff remains bounded
- **WHEN** 文件变更 diff 超过默认展示上限
- **THEN** 展开态 MUST 只渲染有界预览
- **AND** 用户 MUST 能复制完整 diff 文本
- **AND** 折叠态 MUST NOT 构造完整 diff rows DOM

### Requirement: Activity failure status is localized and visible
移动端内联活动日志 SHALL 使用中文展示失败状态。失败活动展开后 MUST 优先显示可用于定位问题的命令、参数、stderr、result 或 output 文本，不应把错误详情隐藏在第三层交互之后。

#### Scenario: Failed activity summary
- **WHEN** 内联活动 section 中存在失败的 command 或 tool entry
- **THEN** 摘要行 MUST 显示中文失败状态
- **AND** MUST NOT 显示英文 `Failed`

#### Scenario: Failed activity details
- **WHEN** 用户展开包含失败 entry 的活动摘要
- **THEN** 展开区域 MUST 显示失败 entry 的命令或工具身份
- **AND** 展开区域 MUST 显示可用的错误输出、result、output 或参数文本
- **AND** 用户 MUST NOT 需要再展开第三层才能看到错误详情

### Requirement: 等价 agent 输出只能渲染一次
agent 输出渲染层 SHALL 以 timeline engine 提供的 normalized entry 为唯一渲染输入。来自 live delta、completed item、snapshot item、overlay 和 rollout supplement 的同一 logical agent/reasoning/tool/diff 输出 MUST 合并为同一个可见条目，MUST NOT 因来源不同、文本格式不同或完成态不同而重复渲染。logical equivalence MUST 由强 identity 或显式唯一 alias 建立；渲染层和 adapter MUST NOT 用内容相似度合并不同稳定 identity。

#### Scenario: Live 与 completed agent message 合并
- **WHEN** 同一 generation、turnId 和 itemId 的 agent message 先通过 live delta 显示
- **AND** 后续 snapshot 或 completed item 返回完整文本
- **THEN** 渲染层 MUST 原位更新同一条 agent message
- **AND** timeline MUST NOT 同时显示 live 版本和 completed 版本

#### Scenario: Tool output 多来源补齐
- **WHEN** 同一 tool call 的输出同时来自 command delta、turn item detail 和 rollout supplement
- **AND** 来源携带相同强 identity 或可唯一验证的 alias
- **THEN** 渲染层 MUST 只显示一个 tool activity
- **AND** 该 activity MUST 保留最完整的状态、输出和元数据

#### Scenario: Snapshot refresh 不重复旧输出
- **WHEN** 用户刷新页面或 snapshot repair 返回已通过 event stream 显示过的 agent/reasoning/tool/diff 输出
- **THEN** 渲染结果 MUST 保持每个稳定身份只出现一次
- **AND** 已展开或折叠状态 MAY 保留，但重复条目 MUST NOT 出现

#### Scenario: Similar messages with different identities are not equivalent
- **WHEN** 同一 turn 的两个 agent messages 拥有不同稳定 itemId
- **AND** 一条文本与另一条相同或为其前缀
- **THEN** timeline MUST 渲染两条独立消息
- **AND** MUST NOT 使用文本 fallback 将它们归一化为同一 entry

### Requirement: 压缩上下文消息只能出现一次
上下文压缩、compact、summary 或类似系统消息 SHALL 使用包含 HistoryStamp、turnId 和稳定 compact operation identity 的强 identity 在 timeline 中归一化。若同一 logical compact message 同时来自 live event、snapshot、overlay 或 rollout supplement，系统 MUST 只渲染一次；supplement 只有携带相同强 identity 或显式唯一 alias 时才能合并，文本/摘要等价不能单独建立 compact identity。

#### Scenario: Live compact 后 snapshot 返回同一消息
- **WHEN** timeline 已显示一次上下文压缩消息
- **AND** 后续 snapshot 或 repair 返回同一 HistoryStamp、turn 和 operation identity 的 compact item
- **THEN** timeline MUST 原位确认或补全该消息
- **AND** MUST NOT 再追加第二条压缩消息

#### Scenario: Rollout supplement 重放压缩 activity
- **WHEN** rollout supplement 在当前窗口内发现携带相同强 identity 或唯一 alias 的 compact activity
- **THEN** supplement MUST 合并到同一 normalized entry
- **AND** 渲染层 MUST NOT 把它作为新的独立 system/activity 行显示

#### Scenario: Similar compact summaries from distinct operations remain visible
- **WHEN** 同一 turn 或不同 generation 存在两个不同 compact operation identities
- **AND** 二者 summary 文本相同
- **THEN** timeline MUST 按各自 identity 保留合法 entries
- **AND** MUST NOT 仅按 summary 文本去重

### Requirement: Inline activity 分组必须保持服务端 item 顺序
内联 activity 日志 SHALL 按 timeline engine 的 orderKey 派生。同一 turn 内连续 reasoning、tool、command、runtime loading 和 diff MUST 合并为一个顶层 disclosure，完成态 reasoning 不进入可见摘要；disclosure 默认折叠，用户点击后才显示明细。展开内容 MUST 保留服务端 item order、event sequence 或等价 source order，MUST NOT 为了按类型聚合而改变同一 turn 内真实顺序。repair 使用 before/after anchor 时，anchor MUST 按完整 history generation、turn 和 item identity 解析并优先于 source-local ordinal；不同来源的 ordinal MUST NOT 撤销已确认的 anchor 位置。

#### Scenario: Reasoning 与 tool 交错
- **WHEN** 同一 turn 内服务端顺序为 reasoning、tool、agent delta、tool、agent delta
- **THEN** completed reasoning MUST 不生成独立 `Thinking` 行，每段连续 activity MUST 只生成一个折叠摘要
- **AND** 展开摘要后两个 tool 与两段 agent 文本的相对位置 MUST 与服务端一致

#### Scenario: 多个文件 diff 与命令活动
- **WHEN** 同一 turn 内先执行命令再产生文件 diff
- **THEN** inline activity 分组 MUST 保留命令在 diff 之前的顺序
- **AND** 多文件 diff MAY 汇总，但不能越过更早的可见活动

#### Scenario: Dense tool activity remains one compact row
- **WHEN** 同一连续 activity 段包含多个 command、read、Skill、Subagent、file 和 MCP tool entries
- **THEN** 折叠态 MUST 只占一个顶层 activity 行，并使用自然动作句概括主要活动
- **AND** 顶层 MUST 显示一个与主要动作类别对应的紧凑 Lucide 语义图标；多类别混合时使用通用工具图标
- **AND** 顶层 MUST NOT 显示无意义装饰方块或“N 个文件”式生硬统计串
- **AND** 用户第一次展开后 MUST 按原顺序看到全部动作行，默认页面 MUST NOT 被每个分类各占一行

#### Scenario: Activity details require a second explicit expansion
- **WHEN** 用户第一次展开包含 read、file edit、command 和 failed tool 的 activity 段
- **THEN** 页面 MUST 只显示“已读取具体路径”“已编辑具体路径 +A -R”“已运行具体命令”等动作行
- **AND** stdout、diff、参数与错误正文 MUST 保持隐藏
- **AND** 用户再次点击某一动作行后，页面 MUST 只展开该动作的具体内容

#### Scenario: Repair anchor overrides source-local ordinal
- **WHEN** repair item 的 before/after anchor 将其定位在同 turn 两条 agent messages 之间
- **AND** repair source 的局部 ordinal 数值会把它排到两条消息之后
- **THEN** timeline MUST 保留 anchor 指定的位置
- **AND** MUST NOT 使用裸 itemId 命中另一 turn 或 generation 的 anchor

### Requirement: 长输出渲染预算必须保持有界
agent 输出渲染层 SHALL 在大会话和高频 delta 下保持有界 DOM 与 Markdown 工作量。长 Markdown、reasoning、命令输出、tool result、diff、inline activity 展开详情和 raw response fallback MUST 继续按可见窗口、折叠状态、展开状态或空闲时机懒渲染，MUST NOT 因 normalized entries 或 activity 展开引入全量挂载。

#### Scenario: 大会话滚动
- **WHEN** 会话包含大量历史 turns 和长工具输出
- **THEN** timeline MUST 只挂载可见窗口和必要 buffer 内的 rows
- **AND** 窗口外长 Markdown、diff 和 tool result MUST NOT 全量渲染到 DOM

#### Scenario: 高频 agent delta
- **WHEN** 当前 agent message 高频追加文本
- **THEN** 渲染层 MUST 只更新当前可见且受影响的输出区域
- **AND** MUST NOT 因每个 delta 重新计算或重新挂载整个历史 timeline

#### Scenario: Activity 展开不破坏预算
- **WHEN** 用户展开一个包含超长文本的 inline activity
- **THEN** timeline MUST 只挂载该 activity 的有限预览或可滚动片段
- **AND** 其他 timeline rows MUST NOT 因该展开操作重建完整长输出 DOM

### Requirement: Output derivations are cached by stable entry identity
agent 输出渲染层 SHALL 对长 Markdown、diff rows、command output preview、tool result preview、reasoning preview 和 inline activity detail preview 使用稳定 entry identity、entry 引用和内容版本的派生缓存或等价机制。系统 MUST 不在每个 unrelated timeline update 或每个 delta commit 中重新 split、parse 或格式化未变化的大文本；父 timeline 更新时，未变化 row MUST 能跳过重新渲染。

#### Scenario: Unrelated delta does not reparse long diff
- **WHEN** timeline 中存在已展开或可见的长 diff
- **AND** 另一个 agent message 收到 live delta
- **THEN** 长 diff 的 rows 派生 MUST 复用缓存或保持不变
- **AND** MUST 不因 unrelated delta 重新解析完整 diff 文本

#### Scenario: Tool output preview changes only when output changes
- **WHEN** tool result 文本未变化
- **AND** timeline 状态因 running、approval、context usage 或其他 entry 更新而重渲染
- **THEN** tool result preview MUST 不重新处理完整文本
- **AND** 复制完整内容路径 MUST 仍使用原始完整文本

#### Scenario: Markdown cache respects entry revision
- **WHEN** agent message 的 `entry.id`、generation、revision 或文本内容发生变化
- **THEN** Markdown/preview cache MUST 对该 entry 失效并重新派生
- **AND** 其他 entry 的 Markdown 派生 MUST 保持可复用

#### Scenario: Unchanged row skips render
- **WHEN** timeline entries 数组因另一个 entry 的 live delta 产生新引用
- **AND** 某个可见 row 的 entry 引用、live 状态、action 状态和回调语义均未变化
- **THEN** 该 row MUST 跳过 React render 或执行等价的零昂贵派生更新
- **AND** 其 Markdown、diff、preview 和 activity detail MUST 不重新计算

### Requirement: Heavy rendering follows the recycled viewport
agent 输出中的 Markdown、代码高亮、Mermaid、diff rows、长 command output、tool result、reasoning detail 和 inline activity detail SHALL 只在当前 recycled viewport 或用户展开的有界区域内执行重渲染。窗口外 rows MUST 不构造 Markdown AST、highlight DOM、diff row DOM 或长 `<pre>` 预览。

#### Scenario: Recycled row releases heavy output DOM
- **WHEN** 用户滚动导致某条历史 agent message 离开 viewport buffer
- **THEN** 该 row 的 Markdown、代码高亮、diff 或长文本 DOM MUST 被卸载或替换为轻量 spacer
- **AND** DOM 中 MUST 不继续保留该 row 的完整历史输出

#### Scenario: Re-entering row restores output lazily
- **WHEN** 用户滚回之前被回收的历史 row
- **THEN** 系统 MUST 先恢复可读的轻量文本或摘要
- **AND** Markdown、diff rows 或长文本详情 MUST 在可见且调度条件满足后恢复

#### Scenario: Expanded activity remains bounded
- **WHEN** 用户展开包含长参数、stdout、stderr、result、raw response 或 fallback 文本的 inline activity
- **THEN** 展开区域 MUST 只渲染有界预览、分段内容或内部滚动片段
- **AND** 其他 viewport rows MUST 不因此重建完整长输出 DOM

### Requirement: Live output stays lightweight until stable
流式 agent、reasoning、tool 或 command 输出 SHALL 在 live 阶段使用轻量文本渲染和批处理后的最小更新。系统 MUST 不对每个 live delta 同步执行完整 Markdown 解析、代码高亮、diff parsing、activity summary 全量重建或长文本 preview 全量重算；同一 item 的短窗口 delta MUST 只使其所属 row 或 activity block 失效。

#### Scenario: Agent live delta renders as plain text
- **WHEN** active turn 的 agent message 高频追加 delta
- **THEN** live 区域 MUST 以纯文本或等价轻量结构显示最新内容
- **AND** 完整 Markdown MUST 等输出稳定、row 可见且浏览器调度条件满足后再执行

#### Scenario: Tool live delta avoids full preview rebuild
- **WHEN** running tool output 高频追加 stdout/stderr delta
- **THEN** UI MUST 只更新受影响 tool entry 的轻量尾部显示或有界 preview
- **AND** MUST 不因每段 delta 重新计算整个 timeline 的 activity sections

#### Scenario: Batched delta invalidates one render block
- **WHEN** 同一 item 的多个文本 delta 被合并为一次 store 提交
- **THEN** 渲染层 MUST 只失效包含该 item 的 timeline row 或 inline activity block
- **AND** 其他可见 blocks MUST 保持派生缓存和展开状态

### Requirement: Truncated agent output is visibly incomplete
agent message、tool output、command output 和 diff 的正文不完整时，渲染层 SHALL 显示明确的 truncated/partial 状态和读取完整内容控件。系统 MUST 不以普通 `...` 文本冒充完整正文。inline preview 为空但存在有效 contentRef 时，card/block MUST 仍保持稳定尺寸和可恢复入口，MUST NOT 被当作无内容 entry 隐藏。reasoning 的 completeness/contentRef MUST 保留在 normalized 状态，但完成态 reasoning MAY 按展示规则隐藏。

#### Scenario: Truncated tool preview
- **WHEN** tool output 仅包含 inline preview 和 contentRef
- **THEN** activity detail MUST 显示已省略 bytes/内容状态
- **AND** MUST 提供读取完整内容的明确命令

#### Scenario: Complete content loaded
- **WHEN** 用户读取全部 full-content chunks
- **THEN** 原 card/block MUST 原位显示完整内容
- **AND** 展开状态、复制入口和 timeline 顺序 MUST 保持不变

#### Scenario: Empty preview still exposes continuation
- **WHEN** agent output 的 inline preview 为空但 contentRef 有效
- **THEN** 原 card/block MUST 显示 truncated 或 partial 状态
- **AND** MUST 提供读取完整内容入口且不得在 turn finalize 后消失

### Requirement: Long content loading remains bounded
读取完整内容时 SHALL 分 chunk 更新目标 row/block，MUST 不阻塞完整 timeline 派生或一次挂载所有历史长正文。复制完整内容只有在内容 complete 时直接复制本地全文；partial 状态 MUST 明确提示继续读取或按 chunk 服务端复制策略处理。

#### Scenario: Multiple megabyte tool output
- **WHEN** 用户展开数 MiB tool output
- **THEN** 客户端 MUST 按 chunk 读取并只更新目标 activity block
- **AND** 其他可见 Markdown、diff 和 activity blocks MUST 不重新派生

#### Scenario: Full-content request fails
- **WHEN** contentRef 请求失败或返回 repair-required
- **THEN** card MUST 保留已有 preview
- **AND** MUST 显示明确错误和可重试状态，不得变为空白

### Requirement: Activity summaries classify Skills and Subagents explicitly
展示派生层 SHALL 优先使用结构化 metadata 分类 activity，并兼容当前 app-server 已归一化的 tool 形态。读取完整 `.../skills/<name>/SKILL.md` 定义文件的 read/command SHALL 归类为 Skill；`server: sub-agent` 且 result 可解析出 `agentThreadId`、`agentPath` 或 `kind` 的记录 SHALL 归类为 Subagent。无法满足完整判定条件的记录 MUST 降级为 command 或通用 tool，MUST NOT 仅按任意正文关键词误分类。

#### Scenario: Skill definition read is classified as a loaded Skill
- **WHEN** command/read activity 的目标是完整 `SKILL.md` 定义路径
- **THEN** 折叠摘要 MUST 计入一个 Skill
- **AND** 展开行 MUST 显示从路径解析出的 Skill 名称，而不是普通“读取文件”

#### Scenario: Subagent interactions collapse by agent identity
- **WHEN** 同一 activity 段包含针对相同 `agentThreadId` 的多次 Subagent 交互
- **THEN** 摘要 MUST 按唯一 Subagent 数量计数
- **AND** 展开内容 MUST 使用 `agentPath` 或稳定 fallback label 描述该代理，不得显示为未知通用工具

#### Scenario: Malformed structured result stays generic
- **WHEN** tool result 不是合法 JSON，或没有完整 Skill/Subagent 身份字段
- **THEN** 展示层 MUST 将其保守归类为 command 或通用 tool
- **AND** MUST NOT 抛错、吞掉 activity 或改变底层 entry

### Requirement: User messages hide trusted injected context
Web SHALL 从 app-server user item 中识别 Codex 明确注入的完整包装，并只显示其中的用户数据。已知 ambient/附件包装只有同时满足 `<in-app-browser-context source="ambient-ui-state">...</in-app-browser-context>` 或 `# Files mentioned by the user:` 包装，以及 `## My request for Codex:` 边界时，系统 MAY 提取 request 段；完整 `<codex_internal_context source="goal">...</codex_internal_context>` 包装只有包含唯一完整 `<objective>...</objective>` 时，系统 MAY 提取 objective。图片、普通文件、Skill 引用、`clientUserMessageId`、turn/item identity 和发送状态 MUST 保留。普通 XML、Markdown、代码块、不完整标签和用户主动输入的相似文本 MUST 原样显示。

#### Scenario: Ambient browser context is hidden
- **WHEN** server user text 包含完整 ambient browser context 和 `## My request for Codex:`
- **THEN** user bubble 与复制文本 MUST 只包含 marker 后的真实请求
- **AND** MUST 不显示注入说明、当前 URL 或包装标签

#### Scenario: Attachment metadata wrapper is hidden and attachments remain
- **WHEN** server user text 同时包含 `# Files mentioned by the user:`、request marker 和合法附件行
- **THEN** user bubble MUST 只显示真实请求
- **AND** 图片、Skill 与可恢复的普通文件附件 MUST 继续渲染
- **AND** MUST 不把临时文件路径作为用户正文显示

#### Scenario: Uploaded ordinary file metadata is recovered
- **WHEN** Files-mentioned 包装包含 uploadDir 内符合服务端上传命名规则的普通文件路径
- **THEN** Web MUST 恢复普通文件名称与稳定引用
- **AND** MUST NOT 把普通文件映射为图片或工具 mention

#### Scenario: Untrusted attachment row does not create a file chip
- **WHEN** 包装中的候选普通文件路径不符合受控上传路径规则
- **THEN** Web MUST NOT 为该行创建普通文件附件 chip
- **AND** MUST NOT 暴露该候选路径到可见正文、复制文本或无障碍标签

#### Scenario: Goal continuation displays its objective
- **WHEN** server user text 完整匹配 `source="goal"` 的 internal context，且只包含一个完整 objective
- **THEN** user bubble 与复制文本 MUST 显示 objective 正文
- **AND** MUST 不显示 continuation、budget、fidelity 或 completion audit 等内置提示，也不得渲染为空白 user row

#### Scenario: User-authored objective markup is preserved
- **WHEN** 用户主动输入普通 `<objective>`，或 goal internal context 缺少可信 source、完整外层边界或唯一 objective
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 猜测或提取局部 objective

#### Scenario: User-authored markup is preserved
- **WHEN** 用户正文包含普通 XML/Markdown，或只有相似 marker 但不构成完整已知包装
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 使用宽泛正则删除用户内容
### Requirement: Timeline omits per-entry timestamps
会话 timeline SHALL 不渲染 user、assistant、system 或 activity 的逐条相对时间。`createdAt` MAY 继续用于排序、虚拟列表锚点和诊断，但 MUST NOT 在默认或展开视图占据可见行。

#### Scenario: Messages and activities have real timestamps
- **WHEN** normalized entries 携带有效 `createdAt`
- **THEN** user/assistant 消息与折叠 activity 均 MUST 不显示“刚刚”“N 分钟前”“N 小时前”等时间文本
- **AND** 移除时间不得改变 entry 排序或展开行为

### Requirement: User messages use compact Codex App-style bubbles
会话 user message SHALL 显示为右对齐、内容宽度自适应的浅灰气泡，文字在气泡内保持左对齐。气泡 MUST NOT 占据整行或显示旧的蓝色左边条；长消息、长单词、图片、Skill 引用和失败/重试状态 MUST 保持在同一气泡边界内，并在 390px 手机视口不水平溢出。

#### Scenario: Short user message remains compact
- **WHEN** user message 只有一行短文本
- **THEN** 气泡 MUST 右对齐且只占内容所需宽度
- **AND** MUST 使用浅灰背景、紧凑内边距和圆角，不显示蓝色左边条

#### Scenario: Long user message remains mobile-readable
- **WHEN** user message 包含多行长文本或无空格长字符串
- **THEN** 气泡 MUST 受最大宽度约束并在内部换行
- **AND** timeline MUST 不产生水平页面滚动

### Requirement: Reconnection uses a lightweight activity row
Web SHALL 将 event stream 重连状态显示为低噪声的临时活动行，而不是全宽警告色横幅。该行 MUST 使用 Wi-Fi 语义图标和 `正在重新连接 N/5` 文案；`N` MUST 来自连续失败尝试计数，连接成功或显式关闭后归零。thread 页面 MUST 将该行放在 timeline 末尾并随内容滚动，连接恢复后 MUST 立即移除。

#### Scenario: Reconnection attempts update in place
- **WHEN** event stream 连续发生第一次和第二次连接错误
- **THEN** 同一重连行 MUST 依次显示 `正在重新连接 1/5` 与 `正在重新连接 2/5`
- **AND** MUST 不追加重复行或显示动画省略号

#### Scenario: Successful connection removes the row
- **WHEN** reconnecting event stream 随后触发 open
- **THEN** 重连计数 MUST 归零且 thread timeline MUST 移除临时行
- **AND** 页面 MUST 不保留全宽警告色 banner

### Requirement: Activity stdout and diff details are mobile-readable
二级 activity detail SHALL 使用安静、工作导向的移动端布局。command/stdout MUST 显示截断后的命令头、运行状态、等宽输出、复制入口和有界滚动区域；file diff MUST 显示文件路径、增删统计、old/new 行号、hunk 与 add/remove/context 语义着色。详情 MUST NOT 使用 emoji、无意义装饰图标、嵌套卡片或会撑破 timeline 的固定桌面宽度。

#### Scenario: Command row opens stdout detail
- **WHEN** 用户点击“已运行 npm test”动作行
- **THEN** 页面 MUST 在该行下显示命令状态与 stdout/stderr 预览
- **AND** 长行 MAY 在详情内部横向滚动，但 MUST NOT 让页面产生水平溢出

#### Scenario: File row opens structured diff detail
- **WHEN** 用户点击“已编辑 Timeline.tsx +81 -72”动作行
- **THEN** 页面 MUST 在该行下显示带双行号、hunk 和增删着色的 diff
- **AND** 第一次只展开 activity 总组时 MUST NOT 提前挂载 diff 正文

### Requirement: Context compaction lifecycle is visible while running
Web SHALL 映射 app-server `contextCompaction` item 的开始与完成生命周期。`item/started` 到达后 MUST 立即显示“正在自动压缩上下文”，`item/completed` 到达后 MUST 使用同一稳定 item identity 原位更新为“压缩上下文已完成”。完成态 snapshot、repair 或 rollout item MUST NOT 倒退为运行态，也 MUST NOT 因 live 与 snapshot 来源不同显示重复压缩消息。

#### Scenario: Automatic compaction is visible before completion
- **WHEN** active turn 收到 `item/started` 且 item type 为 `contextCompaction`
- **THEN** timeline MUST 在完成通知前显示“正在自动压缩上下文”
- **AND** 该状态 MUST 不停止 active turn 或触发 snapshot repair

#### Scenario: Compaction completion updates in place
- **WHEN** 同一 context compaction item 随后收到 `item/completed`
- **THEN** 运行文案 MUST 原位更新为“压缩上下文已完成”
- **AND** timeline MUST 只保留一个该 identity 的压缩条目

#### Scenario: Completed history does not regress
- **WHEN** 刷新或 repair 返回已完成的 context compaction item
- **THEN** timeline MUST 直接显示完成文案
- **AND** 较晚到达的旧 started 事件 MUST NOT 将它降级为运行中

### Requirement: Failed image previews degrade without broken-image chrome
会话 user/tool 图片缩略图 SHALL 通过受控 preview URL 加载。加载失败时 Web MUST 隐藏浏览器原生破图图标，显示尺寸稳定的中文失败占位与重试入口；成功加载后 MUST 显示真实图片。失败状态 MUST 不改变 timeline 宽度、消息正文或附件 identity。

#### Scenario: Local preview route fails
- **WHEN** 图片 preview route 返回错误或浏览器触发 image error
- **THEN** 原缩略图位置 MUST 显示紧凑失败占位而不是破图图标
- **AND** 用户 MUST 可以重试加载

### Requirement: Collapsed timelines continue loading older history
会话页面 SHALL 在 timeline 内容高度不足滚动视口、仍存在历史 cursor 且未到会话开头时自动请求上一页。该行为 MUST 与滚到顶部使用同一分页协调入口，并继续遵守 cursor in-flight 去重、HistoryStamp 校验和 prepend anchor 规则。系统 MUST 逐页补充直到内容可滚动、cursor 为空、到达开头或请求失败，MUST NOT 因折叠/展开反复请求同一 cursor。

#### Scenario: Collapsing activity removes all scroll distance
- **WHEN** 用户折叠活动详情后 scroller 的 `scrollHeight` 不大于 `clientHeight`
- **AND** 当前 thread 仍有有效历史 cursor 且 `reachedBeginning` 为 false
- **THEN** Web MUST 无需用户滚动就请求上一页历史
- **AND** 新页面提交后若仍不足一屏，Web MUST 使用新 cursor 继续有界补页

#### Scenario: Underfilled history has already reached the beginning
- **WHEN** timeline 不足一屏但 cursor 为空或 `reachedBeginning` 为 true
- **THEN** Web MUST 不再发送历史分页请求

### Requirement: Agent message source aliases reconcile safely
raw-response、live delta、completed item、snapshot 与 overlay 中指向同一 authored assistant reply 的 agent message SHALL 通过可证明的来源别名收敛为一个 normalized entry。别名判断 MUST 同时限定在同一 history generation、同一 turn、互补来源和唯一候选。provisional/raw 与 canonical MAY 使用相等或前缀兼容正文；completed-event overlay 与 authority history snapshot MUST 使用精确相等正文和唯一的一对一物化关系。系统 MUST NOT 仅凭正文相同合并同一来源中的两个正式 canonical item。

#### Scenario: Raw response with explicit ID keeps provenance
- **WHEN** `rawResponseItem/completed` 携带显式 item ID、response ID 和 absolute output index
- **THEN** 适配后的 agent item MUST 保留该显式 ID
- **AND** MUST 同时保留 `sourceLocator` 的 response 来源、response ID 和 absolute output index

#### Scenario: Live provisional reply converges to canonical completion
- **WHEN** 同一 generation 与 turn 的 agent reply 先通过 live delta 使用 provisional item ID 显示
- **AND** 后续 canonical completed item 使用不同 item ID 返回相等或完整扩展该前缀的正文
- **AND** 该 turn 中只有一个满足来源与正文约束的 provisional 候选
- **THEN** timeline MUST 原位收敛为一个 agent message
- **AND** 最终 entry MUST 使用 canonical item ID、最早可见位置和更完整的 completed 正文与状态

#### Scenario: Raw response overlay converges with canonical snapshot
- **WHEN** raw-response overlay 与 canonical snapshot item 属于同一 generation 与 turn
- **AND** 两者通过 response 来源定位与唯一候选规则可证明为同一 reply
- **THEN** server timeline 与 Web normalized timeline MUST 只暴露一个 agent message
- **AND** 刷新、repair 或重新分页 MUST 不恢复第二条 raw-response 消息

#### Scenario: Completed event overlay converges with materialized history item
- **WHEN** rollout 中只有一个正式 assistant item
- **AND** completed event overlay 与 authority history page 在同一 generation、同一 turn 使用不同 item ID 返回该完整正文
- **AND** 该精确正文在 history 与 completed overlay 两侧分别只有一个候选
- **THEN** 服务端 timeline page MUST 只返回 history item
- **AND** completed overlay item MUST 在该响应中被视为已物化并消费
- **AND** 刷新、repair 和重新分页 MUST 不再次暴露 completed overlay 的第二条消息

#### Scenario: Nested completion item inherits event identity metadata
- **WHEN** `item_updated` 或 `item.appended` 的嵌套 `item`/`entry` 只有 item ID、turn 和正文
- **AND** 外层事件携带 `bootId`、`generation` 或传输序列元数据
- **AND** 同一 item 的 live delta 使用相同的外层 `bootId` 与 generation
- **THEN** 事件适配后的完成 entry MUST 继承缺失的 envelope identity/provenance 元数据
- **AND** 完成 entry 与 live delta MUST 命中同一强 `identityKey` 并只保留一个 normalized entry
- **AND** 适配器 MUST 保留嵌套对象已有的更具体元数据，且 MUST NOT 通过正文相等合并不同 item ID

#### Scenario: Materialized user overlay uses client operation identity
- **WHEN** authority history page 与 completed overlay 中的 user item 具有相同 generation、turnId 和非空 `clientUserMessageId`
- **AND** 该 client identity 在双方分别唯一
- **THEN** 服务端 timeline page MUST 只返回 history user item
- **AND** Web 不得依赖展示层隐藏服务端重复 user item

#### Scenario: Two canonical messages remain distinct
- **WHEN** 同一 turn 的同一来源包含两个不同 canonical item ID 的 agent messages
- **AND** 两条正文完全相同或一条是另一条的前缀
- **THEN** normalized timeline MUST 保留两个独立 agent messages
- **AND** MUST NOT 将文本等价单独视为来源别名

#### Scenario: Ambiguous completed/history materialization fails closed
- **WHEN** 同一 generation 与 turn 的 history 或 completed overlay 任一侧存在多个精确同文 agent 候选
- **OR** completed overlay 与 history 正文仅为前缀关系而非精确相等
- **THEN** 系统 MUST 保留各自强身份而不猜测一对一映射
- **AND** MUST NOT 使用 `msg_*`、`item-*` 命名形状或数组位置消除歧义

#### Scenario: History overlay reconciliation remains linear
- **WHEN** authority history page 包含大量不同 turns 与 agent items，runtime overlay 同时达到其有界容量
- **THEN** completed/history 物化协调 MUST 通过 turn/generation 与精确正文或 client identity 索引完成
- **AND** 处理工作量 MUST 与 page items 数量加 overlay items 数量线性相关
- **AND** React 渲染层 MUST NOT 执行跨 entry 文本去重

#### Scenario: Identical replies across turns remain distinct
- **WHEN** 不同 turn 的 agent messages 具有相同正文
- **THEN** timeline MUST 保留每个 turn 的独立消息
- **AND** alias 协调 MUST NOT 跨 turn 匹配候选

#### Scenario: Ambiguous or conflicting alias fails closed
- **WHEN** 同一 turn 存在多个满足文本条件的 provisional/raw 候选
- **OR** provisional/raw 正文与 canonical 正文不满足相等或前缀兼容
- **THEN** 系统 MUST 保留各自强身份而不猜测合并
- **AND** MUST 记录 alias ambiguity 或 identity conflict 诊断，并在需要时请求有界 repair

#### Scenario: Non-agent identities are unchanged
- **WHEN** timeline 处理 reasoning、tool、diff、system 或 user entries
- **THEN** agent source alias 规则 MUST 不改变这些 entry 的身份、去重、排序或展示行为

### Requirement: Agent Markdown 安全展示本机图片引用
Agent Markdown SHALL 将 POSIX 或 Windows 绝对图片路径通过现有认证图片预览 API 展示，并提供稳定、适合移动端的正文图片交互。系统 MUST 不把相对路径交给本机文件预览 API，也 MUST 不因自定义 URL 转换放宽 ReactMarkdown 对危险协议的过滤。

#### Scenario: POSIX 绝对图片路径
- **WHEN** agent Markdown 包含 `/Users/.../shot.png` 或其他 POSIX 绝对图片路径
- **THEN** 图片 `src` MUST 使用 `/api/codex/images/preview?path=...`
- **AND** 浏览器 MUST 不直接请求该绝对路径对应的站内 URL

#### Scenario: Windows 绝对图片路径
- **WHEN** agent Markdown 包含 `C:\Users\...\shot.png` 或 `C:/Users/.../shot.png`
- **THEN** 系统 MUST 正确恢复路径语义并只进行一次 URL 编码
- **AND** 图片 MUST 通过预览 API 加载

#### Scenario: 非本机图片 URL 保持语义
- **WHEN** agent Markdown 图片使用 `http:`、`https:`、`/api/`、`blob:`、受支持的 `data:` 或协议相对 URL
- **THEN** 系统 MUST 保持既有 URL 语义
- **AND** MUST 不把该 URL 包装成本机文件预览请求

#### Scenario: 相对路径不进入本机预览
- **WHEN** agent Markdown 图片使用相对路径
- **THEN** 系统 MUST 不把该路径发送给本机文件预览 API

#### Scenario: 正文图片加载成功
- **WHEN** Markdown 图片成功加载
- **THEN** 图片 MUST 保持自然宽高比且宽度不得超过消息容器
- **AND** 用户点击图片 MUST 打开现有全屏图片预览

#### Scenario: 正文图片加载失败
- **WHEN** Markdown 图片加载失败
- **THEN** UI MUST 隐藏浏览器原生破图并显示通用失败占位
- **AND** 用户 MUST 能重试加载
- **AND** UI MUST 不显示本机绝对路径或服务端错误详情

