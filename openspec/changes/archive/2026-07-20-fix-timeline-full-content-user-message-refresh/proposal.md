## Why

`TimelineRow` 在读取完整内容后会派生 `renderedEntry`，但 `user-message` 分支仍把原始 `entry` 传给 `UserMessage`。因此用户消息如果因 budget 被 `truncated`，点击「读取完整内容」后本地 row/footer 可能显示已加载，store 也可能写入完整正文，但用户气泡仍停留在旧 preview，造成 Timeline 可见内容与 completeness 状态不一致。

## What Changes

- 修复 `Timeline` 用户消息渲染路径，使 full-content 成功读取后用户气泡使用完整正文。
- 增加回归测试覆盖 truncated `user-message` 读取完整内容后替换 preview 的场景。
- 保持 agent/tool/command/diff 等已有 full-content 行为不变。
- 不修改 full-content API、cursor 协议、timeline engine 合并规则或消息操作菜单语义。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-content-completeness`: 明确 full-content 结果应用语义覆盖用户消息正文，不能只更新 footer/store 而让可见 user bubble 停留在 preview。

## Impact

- 前端渲染：`src/web/components/Timeline.tsx` 的 `TimelineRow` / `UserMessage` 分支。
- 状态一致性：确保 loaded full-content 本地 row、store 与用户可见正文一致。
- 测试：`tests/unit/web-timeline.test.tsx` 增加 user-message full-content 回归测试。
