## ADDED Requirements

### Requirement: Fresh empty thread remains interactive when history is unavailable
刚创建且尚未 materialized 的 thread SHALL 显示为空 timeline 的可交互会话。首屏有界分页若报告首条用户消息前不可用，页面 MUST NOT 显示 502 或阻止输入第一条消息。

#### Scenario: Newly created thread opens before first message
- **WHEN** `thread/read` 返回 idle metadata 且首屏 timeline page 报告 thread 尚未 materialized
- **THEN** 页面 MUST 显示空 timeline 和可用输入区
- **AND** MUST NOT 请求完整 thread timeline

#### Scenario: Unknown timeline page error remains visible
- **WHEN** 首屏 timeline page 因权限、连接或无效 cursor 等未知原因失败
- **THEN** 页面 MUST 保留错误反馈
- **AND** MUST NOT 将未知错误伪装为空会话
