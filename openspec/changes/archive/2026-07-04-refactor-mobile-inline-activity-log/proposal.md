## Why

当前移动端 timeline 的活动展示偏离 Codex App：Web 使用 `Activity` 厚卡片和泛化摘要，把活动作为独立卡片模块渲染；Codex App 则把工具、读取、命令、Skill 加载等活动作为低强调的内联日志穿插在 assistant 消息之间。继续微调现有 `ActivityBlock` 会把错误方向固化，因此需要单独新开 change 做一次面向 Codex App 风格的重构。

## What Changes

- **BREAKING** 移除移动端 timeline 中面向用户的 `Activity` 卡片概念，改为 Codex App 风格的内联活动日志。
- 活动日志标题必须使用具体动作摘要，例如 `Loaded 4 tools`、`已读取 2 个文件已运行 1 条命令`、`Files changed · 1 · +37 -0`，不能用泛化的 `Activity` 标题。
- 短明细默认可见，例如 `读取 Systematic Debugging 技能`、`Read spec.md`、`已运行 npm test`；长输出、diff、长 JSON 和完整命令日志才进入展开详情。
- 活动日志只合并连续活动，并按真实事件顺序穿插在 assistant 消息之间；不得跨 assistant 文本把整段 turn 的活动集中堆到用户消息下方。
- 区分 Skills 缓存失效和运行时工具/Skill 加载活动，不能把 ownerless `skills_changed` 误渲染为 `Loaded tools`。
- 重构 timeline 渲染派生模型，将当前 `ActivityBlock` 样式替换为 `InlineActivityLog` 类似的低强调日志组件与语义摘要层。
- 补充移动端视觉、单元测试和真实线程验证，确保 Web 与 Codex App 的信息层级和顺序模型一致。

## Capabilities

### New Capabilities

### Modified Capabilities

- `agent-output-rendering`: 移动端 agent 输出中的活动展示从 activity card 改为 Codex App 风格的内联活动日志，并明确默认可见明细、折叠规则、视觉层级和顺序要求。
- `timeline-event-stream`: timeline 事件流需要区分缓存失效、运行时活动、历史 item 和 live notification，并为内联活动日志提供稳定的语义、顺序和去重基础。

## Impact

- 影响 `src/web/components/Timeline.tsx` 及其派生渲染模型，当前 `ActivityBlock` 方向需要被替换。
- 影响 `src/web/state/timeline.ts`、`src/web/state/store.ts` 中活动 entry 的语义、合并、排序和去重规则。
- 影响 `src/server/app-server/events.ts`、`src/server/app-server/client.ts` 中 ThreadItem、raw response、commandExecution、fileChange、MCP/dynamic tool、Skill/工具加载等活动的归一化。
- 影响 timeline 相关单元测试与移动端手动验证；旧的 `Activity` 文案、卡片样式和“全部工具活动汇总到用户消息后”的测试期望需要改写。
- 不引入新第三方依赖，不改变桌面端布局；本项目继续只面向移动端 Web。
