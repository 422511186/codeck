## Why

手机端会话页目前无法看到当前会话上下文窗口占用情况，用户只有在上下文接近上限或压缩后才间接感知风险。已有实时事件已经提供 token 用量和模型上下文窗口大小，适合在会话 header 下方提供低打扰的可视化进度。

## What Changes

- 在会话 header 下方增加一条上下文窗口进度线，显示当前已用百分比。
- 进度线根据占用阈值变色，但不弹出提示、不强行展示操作按钮。
- 点击进度区域打开上下文用量详情面板，展示总量、窗口大小、输入/输出/推理输出 token，并提供“压缩上下文”入口。
- 前端按 `threadId` 缓存最近一次已知上下文用量；刷新或重新进入会话时，优先从会话详情中的历史 token 统计恢复，其次恢复缓存值。
- 无可用 `modelContextWindow` 或最近用量时显示不可点击的未知占位条，不伪造百分比，避免用户误以为功能缺失。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 会话聊天页 header 下方 SHALL 显示上下文窗口进度，并提供详情面板和压缩入口。

## Impact

- 影响 `src/app/threads/[threadId]/page.tsx` 的会话 header、详情面板和压缩交互。
- 影响 `src/web/state/store.ts` 与前端 API 类型，新增线程级上下文用量状态处理。
- 影响 `src/web/storage/` 本地缓存逻辑，新增按会话保存最近 token 用量的存储。
- 影响 `src/server/app-server/events.ts`、`src/server/app-server/session-timeline.ts` 和 `src/server/app-server/runtime.ts`，使用最近一次请求用量计算窗口占比，并从 rollout JSONL 恢复刷新后的真实百分比。
- 复用已有 `thread/tokenUsage/updated` 浏览器事件和 `POST /api/codex/threads/:threadId/compact` 接口，不新增后端 app-server 协议。
- 需要补充 store 事件测试、存储测试和会话页 UI 测试。
