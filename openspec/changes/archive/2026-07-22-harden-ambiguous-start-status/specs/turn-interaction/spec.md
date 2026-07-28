## ADDED Requirements

### Requirement: Ambiguous start keeps the thread fail-closed

当客户端已经发出 `turn/start` 但结果未知时，Web SHALL 将发送 entry 标记为 `ambiguous` 并保留原 `clientUserMessageId`，同时 MUST 保持 thread 为 active/running，直到事件流或 summary 明确确认线程已 idle。未知结果期间 MUST NOT 因本地错误处理而开放新的发送 identity。

#### Scenario: Unknown start result does not open concurrent send

- **WHEN** `turn/start` 请求已发出，随后因超时、连接中断、5xx 或响应解析失败结束
- **THEN** 页面 MUST 保留原发送 entry 的 `ambiguous` outcome 和 identity
- **AND** 页面 MUST NOT 将 thread 状态切换为 `idle`
- **AND** ChatInput MUST 继续阻止新的普通发送，直到权威状态收敛

#### Scenario: Confirmed rejection still permits a new action

- **WHEN** resume、审计、附件、Skill、模型 readiness 或输入校验在 `turn/start` 调用前明确失败
- **THEN** 页面 MUST 将该 entry 标记为 confirmed rejection
- **AND** 页面 MUST 切换为 `idle`
- **AND** 后续显式重试 MAY 使用新的发送 identity

#### Scenario: Authoritative idle eventually reopens sending

- **WHEN** ambiguous entry 保留期间 summary 或事件流确认 thread 为 `idle`
- **THEN** store MUST 清除 active/running 状态
- **AND** 用户 MAY 创建新的发送 identity
