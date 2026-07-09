## Why

当前 `thread/status/changed` 的 `idle` 事件只更新 thread 运行状态，不会收尾当前 active turn 的 live timeline activity。若 app-server 漏发或延迟发送 `turn_completed`，页面会停止 processing，但 timeline 中仍可能残留未完成的 reasoning、tool 或 command 活动，形成状态与内容不一致。

## What Changes

- 在前端 store 中让可信 `thread_status_changed: idle` 对已知 active turn 执行与 turn 完成一致的 timeline 收尾。
- 收尾时不得把 status 事件渲染为可见 timeline item，也不得仅因 status 事件触发完整 timeline repair。
- 保留现有 turn lifecycle 事件语义：若后续真正的 `turn_completed` 或 item completion 到达，仍应按幂等规则合并或忽略，不重复显示。
- 补充回归测试覆盖 pending reasoning 和 running tool/command entry 在 status idle 后被结束。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `timeline-event-stream`: `thread/status/changed` 的 `idle` 事件除了更新 thread status，还必须收尾已知 active turn 的 live timeline activity，避免 timeline 残留运行中状态。

## Impact

- 前端状态：`src/web/state/store.ts`。
- 测试：`tests/unit/web-store-events.test.ts`。
- 规格：`timeline-event-stream` delta spec。
- 不改变 app-server 协议、API route 或可见 status timeline item 语义。
