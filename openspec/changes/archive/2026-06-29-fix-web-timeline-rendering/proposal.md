## Why

远端 Web 会话当前没有稳定展示 agent 执行过程：命令、探索类工具事件和推理流可能缺失或被 UI 隐藏；同时 Linux 服务端上传的图片路径会被前端误当作 Web URL，导致远端浏览器无法预览图片。现在已经进入远端移动端使用场景，这些缺陷会直接破坏会话可观察性和图片消息可用性。

## What Changes

- 补齐 Web timeline 对 app-server 历史 item 和实时 notification 的展示契约，避免命令执行、进程输出、协作/探索工具调用和相关完成事件被静默丢弃。
- 调整推理卡片行为：实时推理文本到达后，即使 turn 仍在运行，也必须可见或可展开查看，而不是只显示“思考中…”。
- 修复 running 会话中的全量 thread snapshot 覆盖问题，保证 WebSocket 流式增量以追加方式持续可见。
- 减少打开会话和 running polling 的重复请求，避免首屏 `readThread` 后立即再次读取同一会话。
- 修复上传图片预览路径判断：Linux/POSIX 绝对本地路径必须通过 `/api/codex/images/preview` 读取，不得被当作浏览器 URL 直接请求。
- 增加覆盖历史读取、WebSocket 增量、推理运行态和 Linux 上传图片预览的测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-output-rendering`: 明确命令、工具、探索/协作事件和实时推理内容在 timeline 中的可见性要求。
- `thread-chat-view`: 明确用户上传图片在远端浏览器中必须通过服务端预览接口展示，包括 Linux/POSIX 绝对路径。

## Impact

- 后端 app-server 适配层：`src/server/app-server/client.ts`、`src/server/app-server/events.ts`。
- 前端 timeline 状态与卡片：`src/app/threads/[threadId]/page.tsx`、`src/web/state/timeline.ts`、`src/web/state/store.ts`、`src/web/components/cards/ReasoningCard.tsx`、`src/web/components/ImagePreview.tsx`。
- 测试：timeline 转换、app-server notification 归一化、store 事件处理、ReasoningCard 展示、图片预览路径。
- 不引入新的外部依赖，不改变公开 HTTP API 路径。
