## Why

手动压缩上下文时，前端刚点击就把本地“正在压缩上下文…”和“压缩上下文已完成”写入 timeline，容易和 app-server 实际压缩 turn 的 live 输出重复或倒置。`notLoaded` / `systemError` 会话也可能进入 compact 路由，导致用户看到 502 或不准确的压缩状态。

## What Changes

- 手动 compact 只允许在会话状态明确为 `idle` 时触发；`active`、`notLoaded`、`systemError` 等非空闲状态返回清晰的 `409`。
- 前端只在 `idle` 会话展示可点击的“压缩上下文”入口，未加载或异常状态不展示入口。
- 手动 compact 请求发起后不再本地追加“正在压缩上下文…” timeline 条目；运行中的底部状态可显示压缩进行中。
- 压缩完成 timeline 条目只来自 app-server 的 live item / compact 事件，不由请求启动返回或 summary idle 轮询伪造。

## Capabilities

### New Capabilities

### Modified Capabilities
- `thread-chat-view`: 调整手动压缩时 timeline 的状态反馈来源，移除本地立即追加的压缩占位。
- `thread-controls`: 调整压缩入口可用条件，仅 `idle` 会话可点击。
- `thread-lifecycle`: 调整 compact API 预检规则，非 `idle` 状态返回 `409` 且不调用 app-server compact。

## Impact

- `src/app/api/codex/threads/[threadId]/compact/route.ts`
- `src/app/threads/[threadId]/page.tsx`
- `tests/unit/codex-thread-compact-route.test.ts`
- `tests/unit/web-thread-page.test.tsx`
- OpenSpec delta specs 与任务清单
