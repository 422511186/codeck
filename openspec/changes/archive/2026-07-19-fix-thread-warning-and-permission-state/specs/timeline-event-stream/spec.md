## ADDED Requirements

### Requirement: Warning and runtime errors retain distinct semantics

事件流处理 MUST 保留 app-server `warning` 与 `turn_error`/`recovery_failed` 的语义差异；warning MUST NOT 被转换成 `body.kind = error` 的 timeline entry。

#### Scenario: Warning event is routed outside timeline
- **WHEN** store 处理 `warning` websocket 事件
- **THEN** store 只更新对应会话的 notice 状态，不改变 timeline entry 数量或顺序

#### Scenario: True turn error remains an alert
- **WHEN** store 处理 `turn_error` 或 `recovery_failed` 事件
- **THEN** timeline 保留现有错误 entry，并使用红色 alert 语义呈现
