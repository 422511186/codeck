## ADDED Requirements

### Requirement: Agent output cards are deduplicated within a turn
agent message、reasoning card 和 tool card SHALL 在同一 turn 内按稳定身份和等价内容去重。不同 turn 中内容相同的输出 MUST 保留为不同 entry。

#### Scenario: Duplicate reasoning card in same turn
- **WHEN** 同一 turn 产生两条 reasoning entries
- **AND** 两条 entries 的文本相同或一条文本包含另一条
- **THEN** timeline MUST 只显示一张 reasoning card
- **AND** 该 card MUST 使用更完整的文本和完成状态

#### Scenario: Identical agent reply in different turns
- **WHEN** 两个不同 turn 都回复 `1 + 1 = 2`
- **THEN** timeline MUST 保留两条 agent message
- **AND** MUST NOT 因文本相同跨 turn 去重

#### Scenario: Tool output duplicate in same turn
- **WHEN** 同一 turn 的 tool output 通过 live overlay 和 snapshot 同时出现
- **AND** `toolKind`、`server`、`tool` 和 output 文本等价
- **THEN** timeline MUST 只显示一张 tool card

