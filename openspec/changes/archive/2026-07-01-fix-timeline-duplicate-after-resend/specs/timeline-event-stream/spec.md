## ADDED Requirements

### Requirement: Equivalent live and completed items render once
timeline event stream 客户端 SHALL 将同一 turn 内等价的 live delta entry、item completion entry 和 snapshot repair entry 合并为单一可见 timeline entry。系统 MUST NOT 因 item id 不同而把同一 turn 的同一 agent/reasoning/tool 输出显示两次。

#### Scenario: Completion follows live delta with different item id
- **WHEN** 客户端已通过 live delta 显示某 turn 的 agent message 或 reasoning 文本
- **AND** 后续收到同 turn、同类型、文本等价但 `itemId` 不同的 `item_updated`
- **THEN** timeline MUST 合并为一条 entry
- **AND** MUST 保留更完整的文本和 turn metadata

#### Scenario: Snapshot repair follows live delta
- **WHEN** snapshot repair 返回某 turn 的完整 agent/reasoning/tool item
- **AND** 当前 timeline 已有同 turn 等价 live entry
- **THEN** repair MUST 替换或合并该 live entry
- **AND** MUST NOT 追加第二条相同输出

