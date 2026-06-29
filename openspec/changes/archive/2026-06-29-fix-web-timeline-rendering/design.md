## Context

Web 会话页的 timeline 由两条链路共同驱动：

- 历史链路：`thread/read` 或 turns 分页返回 app-server `ThreadItem`，经 `src/server/app-server/client.ts` 转成 `MobileTimelineItem`，再经 `src/web/state/timeline.ts` 转成前端 `TimelineEntry`。
- 实时链路：app-server WebSocket notification 经 `src/server/app-server/events.ts` 归一化，再由 `src/web/state/store.ts` 写入 timeline。

当前缺陷集中在这两条链路的中间层：未识别的 item/notification 会被静默丢弃，推理 delta 虽然写入状态但运行态 UI 不展示正文，Linux 绝对图片路径又被前端误判为 URL。移动端远程访问时，这些问题会表现为命令和探索过程消失、推理不可见、图片 404。

进一步排查发现，running 会话还有第三类问题：HTTP snapshot 与 WebSocket live delta 互相覆盖。`ThreadPage` 在首屏 `readThread` 后如果状态是 active，会立即进入 polling 并再次 `readThread`；发送消息后 `startTurn` 返回的 thread snapshot 也会触发 `setThreadEntries` 全量替换。任何一个滞后的 snapshot 都可能抹掉刚刚通过 WebSocket 追加的 agent/reasoning/tool delta，造成用户看到“过程刷新但前面的输出不展示，直到完成后才一次性出现”。

最新排查还确认了两个协议边界问题。第一，`TurnStartParams` 支持 `summary?: ReasoningSummary`，但 Web 当前只传 `effort`，没有显式保证本 turn 会请求可公开展示的 reasoning summary；因此“reasoning 内容可见”只能保证 app-server 已公开发送的 summary/content/delta 被展示，不能伪造模型没有公开输出的隐藏推理。第二，`item/mcpToolCall/progress` 当前被归一化为 `file_output_delta`，前端 store 又把 `file_output_delta` 固定渲染为 file 工具卡，导致非 fileChange 的工具进度被错误显示成 fileChange。

## Goals / Non-Goals

**Goals:**

- 历史读取和实时 WebSocket 都能稳定展示命令执行、进程输出、工具调用、探索/协作类活动和推理内容。
- running 会话中，HTTP snapshot 只能补充或完成 live timeline，MUST NOT 覆盖已经到达的 WebSocket 增量。
- 打开会话时减少重复 `readThread`，首屏读取完成后不立即再做同一次 polling refresh。
- Web 发起 turn 时保留或显式请求可公开展示的 reasoning summary，并把已公开到达的 reasoning summary/content/delta 持续渲染出来。
- 工具进度事件保留原始类型，MCP、dynamic tool、sub-agent、collaboration、command/process 和 fileChange 不应全部显示为 fileChange。
- 推理运行中既保留“思考中…”状态，又能显示已经到达的推理文本。
- 用户上传图片在远端浏览器可预览，Linux/POSIX 绝对路径不再被当成 Web URL。
- 用单元测试覆盖协议归一化、store 写入、组件渲染和图片路径判断。

**Non-Goals:**

- 不新增后端上传 API 或改变现有 `/api/codex/uploads/images`、`/api/codex/images/preview` 路径。
- 不改变 app-server 生成的协议类型文件。
- 不重新设计 timeline 视觉系统，只修复内容可见性和资源路径判断。
- 不把 token usage、耗时等非 timeline 信息加入会话流。

## Decisions

### Decision: 统一收敛到 `MobileTimelineItem`

继续以 `MobileTimelineItem` 作为 server adapter 到 Web state 的边界，补齐 `timelineItem()` 对现有 `ThreadItem` 类型的映射。这样历史读取、resume 和 turns 分页都走同一套转换逻辑。

替代方案是让前端直接理解 app-server 协议类型，但这会把 generated protocol 泄漏到 UI 层，增加移动端前端的耦合。

### Decision: 对实时 notification 做显式白名单扩展

在 `events.ts` 中显式处理当前协议中与 timeline 相关但尚未归一化的 notification，例如 `rawResponseItem/completed`、`command/exec/outputDelta`、`process/outputDelta`、`item/reasoning/summaryPartAdded` 和工具进度事件。无法稳定渲染的事件至少不应影响同一 item 后续 delta 展示。

替代方案是把所有未知 notification 透传给前端，但这会让 store 承担协议兼容和安全过滤职责，不适合作为移动端 UI 边界。

### Decision: 推理运行态展示已到达文本

`ReasoningCard` 在 `done=false` 且 `text` 非空时展示流式文本，并保留运行中标识。turn 完成后的 `item_updated` 仍替换为完成态卡片。

替代方案是只显示“思考中…”，但这正是当前 bug；它让用户误以为推理事件没有到达。

### Decision: 首个 reasoning 生命周期事件创建占位卡片

`item/reasoning/summaryPartAdded` 或 `item/started` 中的 reasoning item 即使没有文本，也应归一化成一个 `done=false` 的推理 entry。这样用户会先看到“思考中…”卡片，后续 `summaryTextDelta` / `textDelta` 再追加正文。

替代方案是等首个非空 delta 再创建卡片，但后端可能先发 summary part 或 start 事件；此时 UI 会出现空白等待，用户感知为推理过程缺失。

### Decision: reasoning 只展示 app-server 公开的 summary/content

Web 侧要保证的是完整打通公开 reasoning summary/content 的链路：发起 turn 时不丢失 `summary` 配置，实时事件到达时先创建占位卡片，后续 summary/content delta 追加到同一张卡片，完成态 item 再替换为最终内容。Web 不应尝试展示模型未公开发送的隐藏推理内容。

替代方案是在前端本地生成“推理文本”占位内容，但这会误导用户。无文本时只显示运行中的“思考中…”卡片；有公开 summary/content 到达时再展示真实内容。

### Decision: 工具进度事件类型保真

实时工具进度需要带上原始 work kind 或 tool metadata，store 根据这些字段创建或更新对应工具卡。`file_output_delta` 只用于真实 `item/fileChange/...` 事件；`item/mcpToolCall/progress` 等非 fileChange 事件不能再映射成 file 输出。若协议只给出进度文本而没有完整 metadata，则使用通用 tool card，但标题仍应体现 MCP/tool progress，而不是 fileChange。

替代方案是继续用 `file_output_delta` 作为所有非 command 工具输出的兜底，但这会丢失语义，是用户当前看到“只展示 filechange 事件”的直接原因。

### Decision: running snapshot 采用 merge，不做全量替换

`applyThreadDetail()` 适合首屏历史加载和非 running 的最终状态；对 running turn 的 `startTurn` 响应和 polling 响应，应使用 timeline merge 策略：

- 已有 live entry 的 id 在 snapshot 中不存在时，保留 live entry。
- snapshot 中同 id 的完成态 item 可以替换 live entry。
- snapshot 中新增的历史 item 可以补入 timeline。
- 用户 optimistic message 只在服务端确认后替换对应用户消息，不清空其他 live output。

替代方案是继续 `setThreadEntries()` 全量替换，但这会和 WebSocket 增量竞争，是当前刷新/丢内容的直接原因。

### Decision: polling 不立即重复首屏 readThread

打开 active 会话时，首屏 `readThread` 已经拿到一次 snapshot。polling effect 不应在 `running=true` 后立刻 `refresh()`；应至少等到下一次 interval，或记录最近一次 read 时间后去抖。

替代方案是保留立即 refresh 作为“更快恢复”路径，但它增加重复请求，并且在 snapshot 滞后时更容易覆盖 live delta。

### Decision: 图片路径按“浏览器 URL”而不是“是否以 / 开头”判断

前端图片预览只把 `blob:`、`data:`、`http:`、`https:` 和应用内已知公开资源路径当作可直接加载 URL。Windows 路径、Linux/POSIX 绝对路径、相对上传路径都通过 `/api/codex/images/preview?path=...` 读取。

替代方案是上传接口返回专用 preview URL，但会改变现有 API 响应语义，并且历史消息里已有本地路径仍需要兼容。

## Risks / Trade-offs

- [Risk] app-server 协议继续新增 item/notification 类型，Web 再次静默遗漏。  
  Mitigation: 为未知 timeline 类型增加测试覆盖策略，并优先在 adapter 层做显式映射。

- [Risk] 流式命令输出和进程输出的 item id 不一致，导致同一命令被拆成多张卡片。  
  Mitigation: 归一化时优先使用协议提供的 `itemId`/`processId`/`callId`，测试覆盖追加行为。

- [Risk] 推理文本过长影响移动端滚动性能。  
  Mitigation: 继续使用折叠卡片和内部滚动区域，运行态只改变可见性，不取消折叠约束。

- [Risk] 当前模型、provider 或 app-server 配置不产生 reasoning summary。  
  Mitigation: Web 发起 turn 时保留或显式传递 `summary` 配置；如果 app-server 仍没有公开 summary/content，只显示运行态占位，不伪造内容。

- [Risk] 部分实时工具进度缺少完整 tool metadata，难以还原精确卡片标题。  
  Mitigation: 归一化事件至少保留 protocol method/work kind，并使用通用 tool card；后续 `item_started`/`item_completed` 到达后用完整 item 更新同 id 卡片。

- [Risk] 放宽图片路径预览导致非上传目录文件可读。  
  Mitigation: 仍由 `readPreviewImage()` 使用 workspace/upload/tmp 白名单校验路径，前端只改变 URL 构造，不扩大服务端权限。

- [Risk] snapshot merge 保留了已经被后端回滚或删除的 live entry。  
  Mitigation: 仅在 running 状态使用保守 merge；turn 完成后允许最终 snapshot 以 completed item 替换同 id live entry，并在 rollback/interrupt 等明确操作中重新加载。
