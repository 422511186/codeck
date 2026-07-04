## Context

当前移动端会话页的核心链路是：

```text
app-server ThreadItem / Notification
        │
        ▼
src/server/app-server/events.ts
        │  BrowserCodexEvent
        ▼
SSE /api/codex/events
        │
        ▼
src/web/state/store.ts
        │  TimelineEntry[]
        ▼
src/web/components/Timeline.tsx
```

现状已经能显示 agent 正文、reasoning、tool、command output、diff、system/error 等内容，也有事件幂等、generation、snapshot repair 和重复 delta 抑制。但移动端 timeline 仍按底层事件粒度直接铺开，导致一个长 turn 中 Thinking、read/search/bash、文件变更和正文混在一起，用户需要向下扫很多卡片才能理解 agent 到底做了什么。

另一个缺口是 Skills 加载/变更事件：协议层存在相关通知，但浏览器事件适配和前端状态没有完整消费它。现在用户只能看到自己在输入框里选择的 Skill chips，看不到 agent/runtime 在 turn 中加载 Skill 的活动，也不能依赖该事件刷新 Skill picker 缓存。

## Goals / Non-Goals

**Goals:**

- 移动端 timeline 中把 Thinking、工具活动、命令输出、文件变更组织为清晰的 activity block，同时保留展开查看详情的能力。
- 将 reasoning 标题统一为 `Thinking` / `Thinking...`，避免中英文体验混杂。
- 补齐 Skills 加载/变更事件的服务端归一化、前端消费、缓存失效和轻量活动展示。
- 发送消息后，即使 `startTurn` 只返回 `turnId`，agent 回复、工具活动和完成状态也必须通过实时事件或自动 repair 出现在当前页面，不能要求用户手动刷新。
- 保留现有 SSE 幂等、repair、generation、rollback 语义；活动分组不能导致丢事件、重复事件或错误 rewind。
- 让折叠态摘要适合手机阅读：短标题、短路径、纯文本预览，冗长 JSON、cwd、完整输出放入展开区。

**Non-Goals:**

- 不做桌面端布局适配。
- 不重写 timeline event stream 协议的幂等模型。
- 不展示 token 消耗、模型成本或长耗时统计到 timeline。
- 不把文件 diff 改成可采纳/回滚的交互，只做查看。
- 不伪造模型未公开发送的隐藏推理内容；只展示 app-server 已公开的 reasoning summary/content。

## Decisions

### 1. 保持 `TimelineEntry[]` 为事实源，在渲染层派生活动分组

底层 store 继续保存原始 `TimelineEntry[]`，包括 `reasoning`、`tool`、`command`、`diff`、`system`、`error`、`agent-message`。`Timeline.tsx` 或其附近新增纯函数，把同一 turn 内连续的活动 entry 派生为移动端渲染块：

```text
TimelineEntry[]
   │
   ▼
TimelineRenderBlock[]

┌ user-message ┐
│ activity     │  Thinking + tool/read/search/bash/diff summary
│ agent-msg    │
│ activity     │  verification or later tool output
└ system/error ┘
```

这样 rewind、fork、snapshot repair、delta suppression 仍基于原 entry，不需要把 UI 分组写回 store。替代方案是在 store 中新增 `activity` entry；缺点是会把展示结构混入事件一致性逻辑，并增加历史合并、repair 和测试复杂度。

### 2. Activity block 内部使用“摘要行 + 可展开详情”

一个 turn 中的活动按动作类型聚合显示，默认展示摘要：

```text
Thinking
  3 steps · completed

Activity
  Skills loaded · 2
  Read files · 6
  Searched files · 1
  Ran commands · 2
  Files changed · 7 · +55 -36
```

展开后仍回到原始粒度：每条命令、每个工具调用、每个 diff 文件、每段 reasoning 都能查看详情。分组只改变默认阅读层级，不删除信息。

替代方案是继续每个事件一张卡片，仅微调样式；这能减少开发量，但无法解决手机上“正文被活动卡片挤散”的主要问题。

### 3. Thinking 作为独立高优先级活动，而不是普通工具卡片

`reasoning` entry 在视觉上独立为 `Thinking` block：

- 运行中且无文本：标题 `Thinking...`，使用轻量 pulse/spinner。
- 运行中且有文本：标题 `Thinking...`，摘要显示纯文本首行，展开可看已到达内容。
- 完成后：标题 `Thinking`，默认折叠，展开可看完整公开 reasoning 文本。

预览文本必须经过纯文本化处理，避免 `**...**`、标题符号、代码 fence 等 Markdown 标记直接出现在折叠态。

### 4. 工具活动增加语义分类，但保留兜底渲染

服务端事件适配层应尽量保留 app-server 提供的结构化动作信息，例如 command/read/list/search、MCP tool、dynamic tool、file output、image/web 操作、diff stats。前端用该语义生成摘要：

```text
commandActions.read   → Read files
commandActions.list   → Browsed folders
commandActions.search → Searched files
toolKind.command      → Ran commands
toolKind.mcp/dynamic  → Used tools
diff                  → Files changed
```

如果某个协议 variant 暂时无法识别，仍渲染为通用 `Used tool` 或 `Activity`，展开显示原始工具名、参数、结果，不能退化成不可读的系统 JSON。

### 5. Skills 事件拆成两个效果：缓存失效与可见活动

服务端收到 Skills 加载/变更相关通知时，转换为浏览器可消费事件，例如 `skills_changed` 或带 scope 的 `settings_invalidated`。事件至少应表达：

- 是否影响 Skills picker 缓存；
- 可选的 `threadId` / `turnId` / `cwd`；
- 可选的 Skill 名称列表或数量；
- 事件身份字段 `eventId`、`sequence`、`revision`、`generation`。

前端消费时分两层处理：

```text
skills event
  ├─ invalidate skill picker cache / bump skillsVersion
  └─ if thread-scoped and user-visible:
       append or group lightweight activity row
```

如果事件没有可靠的 thread 归属，只做缓存失效或设置刷新，不把它硬塞进当前 active thread，避免跨会话误显示。

### 6. 文件变更默认显示汇总，展开保持逐文件详情

现有 spec 要求 diff 每个文件一张卡片。移动端默认层级改为 `Files changed · N · +A -R` 汇总行；展开后仍必须能看到每个文件的相对路径、增删行数和 unified diff。这样满足快速扫读，同时保留审计细节。

### 7. UI 文案保持移动端工具感，不做重装饰

活动区应是轻量、窄高度、可扫读的工具 UI。避免把每个事件做成厚重卡片，也避免把活动日志写进 agent 正文。推荐的文字布局：

```text
Thinking
  completed · 4 updates

Activity
  Loaded skills · openspec-explore, systematic-debugging
  Read files · 6
  Ran command · npm test · passed
  Files changed · 3 · +42 -18

Assistant 正文...
```

### 8. 发送 turn 后采用“实时事件优先，快照 repair 兜底”

本次排查看到 `/api/codex/events` 可以实时收到 `thread_settings_updated`，同时刷新或 resume 后能读到最新线程内容，因此问题不像是 SSE 通道整体断开，更像是当前协议 variant 下 agent item、raw response item 或 `turn_completed` 没有被完整归一化/消费，或 `startTurn` 返回 `{ turnId }` 后缺少可见内容兜底。

目标链路应明确成：

```text
用户发送
  │
  ▼
POST /api/codex/turns/start  →  { turnId }
  │
  ├─ 乐观显示 user message
  │
  ▼
app-server item/rawResponse/turn notifications
  │
  ▼
BrowserCodexEvent / SSE
  │
  ▼
timeline 可见 agent/tool/activity entries
  │
  └─ 若 turn 已完成或等待超过阈值仍没有可见 server entry：
       read thread / snapshot repair，并按 generation/revision 合并
```

`turn_completed` 本身不能只作为“结束标记”吞掉；如果 active turn 没有任何可见 agent/tool/raw-response entry，它应触发 repair。repair 合并必须复用现有去重和 generation 规则，避免 live 事件迟到后重复插入回复。

### 9. 真实环境排查：仅适配 `ThreadItem.commandExecution` 不足以追平 Codex App

2026-07-04 在真实手机页面对比 Codex App 后确认，当前 Web 与 Codex App 的差异不是单纯样式问题。Codex App 能显示「已读取 N 个文件已运行 M 条命令」，但同一 thread 通过 Web `/api/codex/threads/<threadId>` 读取到的主 timeline 中，相关 turn 并没有 command/read activity。

实测线程 `权限模式+消息发送区重构` 的主 timeline 分布为：

```text
total: 753
user: 32
agent: 547
tool: 147
reasoning: 21

toolKind:
  file: 144
  web: 3
  command: 0
```

其中「构建docker并部署」turn 的分布为：

```text
user: 1
agent: 14
tool: 0
command: 0
```

当前 `/api/codex/threads/<threadId>/turns/<turnId>/items` 还返回 `thread/turns/items/list is not supported yet`，因此 Web 暂时没有另一个可直接读取的 turn item 明细源。这个证据推翻了一个早期假设：只要实现 `ThreadItem.commandExecution -> toolKind: command -> ActivityBlock` 就能追平 Codex App。事实是该映射只覆盖“如果 app-server 已把 commandExecution 暴露进 Web timeline”的情况，而真实 Codex App 的 read/command 活动似乎来自更底层或更完整的工具活动源。

后续实现需要先回答一个数据源问题：

```text
Codex App activity
  ├─ 是否来自未暴露给 Web 的 app-server notification？
  ├─ 是否来自 turn item 分页，但当前 gateway 未支持？
  ├─ 是否来自 raw response / command execution event，Web 只在 live 阶段没收到或没持久化？
  └─ 是否需要 Web 自己记录本会话工具调用活动，并在 refresh 后用 history/repair 对齐？
```

在数据源未确认前，继续优化 ActivityBlock UI 只能改善 file/web/diff 类活动，不能解决“执行命令不会显示”的核心差异。

实现结论：Web 侧保留现有 realtime notification 归一化，因为 `item/started` / `item/completed` / `item/commandExecution/outputDelta` 已能覆盖 app-server 明确发送的 commandExecution。新增的修复点放在 snapshot repair：当 repair 读取到主 timeline 后，会对最新 turn 额外尝试 `thread/turns/items/list` 明细分页；若该分页返回 command/read/search 等更完整 item，则把缺失 activity 合并进同一次 snapshot。若当前 app-server 返回 unsupported 或 502，Web 静默回退到主 timeline，不阻断最终回复展示。

2026-07-04 手机验证又暴露出一个顺序问题：如果 store 在同一 turn 内按 role rank 重新排序，会把 `tool/diff` 全部提升到 `agent-message` 之前，视觉上就变成 Activity 集中堆在用户消息下面。这与 Codex App 的效果不一致。正确模型是：底层 timeline 保留 app-server item 顺序或 live event 到达顺序，渲染层只合并“连续”的活动 entry；当 assistant 文本之间穿插工具、diff、Skills 或命令活动时，Web 也应穿插显示，而不是按类型重新分桶。

### 10. 权限 chip 与 sandbox profile 需要拆开理解

截图里 `替我审批` 更接近 `approvalsReviewer = "auto_review"` 的展示，而不是 `permissions` profile 本身。当前排查到的请求状态显示它可以与 `permissions = ":workspace"` 同时存在，因此 agent 说“workspace-write + 受管权限”不一定是幻觉；它描述的是 sandbox/profile 层，chip 描述的是审批 reviewer 层。

这意味着本 change 不应为了修复“发送后必须刷新”而优先修改权限 payload。真正的风险是文案容易让用户误以为 `替我审批` 等同于 `never ask`、完全自动或 full access。若后续要优化权限文案，应在权限选择相关 change 中单独处理，并保持四种模式与 Codex app 内展示一致。

## Risks / Trade-offs

- [Risk] 活动分组可能掩盖失败命令或错误输出 → Mitigation：失败状态必须在摘要层显示红色/错误状态，展开后保留完整输出。
- [Risk] Skills 事件没有 thread 归属时误显示到当前会话 → Mitigation：无可靠 `threadId` 的 Skills 事件只做缓存失效，不追加 timeline entry。
- [Risk] 发送 turn 成功但 agent item/raw response 事件缺失或未被消费，导致回复只有刷新后可见 → Mitigation：监听 active turn 的可见 server entry；完成或等待超时仍为空时触发 snapshot repair/read thread。
- [Risk] `turn_completed` 到达时只更新状态、不修复内容，会把 UI 留在“已发送但无回复”的空洞状态 → Mitigation：把 `turn_completed` 纳入 repair 条件，而不是只作为终止事件。
- [Risk] 用命令字符串启发式判断 read/search/list 不稳定 → Mitigation：优先使用 app-server 结构化 `commandActions`，启发式仅作展示兜底。
- [Risk] 分组渲染可能影响虚拟滚动、自动滚到底部或跳到最新按钮 → Mitigation：分组为渲染派生，不改变底层 entry 顺序；滚动锚点继续基于稳定 entry id 或 block id。
- [Risk] 折叠摘要过度简化导致追踪性下降 → Mitigation：所有摘要行都可展开到原始命令、参数、结果、路径或 diff。
- [Risk] 与现有“diff 每个文件一张卡片”要求冲突 → Mitigation：把逐文件卡片移动到展开详情层，默认层显示汇总；delta spec 明确更新该要求。
- [Risk] `替我审批` 文案被理解为 full access 或 never ask → Mitigation：记录为权限语义/文案风险，不与 timeline live delivery 修复混在一起。
- [Risk] Codex App 的 read/command 活动不在当前 Web 主 timeline 中，导致 ActivityBlock 永远没有命令可渲染 → Mitigation：先定位 Codex App 活动数据源或补齐 app-server/Web gateway 暴露路径，再谈 UI 对齐。

## Migration Plan

1. 先补事件归一化和 store 消费测试，确保新增 Skills/活动事件不会破坏现有 SSE 幂等规则。
2. 再调整 Timeline 派生渲染和卡片文案，保留旧 entry 类型作为数据源。
3. 最后优化移动端样式、路径/预览清洗和展开详情。
4. 无数据迁移；历史数据仍按既有 `TimelineEntry` 读取。若需要回滚，删除活动分组渲染即可回到逐 entry 卡片。

## Open Questions

- Skills 加载事件在 app-server 协议中的最终 method 名称和 payload 字段是否稳定？实现前需要以生成协议类型为准。
- 当前 app-server 最终 assistant 回复可能走 `item/agentMessage/delta`、`item/completed`、`rawResponseItem/completed` 或其他 method；实现前需要对照生成协议和真实事件样本确认所有会产出可见回复的 variant。
- Codex App 的「已读取/已运行命令」活动使用哪个数据源？主 `thread/read` timeline 当前没有 command tool，turn item 分页也暂不可用，需要继续追到 app-server notification、raw response 或未接入的分页 API。
- “Loaded skills” 是否只展示 runtime 实际加载的 Skill，还是也展示用户消息中选择的 Skill？建议两者区分：用户选择继续显示在用户消息 chips，runtime 加载显示在 activity。
- 验证结果是否应独立成 `Verification · passed/failed` 摘要，还是先归入 `Ran commands`？建议第一版只在能可靠识别测试命令时显示验证标签，否则归入命令活动。
