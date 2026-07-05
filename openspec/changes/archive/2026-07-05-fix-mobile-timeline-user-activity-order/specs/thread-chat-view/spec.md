## MODIFIED Requirements

### Requirement: Timeline preserves semantic order during live confirmation
会话聊天页 SHALL 在 live delta、server item completion、snapshot 和 JSONL repair 混合到达时保持同一 turn 的语义顺序。user message MUST 显示在该 turn 的 agent、reasoning、tool、command、runtime loading 和 diff 输出之前；同 turn 活动 MUST 保持在可推断的执行位置，MUST NOT 被 repair 或确认流程统一移动到最终 assistant 回复之后。

#### Scenario: Agent delta arrives before server user item
- **WHEN** 前端已经显示本地 optimistic user message
- **AND** agent delta 先于 server user item 到达
- **AND** server user item 之后确认同一 turn 的 user message
- **THEN** user message MUST 保持在 agent 输出之前
- **AND** timeline MUST NOT 显示 agent 回复在用户消息上方

#### Scenario: Activity stays between user and final assistant after repair
- **WHEN** 前端已经显示同一 turn 的 user message 和最终 assistant message
- **AND** snapshot/JSONL repair 之后补齐该 turn 的 tool、command、read、search、runtime loading、Thinking 或 diff entries
- **THEN** 会话页 MUST 将这些活动显示为该 turn 的内联活动日志
- **AND** 活动 MUST 位于 user message 之后
- **AND** 在缺少更可靠锚点时，活动 MUST 位于最终 assistant message 之前

#### Scenario: User confirmation with interleaved activity remains single message
- **WHEN** 本地 optimistic user message、activity entries 和 server user item 以混合顺序到达
- **AND** local user message 与 server user item 属于同一 `turnId` 或同一 `clientUserMessageId`
- **THEN** 会话页 MUST 只显示一条 user message
- **AND** 该 user message MUST 仍位于同 turn 的 activity 和 assistant 输出之前
