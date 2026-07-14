## ADDED Requirements

### Requirement: Completion repair retries are bounded and deduplicated
同一 thread、turn 和 generation 的 completion repair SHALL 只有一个 pending 请求与一个重试计时器，MUST 设置固定最大尝试次数。

#### Scenario: Duplicate completion signals
- **WHEN** 同一 turn 的 completion event、summary idle 和 startTurn fast completion 同时请求 repair
- **THEN** 客户端 MUST 合并为同一 repair 生命周期
- **AND** 每次尝试 MUST 只读取 metadata 和一页 latest items
