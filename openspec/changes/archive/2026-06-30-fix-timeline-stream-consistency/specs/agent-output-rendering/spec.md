## MODIFIED Requirements

### Requirement: Live timeline snapshots preserve streamed output
running 会话中，HTTP thread snapshot SHALL NOT 无条件覆盖已经通过 timeline event stream 追加到 timeline 的 live entries。系统 SHALL 以事件流作为运行中输出主路径；snapshot 仅用于初始化、显式 repair、断线缺口恢复或 turn 完成后的权威替换。任何 snapshot 与事件流合并都 MUST 保留 turn 元数据并遵守幂等规则，避免重复追加 agent message、reasoning、command/tool output。

#### Scenario: startTurn response does not erase live deltas
- **WHEN** 用户发送消息后 timeline event stream 已经追加 agent/reasoning/tool delta
- **AND** `startTurn` HTTP 响应随后返回一个不包含这些 delta 的 thread snapshot 或轻量 turn 状态
- **THEN** timeline MUST 保留已经追加的 live entries
- **AND** MUST NOT 通过全量 `setThreadEntries` 清空或回退这些输出

#### Scenario: polling snapshot is not the running main path
- **WHEN** 会话处于 running 状态且 timeline event stream 正常连接
- **THEN** 客户端 MUST NOT 高频轮询 `readThread` 来获取完整 timeline
- **AND** 运行中输出 MUST 由事件流增量更新

#### Scenario: repair snapshot does not duplicate live deltas
- **WHEN** 断线恢复或事件缺口触发 snapshot repair
- **AND** 本地 timeline 已经有更新的 event stream delta
- **THEN** repair 结果 MUST replace 或按 revision 合并当前 timeline
- **AND** MUST NOT 将 snapshot 已包含的文本与后到旧 delta 重复拼接

#### Scenario: completed snapshot can finalize live entries
- **WHEN** turn 完成后 snapshot 或 `item_updated` 返回同 id 的完整 agent/reasoning/tool item
- **THEN** timeline MUST 用完整 item 更新对应 live entry
- **AND** MUST 保持该 entry 的相对位置稳定
- **AND** MUST 保留该 entry 的 `turnId` 或等价 turn 标识

## ADDED Requirements

### Requirement: Reasoning display is consistent across live and historical paths
Web timeline SHALL 展示 app-server 已公开发送的 reasoning summary、content 和 delta。实时 reasoning、完成后的 reasoning item、raw response reasoning 和历史 `thread/read` reasoning MUST 映射到同一条 timeline entry 或按稳定 id 合并，不得在刷新、完成或重连后无故消失或重复。

#### Scenario: Live reasoning survives completion
- **WHEN** reasoning delta 已通过 event stream 显示在 timeline 中
- **AND** 后续收到 reasoning item completion
- **THEN** 系统 MUST 用完成项更新同一 reasoning entry
- **AND** MUST NOT 因完成项文本为空而清空已有公开 reasoning 文本

#### Scenario: Historical reasoning remains visible after reload
- **WHEN** 用户刷新页面或重新进入会话
- **AND** app-server 历史中存在公开 reasoning summary/content 或可见 raw response reasoning
- **THEN** `thread/read` 返回的 timeline MUST 包含可展示的 reasoning entry
- **AND** 前端 MUST 继续以 reasoning card 展示该内容

#### Scenario: Raw response reasoning does not create duplicates
- **WHEN** 同一 reasoning 同时通过 reasoning delta 和 raw response completion 到达
- **THEN** 系统 MUST 使用稳定 item identity 合并它们
- **AND** timeline MUST NOT 展示两张语义相同的 thinking/reasoning 卡片
