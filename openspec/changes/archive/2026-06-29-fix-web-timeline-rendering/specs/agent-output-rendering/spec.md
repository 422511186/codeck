## ADDED Requirements

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
running 会话中，HTTP thread snapshot SHALL NOT 无条件覆盖已经通过 WebSocket 追加到 timeline 的 live entries。系统 SHALL 在 running 状态使用 merge 策略，让 agent message、reasoning、command/tool output 按 delta 追加持续可见。

#### Scenario: startTurn snapshot does not erase live deltas
- **WHEN** 用户发送消息后 WebSocket 已经追加 agent/reasoning/tool delta
- **AND** `startTurn` HTTP 响应随后返回一个不包含这些 delta 的 thread snapshot
- **THEN** timeline MUST 保留已经追加的 live entries
- **AND** MUST NOT 通过全量 `setThreadEntries` 清空或回退这些输出

#### Scenario: polling snapshot does not erase live deltas
- **WHEN** running 会话 polling 返回一个滞后的 thread snapshot
- **AND** 本地 timeline 已经有更新的 WebSocket delta
- **THEN** timeline MUST 保留本地 live delta
- **AND** snapshot 中的新完成项 MAY 替换同 id 的 running entry

#### Scenario: completed snapshot can finalize live entries
- **WHEN** turn 完成后 snapshot 或 `item_updated` 返回同 id 的完整 agent/reasoning/tool item
- **THEN** timeline MUST 用完整 item 更新对应 live entry
- **AND** MUST 保持该 entry 的相对位置稳定

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

## MODIFIED Requirements

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
