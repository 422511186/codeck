## 1. 测试先行

- [x] 1.1 在 `tests/unit/codex-client.test.ts` 添加失败用例：`thread/read` 第一次带 `includeTurns: true` 抛出未 materialized 错误时，`readThread()` 会重试不带 `includeTurns` 并返回空 `timeline`、`lastTurnId: null`
- [x] 1.2 在同一测试中断言普通 `readThread()` 路径仍只调用一次 `thread/read` 且保留 `includeTurns: true`
- [x] 1.3 在 `tests/unit/web-thread-page.test.tsx` 或现有项目页流程测试中添加用例：从项目目录新建空会话后进入详情页，不显示错误页，输入框可发送第一条消息
- [x] 1.4 添加 `turn/start` 后立即读取详情遇到未 materialized 错误时仍返回可用详情的覆盖，确保 `/api/codex/turns/start` 不因短暂状态失败
- [x] 1.5 在 `tests/unit/web-markdown.test.tsx` 添加代码块主题测试：fenced code block 的 `.hljs`/`code` 不应固定暗色背景，背景应由外层主题 token 控制
- [x] 1.6 在 `tests/unit/web-markdown.test.tsx` 添加复制按钮测试：按钮存在、文字可见、点击后显示 `已复制`，并使用主题 token 样式

## 2. 服务端适配层实现

- [x] 2.1 在 `src/server/app-server/client.ts` 增加小范围错误识别 helper，仅匹配包含 `not materialized yet` 与 `includeTurns` 的错误
- [x] 2.2 调整 `CodexAppServerClient.readThread()`：优先按现状请求 `thread/read` + `includeTurns: true`，命中特定错误时重试不带 `includeTurns`
- [x] 2.3 确保降级返回的 thread 在进入 `threadDetail()` 前拥有 `turns: []` 语义，避免 metadata-only 响应缺少 turns 字段导致二次异常
- [x] 2.4 保持 `readThreadGoal(threadId)` 的现有行为，不吞掉 goal 相关错误，避免扩大本次变更范围

## 3. Markdown 代码块主题修复

- [x] 3.1 调整 `src/web/components/Markdown.tsx` 的 highlight.js 样式策略，移除或覆盖会固定代码块背景的 `github-dark.css`
- [x] 3.2 确保 fenced code block 的 `<pre>`、内部 `<code>`、`.hljs` 背景和文字颜色跟随 `--cw-code-bg`、`--cw-code-fg`、`--cw-code-border`
- [x] 3.3 调整复制按钮样式，使用主题 token，保证明亮和暗黑主题下按钮边框、背景、文字和成功状态都清晰可见
- [x] 3.4 保持移动端横向滚动体验，代码块右上角复制按钮不得导致代码文本遮挡或布局抖动

## 4. 前端流程确认

- [x] 4.1 确认 `src/app/threads/[threadId]/page.tsx` 首屏加载可以接受空 `timeline` 与 `lastTurnId: null`，无需引入新的页面状态
- [x] 4.2 确认项目页 `startNewThread()` 后跳转 `/threads/{threadId}` 的路径不需要额外绕过 `readThread`
- [x] 4.3 如测试暴露空会话渲染缺口，仅做最小 UI 调整，保持移动端现有布局和交互

## 5. 验证

- [x] 5.1 运行 `npm run typecheck`
- [x] 5.2 运行相关测试：`npx vitest run tests/unit/codex-client.test.ts tests/unit/web-thread-page.test.tsx tests/unit/web-markdown.test.tsx`
- [x] 5.3 运行 `openspec validate handle-unmaterialized-empty-threads`
- [x] 5.4 启动移动端 Web 并用浏览器检查手机视口下明亮主题代码块：背景跟随主题、复制按钮清晰可见
- [x] 5.5 切换暗黑主题并用浏览器检查手机视口下代码块：背景跟随主题、复制按钮清晰可见、复制成功状态可读
- [x] 5.6 记录验证结果，并确认新建空会话、已有历史会话读取、发送第一条消息、Markdown 代码块主题四条路径均符合 spec

验证记录：

- 手机视口 `390x844` 下，明亮主题代码块 computed background 为 `rgb(246, 248, 250)`，匹配 `--cw-code-bg: #f6f8fa`；复制按钮 background 为 `rgba(255, 255, 255, 0.92)`，文字为 `rgb(14, 15, 18)`，边框为 `rgb(209, 213, 219)`。
- 手机视口 `390x844` 下，暗黑主题代码块 computed background 为 `rgb(13, 17, 23)`，匹配 `--cw-code-bg: #0d1117`；复制按钮 background 为 `rgba(20, 22, 28, 0.92)`，文字为 `rgb(244, 245, 247)`，边框为 `rgb(58, 61, 69)`。
- 暗黑主题点击复制按钮后显示 `已复制`，按钮背景、文字和边框仍使用主题 token；复制按钮最小高度为 `28px`，代码块保留 `overflow-x: auto` 和 `padding-right: 72px`。
