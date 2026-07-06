## Why

移动端会话输入区现在有三类阻塞体验的问题：图片只能单选且再次选择会替换旧图；引用 Skill 发送后，服务端快照可能覆盖本地上下文，导致 timeline 不再显示 Skill chip；输入内容变多后 composer 高度超过固定预留空间，会遮挡上方 timeline 的最新消息。

这些问题都集中在 `chat-input-area` 的待发送上下文、发送后 timeline 呈现和底部输入区布局协同上，适合在同一个小变更中修复。

## What Changes

- 图片入口支持一次选择多张图片，并允许本次消息累积多张待发送图片。
- 多张图片沿用现有上传接口逐张上传，发送时通过既有 `imagePaths[]` 一起提交。
- 发送引用 Skill 的消息后，即使服务端返回的用户消息快照不带 Skill 引用，timeline 也必须继续显示本地选择过的 Skill chip。
- composer 高度随文本、图片和 Skill 上下文变化时，timeline 底部留白和“跳到最新”按钮位置必须跟随实际高度更新，避免最后消息被遮挡。
- 补充覆盖上述行为的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `chat-input-area`: 修改图片选择数量、待发送上下文保留、发送后 Skill 展示和动态底部留白要求。

## Impact

- 前端组件：`src/web/components/ChatInput.tsx`、`src/app/threads/[threadId]/page.tsx`、`src/web/components/Timeline.tsx` 如有必要。
- 状态与 timeline 合并：复用或补强 `src/web/state/store.ts` / 页面快照应用逻辑，确保本地发送上下文不会被不完整快照覆盖。
- API：不新增后端上传接口；继续使用 `POST /api/codex/uploads/images` 和 `imagePaths[]`。
- 测试：更新 `tests/unit/web-chat-input.test.tsx`、`tests/unit/web-thread-page.test.tsx`，必要时补充 store/timeline 单测。
