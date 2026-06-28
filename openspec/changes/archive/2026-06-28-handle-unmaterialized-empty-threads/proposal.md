## Why

移动端 Web 从已有目录创建新会话后会立即跳转到会话详情页，而详情页首屏读取会话时固定请求 `thread/read` 的 `includeTurns: true`。app-server 对刚通过 `thread/start` 创建、但尚未收到第一条用户消息的 thread 仍处于未 materialized 状态，此时读取 turns 会返回 `thread ... is not materialized yet; includeTurns is unavailable before first user message`，导致用户无法打开刚创建的空会话并发送第一条消息。

这个问题阻断了“从项目目录开始第一个会话”的核心路径，需要把空会话视为一等状态处理，而不是假设所有 thread 都已有 rollout history。

同时，agent 消息里的部分 Markdown 代码块在浅色主题下显示为黑色背景，复制按钮也因为背景和边框对比不足而难以辨认；暗黑主题下复制按钮也需要稳定可见。代码块是移动端阅读和复制命令的高频路径，应统一跟随应用主题 token，而不是被第三方高亮样式固定成某个配色。

## What Changes

- 新建或打开未 materialized 的空 thread 时，移动端 Web SHALL 能显示空 timeline 的会话详情，而不是把 app-server 的 `includeTurns` 限制暴露为错误页。
- `readThread` 适配层 SHALL 识别未 materialized 且 `includeTurns` 不可用的 app-server 错误，并降级读取 thread metadata，再返回空 timeline 和可发送消息的详情。
- 首屏加载、发送第一条消息后的刷新、以及轮询刷新 SHALL 保持一致的错误处理，不因短暂未 materialized 状态破坏用户流程。
- Markdown fenced code block 的背景、文字、边框和复制按钮 SHALL 全部跟随当前主题 token，在浅色和暗黑主题下都保持可读、可识别、可点击。
- 代码高亮样式 SHALL 不覆盖代码块容器的主题背景；复制按钮 SHALL 在暗黑主题下也清晰显示。
- 不引入 breaking change；外部 HTTP API 仍返回现有 `ThreadDetail` 形状。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-lifecycle`: 调整 thread read 行为，明确未 materialized 空 thread 的可读性和空 timeline 语义。
- `agent-output-rendering`: 调整 Markdown 代码块与复制按钮的主题适配要求，确保浅色/暗黑主题下可读可复制。

## Impact

- 影响 `src/server/app-server/client.ts` 中 `readThread` 对 `thread/read`、goal 和 timeline 的组合逻辑。
- 影响 `src/app/threads/[threadId]/page.tsx` 首屏加载和运行中刷新对空 thread 的体验，但无需改变路由结构。
- 可能影响 `src/app/api/codex/turns/start/route.ts` 在 `turn/start` 后立即读取 thread detail 的稳定性。
- 影响 `src/web/components/Markdown.tsx` 的 fenced code block 渲染、highlight.js 样式导入或覆盖策略，以及 `src/web/theme/tokens.css` 中代码块/按钮相关主题 token 的使用。
- 需要补充单元测试覆盖 `thread/read includeTurns` 对未 materialized thread 报错时的降级行为，以及项目页新建空会话后详情页可打开的流程。
- 需要补充 Markdown 渲染测试，覆盖代码块主题背景不被 `.hljs` 固定暗色覆盖，以及复制按钮在浅色/暗黑主题下具备可识别样式。
