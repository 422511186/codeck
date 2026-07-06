## Context

当前会话页 header 只显示返回、会话名、Plan/Build 和更多菜单。服务端事件归一化层已经把 `thread/tokenUsage/updated` 映射为浏览器事件，事件包含 `totalTokens`、`inputTokens`、`outputTokens`、`reasoningOutputTokens` 和 `modelContextWindow`，但前端 store 尚未保存或展示这些字段。

这个变更只面向手机会话页，目标是给用户一个持续、低打扰的上下文窗口占用信号。显示应尽量依附现有 sticky header，避免侵占 timeline 和 composer。

## Goals / Non-Goals

**Goals:**

- 在 header 下方显示上下文窗口占用进度线和百分比。
- 复用现有实时 token 用量事件，不新增 app-server 协议。
- 按 `threadId` 缓存最近一次已知用量，刷新后可从会话详情或本地缓存恢复最近状态。
- 点击进度区域查看用量明细，并可从详情中发起现有“压缩上下文”确认流程。
- 用颜色表达不同占用区间，不弹提示、不自动触发压缩。

**Non-Goals:**

- 不做跨设备或新增服务端持久化的历史 token 用量恢复。
- 不新增账单、账号用量或每日 token 统计展示。
- 不改变 `thread/compact/start` 的后端行为。
- 不在没有 `modelContextWindow` 时估算窗口大小。

## Decisions

1. **用前端 store 保存线程级上下文用量。**
   - 选择：在 `ThreadState` 中增加可选的 `contextUsage`，由 `token_usage_updated` 事件更新。
   - 原因：事件已经按 `threadId` 到达 store，UI 可直接订阅线程状态，不需要 page 层维护额外派生状态。
   - 替代方案：只在页面组件 `useState` 中保存。该方案会让事件处理、缓存和 UI 分散，不利于测试。

2. **用会话详情和 `localStorage` 做最近一次已知用量恢复。**
   - 选择：新增 `src/web/storage/contextUsage.ts`，按 `threadId` 保存纯数据对象。
   - 选择：服务端读取会话详情时，从 rollout JSONL 的最近 `token_count` 记录恢复 `contextUsage`；前端收到后写入 store 和本地缓存。
   - 原因：符合已有 `drafts`、`settings` 和 `localStore` 模式；同时解决首次刷新页面错过实时事件时只显示 `--%` 的问题。
   - 替代方案：只依赖实时事件和前端缓存。该方案在用户刷新老会话或首次打开会话时无法显示数字。

3. **缺少用量或 `modelContextWindow` 时显示未知占位条。**
   - 选择：header 下方仍显示一条上下文区域，占位百分比为 `--%`，不可点击且不打开详情。
   - 原因：百分比必须有可靠分母；估算会误导用户。但完全隐藏会让用户误以为功能缺失，尤其是刷新老会话且本地尚无缓存时。

4. **颜色只反映阈值，不增加高用量提示。**
   - 选择：`<60%` 健康色，`60-80%` 琥珀色，`80-95%` 橙色，`>=95%` 红色。
   - 原因：用户明确选择低打扰模式；header 只负责状态表达。

5. **用最近一次请求用量计算窗口占比。**
   - 选择：实时事件优先使用 `tokenUsage.last`；rollout JSONL 恢复优先使用 `last_token_usage`，没有时才回退到累计 `total`。
   - 原因：`total_token_usage` 是整个会话累计消耗，可能远大于模型窗口；上下文窗口进度应表达最近一次请求进入模型窗口的 token 占用。

6. **详情面板复用现有压缩确认流程。**
   - 选择：详情中的“压缩上下文”关闭详情面板后打开现有确认对话框。
   - 原因：保持误触保护一致，避免一键执行破坏性操作。

## Risks / Trade-offs

- 本地缓存只代表“本设备最近一次已知值” → 在详情中避免声称是实时历史真相，新实时事件到达后立即覆盖。
- 如果用户在多设备或其他客户端压缩上下文，本地缓存可能短暂过期 → 后续 `token_usage_updated` 会修正；手动压缩完成后可保留现有系统消息，不主动伪造新用量。
- header 空间有限 → 进度线放在 header 下方独立小标签区域，标题行不新增常驻文本；未知状态也使用同一高度，避免布局跳动。
- UI 测试需要模拟 store 线程状态和点击详情 → 通过现有 `web-thread-page.test.tsx` 的 mock store 模式覆盖关键行为。
