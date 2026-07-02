# agent-output-rendering Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 所有长输出默认折叠为卡片
Agent 流式产生的所有「长内容」（命令调用、文件 diff、推理过程、MCP 工具调用、计划事件之外的长块）SHALL 默认以折叠卡片形式插入 timeline，用户点击后就地展开 / 收起，不弹出新页或抽屉。

#### Scenario: 默认折叠
- **WHEN** agent 输出命令、diff、推理、MCP 工具调用等内容
- **THEN** timeline MUST 用折叠卡片占位
- **AND** 卡片 MUST 默认收起

#### Scenario: 就地展开
- **WHEN** 用户点击折叠卡片
- **THEN** 卡片 MUST 在原位置就地展开
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
工具卡片折叠态 SHALL 优先展示用户能快速理解的动作、工具名或命令摘要，低优先级元数据（如 cwd、完整路径、长 JSON 参数）SHALL 放到次要区域或展开内容中。卡片 SHALL 保留可追踪性，但默认展示 MUST 避免把 agent 正文回答明显下推。

#### Scenario: 命令工具优先显示命令
- **WHEN** timeline 渲染 `toolKind` 为 `command` 的工具卡片
- **THEN** 折叠态标题 MUST 优先显示命令内容
- **AND** cwd MUST 不作为标题最前面的主要文本

#### Scenario: 非命令工具保留工具身份
- **WHEN** timeline 渲染 MCP、dynamic、file、web 或 image 工具卡片
- **THEN** 折叠态 MUST 显示工具身份或动作名称
- **AND** 长参数或长路径 MUST 不导致标题横向溢出

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
当 agent 修改文件、`turn_diff_updated` 事件到达时 SHALL 为每个被修改文件生成一张折叠卡片，多个文件不合并到同一张卡。

#### Scenario: 单文件改动
- **WHEN** agent 修改了 1 个文件
- **THEN** timeline MUST 出现 1 张 diff 卡片

#### Scenario: 多文件改动
- **WHEN** agent 一次修改了 N 个文件
- **THEN** timeline MUST 出现 N 张 diff 卡片，依次排列

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
`reasoning_delta` 事件在 agent 进行中 SHALL 渲染为运行中的推理卡片；卡片 SHALL 保留「思考中…」状态，并在已经收到推理文本时允许用户查看已到达内容。turn 完成后 SHALL 保留为「推理过程」卡片，仍默认折叠，可点击展开查看完整推理文本。

#### Scenario: 进行中且尚无文本
- **WHEN** agent 开始 reasoning 但尚未收到任何 `reasoning_delta` 文本
- **THEN** timeline MUST 显示一张「思考中…」折叠卡片
- **AND** 卡片 MUST 有微动效以表明在进行

#### Scenario: 进行中且已有文本
- **WHEN** agent 仍在产生 `reasoning_delta` 且至少已有一段推理文本到达
- **THEN** timeline MUST 显示运行中的推理卡片
- **AND** 用户 MUST 能在卡片中看到或展开查看已到达的推理文本
- **AND** 卡片 MUST 继续显示运行中状态

#### Scenario: summary 分段事件不中断展示
- **WHEN** WebSocket 收到 `item/reasoning/summaryPartAdded` 后继续收到 `item/reasoning/summaryTextDelta`
- **THEN** timeline MUST 继续把 summary delta 追加到对应推理卡片
- **AND** MUST 不因为 summary part 事件本身没有文本而丢弃后续推理内容

#### Scenario: summary 分段先创建思考卡片
- **WHEN** WebSocket 收到 `item/reasoning/summaryPartAdded` 或 reasoning `item/started` 且尚无文本 delta
- **THEN** timeline MUST 立即显示一张运行中的「思考中…」推理卡片
- **AND** 后续 `item/reasoning/summaryTextDelta` 或 `item/reasoning/textDelta` MUST 追加到同一张卡片

#### Scenario: reasoning summary 请求与展示链路完整
- **WHEN** Web 发起一个支持 reasoning 的 turn
- **THEN** 请求参数或会话设置 MUST 明确保留可公开展示的 reasoning summary 配置
- **AND** Web MUST 渲染 app-server 已公开发送的 reasoning summary/content/delta
- **AND** Web MUST NOT 伪造模型未公开发送的隐藏推理内容

#### Scenario: turn 完成
- **WHEN** 该 turn 的 reasoning 流结束
- **THEN** 卡片 MUST 保留在 timeline 中
- **AND** 卡片标题 MUST 改为「推理过程」
- **AND** 卡片 MUST 仍默认折叠
- **AND** 用户点击 MUST 可展开查看完整推理文本

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
Markdown 代码块的复制按钮 SHALL 在明亮主题和暗黑主题下都清晰可见、可点击，并使用当前主题 token 表达默认状态和复制成功状态。

#### Scenario: Copy button in light theme
- **WHEN** 用户在明亮主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button in dark theme
- **WHEN** 用户在暗黑主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button success state
- **WHEN** 用户点击代码块复制按钮且复制成功
- **THEN** 按钮 MUST 显示复制成功状态
- **AND** 成功状态 MUST 在当前主题下保持可读

### Requirement: Timeline execution events are never silently dropped
Web timeline SHALL render every app-server execution-related historical item and realtime notification that represents user-visible agent work, including shell commands, command/process output, file changes, MCP/dynamic tools, collaboration or exploration tool calls, sub-agent activity, web search, image operations, and raw response items that have no later normalized `ThreadItem`.

#### Scenario: Historical command item is visible
- **WHEN** `thread/read` or turns pagination returns a `commandExecution` item
- **THEN** timeline MUST render a command or tool card for that item
- **AND** the card MUST include the command text, status, and any aggregated output that exists

#### Scenario: Realtime command output is visible
- **WHEN** WebSocket receives command output through `item/commandExecution/outputDelta`, `command/exec/outputDelta`, or `process/outputDelta`
- **THEN** timeline MUST append the output to a visible running command or tool card
- **AND** subsequent deltas for the same execution MUST update the same card instead of creating unrelated orphan text

#### Scenario: Exploration and collaboration tool calls are visible
- **WHEN** app-server returns or emits an exploration, collaboration, sub-agent, MCP, dynamic tool, or file change item
- **THEN** timeline MUST render a visible card that identifies the event kind and status
- **AND** the item MUST NOT be dropped solely because the exact protocol variant is newer than the original Web adapter

#### Scenario: Realtime tool progress preserves the original kind
- **WHEN** WebSocket receives realtime progress for MCP, dynamic tool, exploration, collaboration, sub-agent, command, process, or file-change work
- **THEN** timeline MUST append the progress to a visible card that identifies the original work kind
- **AND** non-file events MUST NOT be normalized or rendered as `fileChange`
- **AND** file-specific cards MUST only be used for actual file-change protocol events

#### Scenario: Unknown execution item preserves observability
- **WHEN** app-server sends a user-visible execution item that Web cannot map to a specialized card
- **THEN** timeline MUST render a generic system or tool card with the item type and available text/JSON summary
- **AND** the event MUST NOT disappear without any timeline representation

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
打开会话页时，系统 SHALL 避免对同一个 thread 在首屏 `readThread` 之后立即发起重复 `readThread` polling。running fallback polling SHALL 做去抖或延迟，以 WebSocket 作为实时主路径。

#### Scenario: running thread initial load
- **WHEN** 用户打开一个 status 为 active/running 的会话
- **THEN** 页面 MUST 发起首屏 `readThread`
- **AND** polling MUST NOT 在首屏响应刚应用后立即再次读取同一 thread

#### Scenario: delayed fallback polling
- **WHEN** 会话仍处于 running 状态且 WebSocket 没有完成 turn
- **THEN** polling MAY 在后续 interval 触发 `readThread`
- **AND** polling 结果 MUST 遵守 live timeline merge 规则

### Requirement: Reasoning display is consistent across live and historical paths
Web timeline SHALL 展示 app-server 已公开发送的 reasoning summary、content 和 delta。实时 reasoning、完成后的 reasoning item、raw response reasoning 和历史 `thread/read` reasoning MUST 映射到同一条 timeline entry 或按稳定 id 合并，不得在刷新、完成或重连后无故消失或重复。

#### Scenario: Live reasoning survives completion
- **WHEN** reasoning delta 已通过 event stream 显示在 timeline 中
- **AND** 后续收到 reasoning item completion
- **THEN** 系统 MUST 用完成项更新同一 reasoning entry
- **AND** MUST NOT 因完成项文本为空而清空已有公开 reasoning 文本

#### Scenario: Historical reasoning remains visible after reload
- **WHEN** 用户刷新页面或重新进入会话
- **AND** app-server 历史中存在公开 reasoning summary/content 或可见 raw response reasoning
- **THEN** `thread/read` 返回的 timeline MUST 包含可展示的 reasoning entry
- **AND** 前端 MUST 继续以 reasoning card 展示该内容

#### Scenario: Raw response reasoning does not create duplicates
- **WHEN** 同一 reasoning 同时通过 reasoning delta 和 raw response completion 到达
- **THEN** 系统 MUST 使用稳定 item identity 合并它们
- **AND** timeline MUST NOT 展示两张语义相同的 thinking/reasoning 卡片

### Requirement: Reasoning remains stable across live, completion and repair
reasoning 输出 SHALL 在 live delta、reasoning started、item completion、raw response completion 和 snapshot repair 之间使用稳定 item identity 合并。完成项文本为空时 MUST NOT 清空已公开显示的 reasoning 文本；repair 后旧 reasoning delta MUST NOT 重复追加。

#### Scenario: Empty reasoning completion preserves live text
- **WHEN** reasoning delta 已显示文本
- **AND** 后续 completion item 的 reasoning 文本为空
- **THEN** timeline MUST 保留已显示 reasoning 文本
- **AND** reasoning card MAY 标记为完成

#### Scenario: Historical repair keeps reasoning once
- **WHEN** snapshot repair 返回已完成 reasoning item
- **AND** 旧 generation 的 reasoning delta 后到
- **THEN** 前端 MUST 忽略旧 delta
- **AND** timeline MUST 只显示一张对应 reasoning card

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
agent message、reasoning card 和 tool card SHALL 在同一 turn 内按稳定身份和等价内容去重。不同 turn 中内容相同的输出 MUST 保留为不同 entry。

#### Scenario: Duplicate reasoning card in same turn
- **WHEN** 同一 turn 产生两条 reasoning entries
- **AND** 两条 entries 的文本相同或一条文本包含另一条
- **THEN** timeline MUST 只显示一张 reasoning card
- **AND** 该 card MUST 使用更完整的文本和完成状态

#### Scenario: Identical agent reply in different turns
- **WHEN** 两个不同 turn 都回复 `1 + 1 = 2`
- **THEN** timeline MUST 保留两条 agent message
- **AND** MUST NOT 因文本相同跨 turn 去重

#### Scenario: Tool output duplicate in same turn
- **WHEN** 同一 turn 的 tool output 通过 live overlay 和 snapshot 同时出现
- **AND** `toolKind`、`server`、`tool` 和 output 文本等价
- **THEN** timeline MUST 只显示一张 tool card
