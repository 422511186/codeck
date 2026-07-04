## Why

当前移动端会话 timeline 已能显示正文、推理、工具调用和文件变更，但信息层级仍偏“事件原样堆叠”：Thinking 标题与目标体验不一致，工具/bash/read/search/file change 的摘要分散，Skills 加载事件没有进入可见活动流，也不会驱动技能缓存刷新。用户在手机上阅读长 turn 时，很难快速分辨 agent 正文、思考状态、工具活动和最终结论。

这次变更将把消息区调整为更接近 Codex App / Trae 的移动端活动时间线：正文保持可读，运行活动被压缩成清晰、可展开、可追踪的活动摘要，同时补齐 Skills 加载事件链路。

## What Changes

- 将推理卡片标题从「推理过程 / 思考中…」改为 `Thinking / Thinking...`，并保持默认折叠与运行中状态。
- 引入 turn 内活动分组呈现：连续 Thinking、工具调用、shell/bash、read/list/search、文件变更和验证结果应聚合成轻量活动区，而不是全部以同等重量挤压正文。
- 为 shell/bash、read/list/search、文件变更等常见动作提供移动端摘要行；展开后仍可查看原始命令、输出、路径、diff 或调用详情。
- 将 Skills 加载/变更事件从 app-server 通知链路转换为前端可消费事件，用于显示轻量活动或刷新技能选择器缓存。
- 优化预览文本和路径展示：默认使用短相对路径/文件名，Markdown 标记不应泄漏到折叠预览中，冗长元数据放入展开内容。
- 保持现有 SSE timeline 幂等、repair、generation 规则，不因为活动分组引入重复渲染或丢事件。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `agent-output-rendering`: 修改 agent 输出在移动端 timeline 中的折叠、分组、标题和摘要规则。
- `timeline-event-stream`: 补齐 Skills 加载/变更通知到浏览器事件流的归一化与幂等消费要求。
- `plugin-mcp-skills`: 补齐 Skills 变更通知对技能选择器缓存和 timeline 可见活动的要求。

## Impact

- 影响服务端 app-server 事件适配层：`src/server/app-server/events.ts`、`src/server/app-server/client.ts`。
- 影响浏览器事件消费和状态归并：`src/web/events/client.ts`、`src/web/state/store.ts`、`src/web/state/timeline.ts`。
- 影响 timeline UI 与卡片组件：`src/web/components/Timeline.tsx`、`src/web/components/cards/ReasoningCard.tsx`、`src/web/components/cards/ToolCard.tsx` 以及相关 activity/diff 渲染组件。
- 影响 Skills picker 缓存失效与用户消息 Skill 引用展示：`src/web/components/ChatInput.tsx` 及相关 API 缓存逻辑。
- 需要补充单元测试覆盖事件转换、store 归并、timeline 渲染、Skills 变更事件和移动端摘要显示。
