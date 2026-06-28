## Context

当前移动端 Web 的项目详情页在 `startNewThread()` 中调用 `codex.startThread({ cwd })`，随后直接跳转到 `/threads/{threadId}`。会话详情页首屏加载时调用 `codex.readThread(threadId)`，服务端适配层再调用 app-server 的 `thread/read` 并固定传入 `includeTurns: true`。

app-server 对刚由 `thread/start` 创建、但还没有第一条用户消息的 thread 会返回一个 thread shell。这个状态尚未 materialized，没有 rollout history；如果此时请求 `includeTurns: true`，app-server 会拒绝并返回 `thread ... is not materialized yet; includeTurns is unavailable before first user message`。因此新建空会话后，用户看到的是错误页，而不是可输入第一条消息的空会话。

另一个同批修复的问题在 agent Markdown 输出：`src/web/components/Markdown.tsx` 引入了 `highlight.js/styles/github-dark.css`，该样式会给 `.hljs` 类设置暗色背景。组件外层 `<pre>` 虽然使用了 `var(--cw-code-bg)`，但高亮样式仍可能覆盖内部 `<code>` 的背景，导致浅色主题下出现黑色代码块；复制按钮覆盖在黑色区域上时边界和文字也不够清楚。移动端 Web 已有 `tokens.css` 主题 token，代码块和复制按钮应统一依赖这些 token。

相关约束：

- 移动端 Web 的外部 HTTP API 应继续返回现有 `ThreadDetail` 形状。
- 正常已有历史的会话仍应一次性读取 timeline 和 goal。
- 这个问题属于 app-server 状态语义适配，不应把协议细节直接泄漏给前端页面。
- 本项目只做移动端 Web，代码块横向滚动、复制按钮命中区域和对比度都应以手机浏览器为目标。
- 主题支持自适应、明亮、暗黑三种模式，代码块不能硬编码只适合某一种模式的背景。

## Goals / Non-Goals

**Goals:**

- 允许未 materialized 的空 thread 被打开，显示空 timeline，并允许用户发送第一条消息。
- 保持已有会话读取体验不变：有 turns 的 thread 仍使用 `includeTurns: true` 读取完整详情。
- 将 app-server 的特定错误集中封装在服务端适配层，减少前端页面对协议错误文案的依赖。
- 让 Markdown fenced code block 和复制按钮完全跟随主题 token，在浅色和暗黑主题下均可读、可复制。
- 消除第三方 highlight.js 主题对代码块容器背景的固定暗色覆盖。
- 覆盖项目页新建空会话、直接打开空会话、以及发送第一条消息后刷新详情的测试场景。
- 覆盖 Markdown 代码块主题渲染与复制按钮可见性的测试场景。

**Non-Goals:**

- 不改变 `thread/start` 的产品流程为“发送第一条消息时才创建 thread”。
- 不新增数据库或本地持久化机制来保存空会话详情。
- 不重构 timeline 分页、WebSocket 实时事件或完整 thread lifecycle。
- 不改变 app-server 协议或生成的协议类型文件。
- 不重新设计整套语法高亮配色表；本次只保证容器、基础文字、边框、按钮和高亮背景不破坏主题可读性。
- 不新增桌面端专用布局。

## Decisions

### Decision 1: 在 `CodexAppServerClient.readThread` 中做协议错误降级

`readThread` 仍优先调用 `thread/read` 且传入 `includeTurns: true`。如果 app-server 返回的错误同时表明 thread 未 materialized 且 `includeTurns` 在第一条用户消息前不可用，则适配层重新调用 `thread/read`，这次不传 `includeTurns`，并把返回的 thread metadata 组合成现有 `MobileThreadDetail`，其中 `timeline` 为空、`lastTurnId` 为 `null`。

选择这个位置的原因：

- 所有入口都会经过服务端适配层，包括详情页首屏、运行中轮询、以及 `turn/start` 后的详情刷新。
- 前端页面无需理解 app-server 的英文错误文案，也无需为某个特定创建路径写特殊逻辑。
- 正常已 materialized 的 thread 不受影响，仍走当前最快路径。

备选方案：

- 只在项目页新建后把 `thread/start` 返回值塞进前端状态，跳过首屏读取。这个方案能修新建路径，但直接打开空 thread URL 或刷新页面仍会失败。
- 改成“先输入消息再创建 thread”。这更贴近 app-server 的 materialization 语义，但会改变现有移动端交互和任务范围。

### Decision 2: 保持 `ThreadDetail` 形状稳定，用空 timeline 表达空会话

降级后的详情仍使用 `threadDetail()` 的输出形状：`id`、`title`、`preview`、`cwd`、`status`、`updatedAt`、`timeline`、`lastTurnId` 和 `goal` 均照常返回。唯一差异是没有 turns 时 `timeline: []`，`lastTurnId: null`。

这样前端可以复用已有空 timeline 渲染和 `ChatInput`，无需引入新的 `emptyThread` 页面状态。

### Decision 3: goal 读取失败不纳入本次变更

现有 `readThread` 会并行请求 `thread/read` 和 `thread/goal/get`。本次只处理 `thread/read(includeTurns)` 对未 materialized thread 的特定错误。`thread/goal/get` 的降级策略仍保留为既有 open question，不在本 change 中扩大范围。

### Decision 4: 代码块主题由应用 token 兜底，第三方高亮不得设置容器背景

Markdown fenced code block 的 `<pre>`、内部 `<code>`、`.hljs` 以及 highlight token 背景都应显式继承或使用 `transparent`，由外层组件的 `var(--cw-code-bg)`、`var(--cw-code-fg)`、`var(--cw-code-border)` 控制整体视觉。复制按钮使用应用已有的 `var(--cw-bg-overlay)`、`var(--cw-fg)`、`var(--cw-border-strong)` 等 token，并保留 hover/pressed 或 copied 状态的可见变化。

优先考虑两种实现路线：

- 移除 `github-dark.css`，改用自定义最小 `.hljs-*` token 覆盖，避免第三方主题固定背景。
- 如果保留 highlight.js 主题导入，则在应用 CSS 中用 `.cw-markdown pre .hljs` 等选择器强制 `background: transparent`、`color: inherit`，并覆盖可能影响可读性的 token 背景。

推荐第一种或强约束覆盖后的第二种，核心标准是截图中的浅色主题不得再出现黑色代码块，暗黑主题下也不得出现白底或看不清的复制按钮。

## Risks / Trade-offs

- [Risk] 错误匹配依赖 app-server 当前英文文案。→ Mitigation: 匹配应限定为 `not materialized yet` 和 `includeTurns` 两个关键信号，避免吞掉无关错误；测试覆盖该分支。
- [Risk] 降级会多发一次 `thread/read` 请求。→ Mitigation: 只在空 thread 的错误路径触发，正常会话无额外请求。
- [Risk] 未 materialized thread 返回的 metadata 可能不含 `turns` 或 `turns` 为空。→ Mitigation: 适配层在组合详情前保证使用空数组语义，避免 `threadDetail()` 对 `thread.turns` 的假设导致二次异常。
- [Risk] `turn/start` 后立即 `readThread` 仍可能短暂遇到 materialization 延迟。→ Mitigation: 同一个适配层降级会让请求返回当前可用 metadata；后续 WebSocket 或轮询仍可补上真实 timeline。
- [Risk] 移除或覆盖 highlight.js 主题后，语法高亮颜色可能变得更朴素。→ Mitigation: 本次优先保证主题一致和可读性；保留少量 token 颜色即可，不追求完整 IDE 级高亮。
- [Risk] 复制按钮绝对定位可能遮挡较短代码或横向滚动内容。→ Mitigation: 保留代码块右上角按钮，但确保代码块内边距给按钮留出空间，移动端横向滚动仍可操作。
- [Risk] CSS 测试无法完全证明视觉对比度。→ Mitigation: 结合 DOM/style 单测与后续浏览器截图验证浅色/暗黑主题的实际效果。

## Migration Plan

实现时先添加失败测试，复现 `thread/read(includeTurns)` 抛出未 materialized 错误时当前行为失败；再实现适配层降级；同时添加 Markdown 代码块主题测试，复现 `.hljs` 暗色背景覆盖和复制按钮不易辨认的问题；最后补充页面流程和视觉验证，确认从项目目录新建空会话后可以进入详情页并发送第一条消息，且代码块在浅色/暗黑主题下都跟随主题。

部署无需数据迁移。若出现回归，可回滚服务端适配层变更；外部 HTTP API 形状未改变。

## Open Questions

- 是否应在未来单独处理 `thread/goal/get` 对新建空 thread 的失败降级，让 goal 缺失时仍能显示 thread？当前不纳入本次变更。
- 是否需要在 UI 上为完全空的会话显示“开始对话”的轻量提示？当前不纳入本次变更，保持现有移动端界面简洁。
- 是否需要未来为不同语言提供更完整的主题化语法高亮色板？当前不纳入本次变更。
