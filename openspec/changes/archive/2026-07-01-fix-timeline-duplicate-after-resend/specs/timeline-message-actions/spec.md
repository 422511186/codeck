## ADDED Requirements

### Requirement: Rewind resend does not duplicate new turn output
用户 rewind 后重新发送新消息时，新 turn 的输出 SHALL 按当前历史合并显示。旧 turn 的 late event MUST 被屏蔽；新 turn 中来自 live stream、completion 和 refresh snapshot 的同一输出 MUST NOT 重复显示。

#### Scenario: Rewind then resend same prompt
- **WHEN** 用户 rewind 到某条消息后重新发送一个新消息
- **AND** 新 turn 产生 reasoning、tool output 和 agent message
- **THEN** 每个等价输出 MUST 只显示一次
- **AND** 刷新页面后 timeline MUST 仍保持不重复
