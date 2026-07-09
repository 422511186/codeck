## Why

timeline 已经具备增量读取、SSE 合并、运行时 overlay、JSONL supplement 和前端抑制/修复机制，但当前实现与既有规格仍有若干偏差：消息缺少相对时间、完成态修复会把仅有 tool 输出的 turn 误判为空、rollout supplement 对较大 JSONL 的处理不够有界，部分移动端渲染路径也存在可避免的全量扫描和长文本直出风险。

这批问题会影响用户对历史消息顺序、完成状态和移动端流畅度的信任，需要在继续扩大 timeline 功能前先收紧一致性与性能边界。

## What Changes

- 为 timeline 消息补齐每条消息的相对时间展示，并保持移动端布局稳定。
- 调整完成态修复判定：只在 turn 没有可见 agent/tool/reasoning/activity 输出时请求修复，不再因缺少 assistant message 而误修复 tool-only turn。
- 收紧 session rollout supplement 解析：按允许的 turn window 有界收集，避免先完整物化大批无关 JSONL 事件。
- 降低前端常见更新路径上的全量扫描开销，优先维护派生状态或缩小计算范围。
- 约束展开的 inline activity 长文本展示，避免大段内容直接撑爆移动端时间线。
- 不做协议级破坏性变更，不重构为全新的 timeline 存储架构。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `thread-chat-view`: 补齐消息相对时间展示，并明确 timeline 数据读取和移动端渲染的有界要求。
- `timeline-event-stream`: 修正完成态 repair 触发语义，避免对已有可见输出的 turn 发起无效修复。
- `agent-output-rendering`: 收紧 inline activity 展开内容的移动端渲染边界，避免未截断长文本影响性能和布局。

## Impact

- 前端组件与状态：`src/web/components/Timeline.tsx`、`src/web/state/store.ts`、`src/web/state/timeline-engine.ts`、`src/app/threads/[threadId]/page.tsx`。
- 服务端 timeline supplement：`src/server/app-server/session-timeline.ts` 及调用路径。
- 测试：补充或更新 `tests/unit/web-timeline.test.tsx`、`tests/unit/web-store-events.test.ts`、`tests/unit/app-server-session-timeline.test.ts` 等邻近用例。
- 规格：修改 `thread-chat-view`、`timeline-event-stream`、`agent-output-rendering` 的 delta spec。
