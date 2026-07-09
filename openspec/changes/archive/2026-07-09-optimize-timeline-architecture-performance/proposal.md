## Why

当前 timeline 已经修复了多处一致性和局部性能问题，但数据链路仍由服务端 overlay、rollout supplement、会话页 repair 逻辑、Zustand store 和渲染组件分别执行归并、排序和裁剪。长会话、高频 delta、大工具输出或频繁 snapshot repair 下，这些重复工作会继续放大移动端主线程和 Node 端读取成本。

需要在继续扩展 timeline 功能前，把架构收敛到单一归一化路径，并把 rollout supplement、repair、分页和渲染窗口真正约束为有界工作。

## What Changes

- 将 timeline store 的多入口归并逻辑收敛到统一 timeline engine，减少 store/page/component 中并行的去重、排序、等价输出合并和 repair 重排规则。
- 将 rollout JSONL supplement 从“读取完整字符串后过滤”改为可降级的有界扫描/缓存策略，只补齐当前窗口、当前分页或目标 turn 范围。
- 将移动端 timeline 渲染从尾部初始裁剪升级为可回收的窗口化模型，避免用户长时间向上浏览后 DOM 持续增长。
- 为长文本 preview、diff rows 和 Markdown 渲染增加 entry 级派生缓存或等价机制，避免高频更新时重复处理完整大字符串。
- 收紧会话页订阅与 repair 编排边界，使 timeline delta、pagination 和 repair 不触发不相关 UI 状态重算。
- 保留现有协议语义、event id、generation、snapshot suppression、rewind/fork 安全边界和移动端视觉行为；不引入数据库或破坏性 API 变更。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `thread-chat-view`: 收紧 timeline 首屏、分页、snapshot repair、turn item 补齐和 rollout supplement 的有界处理要求，并明确移动端会话页订阅隔离与可回收窗口化行为。
- `timeline-event-stream`: 收紧 live event、repair、overlay、rollout supplement 和 completed item 进入统一 timeline engine 的要求，避免双轨归并和旧 batch 在 repair/rollback 后提交。
- `agent-output-rendering`: 收紧长 Markdown、diff、tool result、command output、reasoning 和 inline activity 详情的派生缓存与窗口化渲染预算。

## Impact

- 前端状态与事件消费：`src/web/state/store.ts`、`src/web/state/timeline-engine.ts`、`src/web/state/timeline.ts`、`src/web/events/client.ts`。
- 会话页编排与订阅：`src/app/threads/[threadId]/page.tsx` 及其拆分出的 timeline viewport/repair helpers。
- Timeline 渲染与卡片：`src/web/components/Timeline.tsx`、`src/web/components/cards/*`、Markdown/diff/long text 相关组件。
- 服务端 app-server 适配层：`src/server/app-server/runtime.ts`、`src/server/app-server/session-timeline.ts`、`src/server/app-server/client.ts`。
- 测试：扩展 timeline engine、store events、event stream、session timeline、thread page 和 timeline rendering 的长会话/高频更新预算测试。
