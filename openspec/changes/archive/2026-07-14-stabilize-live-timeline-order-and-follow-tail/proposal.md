## Why

长会话在实时输出、断流修复和发送消息交错时出现两个严重回归：`Files changed` 会脱离原事件位置移动到 timeline 末尾，虚拟化消息列表在发送后可能显示为空白。两者都破坏了消息顺序与基本可用性，需要在继续扩展分页前先稳定 timeline 合并和贴底语义。

## What Changes

- 统一同一 turn 内 live event、分页 snapshot 与 repair snapshot 的顺序依据，确保 file change 完成态能够合并回原 item，而不是作为新条目追加到末尾。
- 验证并保持 file change 的稳定 item identity，使实时阶段的占位工具名与完成阶段的真实文件路径仍合并为同一 `itemId`。
- 将虚拟化长列表的尾部跟随交由 Timeline 在窗口更新后完成，避免页面先滚动到底部而渲染窗口仍停留在旧区间。
- 保持用户阅读历史时不自动跳到底部；仅在发送前处于尾部或用户主动跳到最新时继续跟随。
- 增加长会话发送、断流错误、file change repair 和虚拟化窗口的组合回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 长 timeline 发送与实时更新时的尾部跟随、虚拟窗口和空白防护要求。
- `timeline-event-stream`: live、snapshot 与 repair 条目的稳定身份、跨来源顺序和 file change 合并要求。

## Impact

- 前端 timeline 状态归一化与排序：`src/web/state/timeline-engine.ts`、`src/web/state/store.ts`。
- 虚拟化渲染与滚动跟随：`src/web/components/Timeline.tsx`、`src/app/threads/[threadId]/page.tsx`。
- timeline 单元测试、线程页面测试和事件合并测试。
- 不改变服务端分页 API，不允许通过全量 timeline 读取规避问题。
