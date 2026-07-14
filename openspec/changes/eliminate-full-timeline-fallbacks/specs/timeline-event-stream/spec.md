## ADDED Requirements

### Requirement: Event recovery uses bounded authority sources
timeline event recovery SHALL 仅使用 metadata、thread-wide latest page、目标 item content page 或目标 turn 的有界页作为权威来源。steer、interrupt、review 和普通 event repair MUST NOT 附带完整 thread timeline。

#### Scenario: Stream gap triggers repair
- **WHEN** event stream 检测到 gap 或 turn 完成但缺少可见输出
- **THEN** repair MUST 请求 metadata 和至多一页最新 items
- **AND** repair MUST merge 到当前窗口而不是 replace 已加载历史
- **AND** repair failure MUST NOT 触发完整 detail fallback

#### Scenario: Steer succeeds during active turn
- **WHEN** steer 请求成功并产生新的 item 或 turn identity
- **THEN** HTTP 响应 MUST 只返回操作 identity 或 metadata
- **AND** 后续可见内容 MUST 通过 event stream 或有界 repair 到达

#### Scenario: Interrupt resolves turn identity
- **WHEN** interrupt 请求没有显式 turnId
- **THEN** 服务端 MUST 使用 metadata-only 状态或已知 active turn identity 解析目标
- **AND** MUST NOT 为解析 lastTurnId 读取消息 timeline
