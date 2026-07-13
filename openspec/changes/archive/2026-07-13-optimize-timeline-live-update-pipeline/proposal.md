## Why

当前 timeline 虽已统一到 timeline engine 并具备窗口化渲染，但高频流式 delta 仍会逐条触发 store 提交、全量归一化和可见区域派生；长会话中这会放大为近似二次扫描，并造成移动端主线程抖动。与此同时，事件账本截断、repair/rollback 后账本重置以及缺少稳定 item identity 的 fallback 路径，仍可能让重放事件或乐观消息产生重复、错拼接或额外修复。

## What Changes

- 将 `codex-event-batch` 和短时间窗口内的同 item delta 聚合为一次 timeline engine 输入与一次 store 提交，避免协议 batch 在前端重新拆成逐事件更新。
- 保留 batch 内跨 item 的原始到达顺序，并由 timeline engine 原生处理文本 delta；store 不再手工复制、拼接、排序或重新构造完整 snapshot。
- 为 live delta 增加按 `threadId + generation + itemId + revision/sequence` 的稳定合并边界；缺少服务端 itemId 时使用 turn scoped identity，禁止跨 turn 复用 fallback live entry。
- 将常见 append/update 路径改为增量 upsert 和增量索引维护，仅在 snapshot、pagination、repair、rollback/fork 等结构变化时执行全量归一化与排序。
- 加固 event/revision ledger：repair 与 rollback/fork 后仍保留可证明安全的去重边界，并按 generation/时间窗口淘汰，避免简单 FIFO 截断后旧事件重放。
- 缩小 timeline 渲染派生范围，并让未变化的 row、activity section、Markdown/diff/长文本派生结果在无关 delta 下复用。
- 将 snapshot、pagination、turn item detail 和 live event 的 source order 收敛为 engine 的统一排序输入，移除 adapter/page helper 对 activity 的权威重排。
- 增加复杂度与正确性预算测试，覆盖长会话高频 delta、batch 提交次数、跨 turn fallback identity、repair 后重放和可见行重渲染。
- 不改变 app-server 协议、不新增数据库、不改变移动端 timeline 的视觉与滚动语义。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `timeline-event-stream`: 要求批事件和同 item 高频 delta 以有界提交进入统一 engine，稳定处理 generation、revision、sequence、repair/rollback 后重放与 fallback identity，保证消息不重复且不跨 turn 错拼接。
- `thread-chat-view`: 要求长会话 live 更新只触发必要的 timeline slice 更新，并保持 store 提交次数、全量归一化次数和可见窗口派生工作量有界。
- `agent-output-rendering`: 要求未变化的 timeline row 和长内容派生结果在其他 entry 流式更新时复用，避免重复 Markdown、diff、tool result 和 activity section 处理。

## Impact

- Timeline engine 与状态：`src/web/state/timeline-engine.ts`、`src/web/state/store.ts`、`src/web/state/timeline.ts`。
- 实时事件入口：`src/web/events/client.ts`、`src/web/components/AppProviders.tsx` 及 WebSocket/SSE batch 消费路径。
- Timeline 渲染：`src/web/components/Timeline.tsx`、`src/web/components/Markdown.tsx`、`src/web/components/cards/*`。
- 会话页订阅：`src/app/threads/[threadId]/page.tsx`。
- 测试：扩展 timeline engine、store events、events client、thread page 和 timeline rendering 的去重、提交次数与复杂度预算用例。
- 外部 API 与依赖：无破坏性 API 变更，原则上不新增运行时依赖。
