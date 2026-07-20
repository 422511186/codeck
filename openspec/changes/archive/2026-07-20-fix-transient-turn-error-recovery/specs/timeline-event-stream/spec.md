## MODIFIED Requirements

### Requirement: Warning and runtime errors retain distinct semantics

事件流处理 MUST 保留 app-server `warning`、可重试 `turn_error` 与最终 `turn_error`/`recovery_failed` 的语义差异。warning MUST NOT 被转换成 `body.kind = error` 的 timeline entry；`willRetry=true` 的 turn error MUST 保持为临时状态，只有最终失败才可保留错误 entry。

#### Scenario: Warning event is routed outside timeline
- **WHEN** store 处理 `warning` websocket 事件
- **THEN** store 只更新对应会话的 notice 状态，不改变 timeline entry 数量或顺序

#### Scenario: Retryable turn error remains transient
- **WHEN** store 处理 `turn_error` 且 `willRetry=true`
- **THEN** store MUST 保持当前 turn 为进行中
- **AND** timeline MUST NOT 创建持久错误 entry

#### Scenario: True turn error remains an alert
- **WHEN** store 处理 `turn_error` 且 `willRetry=false`，或处理 `recovery_failed`
- **THEN** timeline MUST 保留现有错误 entry，并使用红色 alert 语义呈现

## ADDED Requirements

### Requirement: Transient turn errors converge after upstream retry

事件流处理 MUST 区分 app-server `turn_error.willRetry=true` 与最终失败。可重试错误不得 materialize 为持久 `body.kind = error` timeline entry；当前 turn 成功完成后，前端和服务端 MUST 清理同一 turn 的历史临时错误 identity。

#### Scenario: Upstream retry succeeds without a false error card
- **WHEN** app-server 为 turn 发送 `turn_error` 且 `willRetry=true`
- **AND** 随后发送该 turn 的成功完成事件
- **THEN** timeline MUST NOT 保留 `${turnId}-error` 的红色错误卡片
- **AND** 用户消息 MUST NOT 被标记为 failed

#### Scenario: Refresh does not append a successful turn's transient error
- **WHEN** 页面刷新或 bounded latest-page repair 发生在上游重试成功之后
- **THEN** 服务端返回的 timeline MUST NOT 包含该 turn 的临时错误 overlay
- **AND** timeline 顺序 MUST 与权威历史内容保持一致，不得把旧错误追加到末尾

#### Scenario: Final turn failure remains retryable
- **WHEN** app-server 发送 `turn_error` 且 `willRetry=false`
- **THEN** timeline MUST 保留 `${turnId}-error` 错误 entry
- **AND** 绑定的用户消息 MUST 标记为 failed
- **AND** 用户 MUST 仍可通过现有显式重试路径重新发送
