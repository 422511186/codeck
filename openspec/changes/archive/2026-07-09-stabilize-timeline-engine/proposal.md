## Why

移动端会话页的 timeline 目前由历史 snapshot、SSE live event、服务端 overlay、rollout JSONL supplement、分页和 snapshot repair 多条路径共同写入，缺少单一且可证明幂等的归一化入口。实际使用中已经频繁出现消息重复、压缩消息重复、同一 turn 内事件顺序错乱、大会话卡顿，以及运行中输出无法自动流式更新而需要手动刷新。

这类问题继续用局部补丁修复会让规则更加分散；需要把 timeline 的身份、排序、幂等、repair 和有界读取契约收紧，并把实现重构为统一的 timeline engine。

## What Changes

- 建立统一的 timeline 输入归一化模型，让 snapshot、pagination、live event、overlay、turn items 补齐和 rollout supplement 都通过同一 reducer/upsert 规则进入前端 timeline。
- 用稳定身份替代文本包含作为主要去重依据，覆盖本地用户消息回显、agent/reasoning/tool live 与 completed 合并、压缩上下文系统消息、rollout supplement activity 等重复场景。
- 引入明确的同 turn 顺序模型，保留 user、steer、reasoning、tool、agent、diff、system/error 等 item 的真实顺序，不再把同一 turn 内所有 user message 统一提前。
- 收紧长会话读取策略：首屏、分页、repair 和 rollout supplement 都必须使用有界窗口，禁止因补充 context usage 或 activity 而读取/解析完整历史。
- 强化运行中流式收敛：SSE live event 是主路径；listener 空窗、batch 溢出、completion 无可见输出和 reconnect gap 必须归属到具体 thread 并触发有界 repair，不能静默丢事件或要求用户手动刷新。
- 对 timeline store 和渲染订阅做性能隔离，避免高频 delta、大会话分页和 repair 触发整页重算或全量 DOM/Markdown 工作。

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `thread-chat-view`: 收紧首屏、分页、snapshot repair、rollout supplement 和渲染窗口的有界读取与性能要求，并要求运行中输出无需手动刷新即可收敛。
- `timeline-event-stream`: 收紧 live event 幂等、listener 空窗、batch 溢出、gap repair、generation 和稳定身份合并要求。
- `agent-output-rendering`: 收紧 agent/reasoning/tool/diff/压缩消息的去重、排序和长内容默认 DOM 预算要求。
- `timeline-message-actions`: 收紧消息级 rewind/fork 所依赖的 turn 身份和同 turn 顺序要求，避免重复或错序 entry 破坏尾部 turn 计算。

## Impact

- 前端状态：`src/web/state/store.ts`、`src/web/state/timeline.ts`，新增或抽出统一 timeline engine/reducer 模块。
- 前端事件流：`src/web/events/client.ts`、`src/web/components/AppProviders.tsx`。
- 会话页：`src/app/threads/[threadId]/page.tsx`，包括首屏读取、分页、repair、滚动锚点和订阅粒度。
- Timeline 渲染：`src/web/components/Timeline.tsx`、`src/web/components/Markdown.tsx`、`src/web/components/cards/*`。
- 服务端适配层：`src/server/app-server/runtime.ts`、`src/server/app-server/client.ts`、`src/server/app-server/events.ts`、`src/server/app-server/session-timeline.ts`。
- API routes：`src/app/api/codex/threads/[threadId]/route.ts`、`src/app/api/codex/threads/[threadId]/turns/route.ts`、`src/app/api/codex/events/route.ts`。
- 测试：需要新增 timeline engine 纯函数测试、store/event-stream 一致性测试、长会话有界读取测试、重复消息/压缩消息回归测试、同 turn 顺序测试和运行中自动流式更新测试。
