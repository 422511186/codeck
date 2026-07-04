## Context

本项目只做移动端 Web，当前会话页的活动展示经历过一次“activity block”方向的实现：`Timeline.tsx` 将连续 reasoning/tool/command/diff 派生为 `ActivityBlock`，默认显示 `Activity` 标题和摘要行，展开后查看详情。真实手机截图对比 Codex App 后确认，这个方向不符合目标：Codex App 中活动不是厚卡片，而是穿插在 assistant 文本之间的低强调内联日志，例如 `Loaded 4 tools` 下直接列出 `读取 Systematic Debugging 技能` 等明细。

当前相关链路是：

```text
app-server ThreadItem / raw response / notification
        │
        ▼
src/server/app-server/client.ts / events.ts
        │
        ▼
MobileTimelineItem / BrowserCodexEvent
        │
        ▼
src/web/state/timeline.ts / store.ts
        │
        ▼
src/web/components/Timeline.tsx
```

旧 change `improve-mobile-timeline-activity` 已证明两个事实：底层 timeline 不能按 role rank 把 activity 提前；真实 Codex App 的 read/run/load 活动需要更准确的数据语义。这个 change 在此基础上单独收敛 UI 和数据模型：废弃面向用户的 `ActivityBlock` 概念，改为 Codex App 风格的 `InlineActivityLog`。

## Goals / Non-Goals

**Goals:**

- 移动端 timeline 中不再出现 `Activity` 标题、厚卡片、蓝色左边框或卡片式活动容器。
- 活动按真实顺序穿插在 assistant 消息之间，且只合并连续活动 entry。
- 活动标题使用具体摘要，例如 `Loaded 4 tools`、`已读取 2 个文件已运行 1 条命令`、`Files changed · 1 · +37 -0`。
- 短明细默认可见，包括 Skill/工具读取、文件读取、搜索、短命令名、简短工具动作。
- 长输出、diff 内容、长 JSON、完整命令日志仍可展开查看，保证可追踪性。
- 数据层区分 ownerless `skills_changed` 缓存失效和 turn-scoped runtime activity，避免误显示。
- 测试覆盖旧 `Activity` 文案消失、内联日志顺序、短明细默认展示、长详情折叠和数据去重。

**Non-Goals:**

- 不做桌面端布局。
- 不重写 app-server 协议或事件幂等架构。
- 不伪造模型未公开的隐藏 reasoning 内容。
- 不把 diff 做成可采纳、回滚或编辑的交互。
- 不把 ownerless Skills 文件变化强行归属到当前 thread。

## Decisions

### 1. 用 `InlineActivityLog` 替代 `ActivityBlock`

当前 `ActivityBlock` 的抽象问题不在视觉小样式，而在产品语义：它把活动变成一个独立卡片模块，并用 `Activity` 作为泛化标题。新模型应将活动视为消息流中的辅助日志：

```text
TimelineEntry[]
   │
   ▼
TimelineRenderBlock[]
   ├─ entry: user / assistant / system / error
   └─ inline-activity-log: 连续活动 entry 的轻量日志段
```

渲染层仍可派生 block，但 block 的用户可见语言必须是具体活动，不是 `Activity`。替代方案是继续保留 `ActivityBlock` 并调轻样式；这会继续暴露错误标题和错误层级，因此不选。

### 2. 只合并连续活动，不跨 assistant 文本归桶

正确顺序模型是：

```text
assistant A
activity X
assistant B
activity Y
assistant C
```

而不是：

```text
activity X + Y
assistant A + B + C
```

store 归一化和 render block 派生都必须保留 app-server/history/live 的相对顺序。合并规则只允许把相邻且同 turn 的 activity entries 合成一个 inline log，不允许跨过 agent-message、user-message、system/error 等非活动 entry。

### 3. 摘要标题由具体活动语义生成

`InlineActivityLog` 不显示统一标题。它根据 entries 生成一条具体标题：

```text
Loaded 4 tools
已读取 2 个文件已运行 1 条命令
Files changed · 3 · +42 -18
Thinking
```

优先级建议：

1. 只有 tool/skill loading：`Loaded N tools`
2. read/list/search/command 混合：中文组合标题，例如 `已读取 N 个文件已搜索代码已运行 M 条命令`
3. diff/fileChange：`Files changed · N · +A -R`
4. reasoning：`Thinking...` / `Thinking`
5. 其他工具：`Used N tools` 或具体 tool 名

标题不是唯一信息来源，短明细必须默认显示。

### 4. 短明细默认可见，长详情才折叠

Codex App 的关键体验是用户不用展开就能看见“读取了什么”。因此默认可见内容应包括：

- `读取 Receiving Code Review 技能`
- `Read spec.md`
- `Searched src/web`
- `已运行 npm test`
- `Files changed · src/web/components/Timeline.tsx · +12 -4`

以下内容进入展开详情：

- 命令完整 stdout/stderr
- unified diff
- 长 JSON 参数或结果
- 长路径、cwd、完整 raw response fallback
- 大段 reasoning 文本

折叠态不是“隐藏所有详情”，而是“隐藏长详情”。替代方案是 App 一样全部裸露，但在手机上长命令和 diff 会淹没正文，因此只裸露短明细。

### 5. 数据语义拆分为 runtime activity 与 cache invalidation

`skills/changed` 在生成协议里是 watched local skill files changed 的缓存失效信号，不等于 turn 中 runtime 加载工具。实现必须把二者拆开：

```text
ownerless skills_changed
  └─ skills picker cache invalidation only

thread/turn scoped runtime loading/read/run item
  └─ InlineActivityLog visible row
```

如果 app-server 只提供 ownerless `skills_changed`，前端不得显示 `Loaded tools`。如果 thread item、raw response 或 live notification 明确给出 Skill/工具加载或读取动作，才渲染为内联日志。

### 6. 保留底层 `TimelineEntry[]` 作为事实源

`InlineActivityLog` 只存在于渲染派生层，不写回 store 为新的持久 entry。底层仍保存 `reasoning`、`tool`、`command`、`diff`、`agent-message` 等 entry。这样 rewind、fork、snapshot repair、generation、revision、event id 去重可以沿用现有事实源。

### 7. 测试先反转旧期望

这次重构必须先写能失败的测试来固定新方向：

- `Activity` 文案不再出现。
- Skills/tool loading 组显示 `Loaded N tools` 和逐行 `读取 X 技能`。
- read/search/run 组显示组合标题和默认明细。
- assistant/activity/assistant/activity 顺序保持穿插。
- ownerless `skills_changed` 只失效缓存，不显示日志。
- 长命令输出和 diff 默认不裸露，但展开可见。

## Risks / Trade-offs

- [Risk] 过度追求 App 视觉导致现有测试大面积失效 → Mitigation：先按新规范改测试，明确旧 `ActivityBlock` 期望是被废弃行为。
- [Risk] app-server 当前没有暴露某些 Codex App activity 数据源 → Mitigation：UI 支持已有语义；数据缺失时不伪造，任务中保留真实线程验证和数据源追踪。
- [Risk] 短明细默认可见可能让长 turn 变高 → Mitigation：只默认展示短动作，长输出、diff、JSON 内部折叠；必要时对同类明细设置移动端软上限并显示剩余数量。
- [Risk] ownerless Skills 事件被误归属 → Mitigation：明确只有可靠 thread/turn 归属且代表 runtime activity 的事件才可见。
- [Risk] 活动合并影响滚动锚点或跳到最新 → Mitigation：render block id 基于底层 entry id 范围生成，底层 entry 顺序不变。

## Migration Plan

1. 用失败测试固定 `Activity` 卡片被移除、内联日志默认明细和顺序穿插。
2. 重构 timeline 派生函数：从 `activity` block 改为 `inline-activity-log` block。
3. 新增 activity 语义摘要与短明细生成函数，覆盖 Skills/tool loading、read/list/search、command、diff、reasoning 和 fallback。
4. 调整 store/event 转换，确保 runtime activity 和 cache invalidation 不混淆。
5. 替换移动端样式并删除用户可见的 `Activity` 文案。
6. 跑相关单测、`npm run verify`、`npm run build`，再部署 Docker 给手机实测。
7. 回滚策略：若新渲染有严重问题，可在渲染层临时回退到逐 entry 卡片；底层 timeline 数据结构不迁移。

## Open Questions

- Codex App 的 `Loaded N tools` 是否总是指 Skill/tool instruction source files，还是也包括 MCP/dynamic tool schemas？实现时应根据真实 ThreadItem/raw response 样本确认。
- 短明细默认展示是否需要数量上限，例如超过 6 行后显示 `还有 N 项`？第一版建议不预设硬上限，先以真实手机验证为准。
- `Thinking` 是否也完全低强调内联，还是保留轻微可展开行？建议用内联行，但长 reasoning 文本进入展开详情。
