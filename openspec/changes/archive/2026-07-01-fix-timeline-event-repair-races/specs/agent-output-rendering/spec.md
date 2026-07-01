## ADDED Requirements

### Requirement: Agent output idempotency does not suppress new history
agent message、reasoning 和 tool output 的重复抑制 SHALL 区分当前历史 generation。客户端 MUST 保留同一 generation 内 snapshot replay 和 duplicate event 的幂等保护，但 MUST NOT 让 rollback/fork 前旧历史的 revision、event ordering 或 snapshot suppression 状态删除新历史中的合法输出。

#### Scenario: Reasoning item id reused in new generation
- **WHEN** rewind 或 fork rollback 后新 turn 产生与旧历史相同 `itemId` 的 reasoning output
- **AND** 新 output 的 revision 小于或等于旧历史记录的 revision
- **THEN** timeline MUST 显示新 reasoning output
- **AND** MUST NOT 因旧历史 revision 将其判断为 stale

#### Scenario: Tool output after snapshot generation changes
- **WHEN** snapshot repair 已覆盖旧 generation 中某 tool output
- **AND** 新 generation 中同 item id 的 tool output delta 到达
- **THEN** 客户端 MUST 保留该新 tool delta
- **AND** MUST NOT 用旧 snapshot suppression 把它当作 replay 丢弃

#### Scenario: Agent message replay in same generation
- **WHEN** 同一 generation 内 snapshot 已包含某 agent message 的完整文本
- **AND** SSE replay 补发该 snapshot 已覆盖的旧 delta
- **THEN** 客户端 MUST 继续忽略该旧 delta
- **AND** MUST NOT 产生重复输出
