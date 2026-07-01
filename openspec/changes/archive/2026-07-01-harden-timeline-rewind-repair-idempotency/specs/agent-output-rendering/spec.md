## ADDED Requirements

### Requirement: Reasoning and tool output survive snapshot races
agent reasoning、tool output 和 agent message 在 live stream、snapshot repair、historical reload 之间 SHALL 保持稳定。旧 snapshot 或误触发 repair MUST NOT 删除已经显示且属于当前历史的 reasoning/tool 输出；补发 delta 也 MUST NOT 造成重复显示。

#### Scenario: Historical reasoning is present before stale snapshot returns
- **WHEN** 页面已从 cache 或 live event 显示当前历史中的 reasoning entry
- **AND** 一个旧的 initial snapshot 随后返回且不包含该 reasoning entry
- **THEN** 客户端 MUST NOT 用该旧 snapshot 删除当前历史中的 reasoning entry
- **AND** historical reload 或后续 repair MUST 仍能显示该 reasoning 内容

#### Scenario: Tool output replay after repair
- **WHEN** snapshot repair 已包含某 tool output 的完整文本
- **AND** SSE replay 又补发该 tool output 的旧 delta
- **THEN** 客户端 MUST 忽略 snapshot 已覆盖的旧 delta
- **AND** MUST 保留后续真正的新 tail delta
