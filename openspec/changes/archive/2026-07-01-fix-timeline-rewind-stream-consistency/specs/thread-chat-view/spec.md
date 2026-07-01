## ADDED Requirements

### Requirement: Timeline preserves semantic order during live confirmation
会话聊天页 SHALL 在 live delta、server item completion 和 snapshot 混合到达时保持同一 turn 的语义顺序。user message MUST 显示在该 turn 的 agent、reasoning、tool 和 diff 输出之前。

#### Scenario: Agent delta arrives before server user item
- **WHEN** 前端已经显示本地 optimistic user message
- **AND** agent delta 先于 server user item 到达
- **AND** server user item 之后确认同一 turn 的 user message
- **THEN** user message MUST 保持在 agent 输出之前
- **AND** timeline MUST NOT 显示 agent 回复在用户消息上方

### Requirement: Snapshot repair replaces unknown tail
会话聊天页在事件缺口、rollback 或 fork rollback 后执行 snapshot repair 时，repair 结果 SHALL replace 当前 thread timeline 的未知尾部。客户端 MUST 清理 repair 结果中不存在的旧 local entries、旧 live entries 和旧 pending placeholders。

#### Scenario: Repair after stream gap
- **WHEN** timeline event stream 报告 gap
- **AND** 页面通过 `readThread` 获取 repair snapshot
- **THEN** 页面 MUST 用 repair snapshot 建立新的 timeline 基线
- **AND** repair snapshot 中不存在的旧尾部 entries MUST 不再显示

### Requirement: Cached thread can reconnect without disabling resolved input
页面命中内存缓存时 SHALL 立即显示缓存 timeline，并在后台连接 event stream 与必要 repair。若缓存中的 thread detail 足以支持发送，输入区 MUST NOT 仅因当前 `detail` state 尚未重新读取完成而禁用。

#### Scenario: Cached idle thread reopen
- **WHEN** 用户离开 idle thread 后重新进入同一 thread
- **AND** 内存缓存中已有 timeline 和 thread 基础信息
- **THEN** 页面 MUST 立即显示缓存
- **AND** 输入框 SHOULD remain usable unless a repair or running state explicitly disables it

### Requirement: Event stream error and repair do not race into duplicates
浏览器 EventSource error、自动重连补发和 snapshot repair SHALL 协同处理。客户端 MUST 避免在同一断线窗口内同时把 repair snapshot 和补发 delta 重复应用到同一 item。

#### Scenario: Error triggers repair while reconnect replays events
- **WHEN** EventSource error 触发 snapshot repair
- **AND** 浏览器随后自动重连并补发旧 delta
- **THEN** 前端 MUST 基于 generation、event id、item revision 或 offset 忽略已覆盖 delta
- **AND** timeline MUST NOT 出现重复输出

