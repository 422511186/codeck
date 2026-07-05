## Why

移动端会话 timeline 在带 Skill/图片的用户消息和运行时活动混合时会显示错误历史：同一次用户发送可能渲染成两条 user message，工具、命令、读取、搜索、Thinking 等活动也可能统一堆到最终 assistant 回复之后。审计日志显示重复用户消息不是 `turn/start` 双发，而是本地 optimistic entry、server user item、snapshot/JSONL repair 之间的确认、去重和排序规则不够稳定。

## What Changes

- 修复同一 turn 内 optimistic user message 与 server user item 的确认合并，优先按 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份匹配。
- 当 server user item 缺少 `skillReferences`、图片附件元数据或 `clientUserMessageId` 时，仍能确认同一 turn 的本地消息，并保留本地已展示的 Skill/图片附件。
- 同一 turn 中间夹有 reasoning、tool、command、runtime activity entries 时，重复 user message 仍 MUST 被合并，不依赖相邻去重。
- 修复同一 turn 内 runtime activity 的语义排序：JSONL/snapshot repair 补齐的工具、Thinking、读取、搜索、命令、文件活动不得统一追加到最终 assistant 回复之后。
- 增加回归测试覆盖两个用户可见场景：带 Skill/图片的用户消息确认后不重复；工具/Thinking 活动在最终回复前后按真实或可推断顺序穿插展示。

## Capabilities

### New Capabilities

### Modified Capabilities
- `timeline-message-actions`: 调整 server confirmation 与本地 user message 合并要求，覆盖 Skill/图片附件缺失、activity interleaving 和非相邻重复。
- `agent-output-rendering`: 调整同一 turn 内 inline activity 的补全和排序要求，避免 repair fallback 把工具活动坠到最终回复之后。
- `thread-chat-view`: 调整移动端会话 timeline 的语义顺序要求，确保 user、activity、assistant 在 live、completion、snapshot/JSONL repair 混合后稳定。

## Impact

- 前端 timeline store 与排序：`src/web/state/store.ts`、`src/web/state/timeline.ts`
- 会话页发送与本地 optimistic user message 创建：`src/app/threads/[threadId]/page.tsx`
- 移动端 timeline 渲染与 activity grouping：`src/web/components/Timeline.tsx`
- 服务端历史/JSONL 补全合并：`src/server/app-server/session-timeline.ts`
- 测试范围：`tests/unit/web-store-events.test.ts`、`tests/unit/web-timeline.test.tsx`、`tests/unit/app-server-runtime.test.ts` 或新增 session-timeline 专项测试
