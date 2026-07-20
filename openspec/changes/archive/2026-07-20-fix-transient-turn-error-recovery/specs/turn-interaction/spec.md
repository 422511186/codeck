## ADDED Requirements

### Requirement: Successful upstream retry is not a final stream failure

当 app-server 已声明会继续重试当前 turn 时，Web MUST 将该发送动作保持为进行中；只有明确的最终错误才可结束 turn 并建立失败重试入口。

#### Scenario: Retryable 503 does not fail the user message
- **WHEN** Responses 上游返回 503，app-server 发送 `willRetry=true`
- **THEN** Web MUST 保持原用户消息为 sent 或 running 状态
- **AND** Web MUST NOT 创建最终失败错误卡片
- **AND** 后续成功完成 MUST 清理任何兼容旧状态留下的临时错误
