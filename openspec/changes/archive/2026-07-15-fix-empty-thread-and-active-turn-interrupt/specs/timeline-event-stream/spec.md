## ADDED Requirements

### Requirement: Known active turn identity survives metadata refresh
系统 SHALL 将 `turn/start` 响应和 `turn_started` event 中的 turnId 作为已知 active turn identity。active metadata 不提供 turnId 时 MUST 保留该 identity，匹配的终态事件到达后 MUST 清理。

#### Scenario: Active metadata omits lastTurnId
- **WHEN** 客户端已知 active turnId，随后收到 status 为 active 且 `lastTurnId: null` 的 metadata
- **THEN** 客户端 MUST 保留已知 active turnId
- **AND** 中断操作 MUST 继续以该 identity 为目标

#### Scenario: Late completion belongs to an older turn
- **WHEN** gateway 已记录新的 active turnId，随后收到旧 turn 的迟到终态事件
- **THEN** gateway MUST 保留新的 active turnId
- **AND** MUST NOT 清除新 turn 的中断目标

### Requirement: Stale active metadata is reconciled without message reads
系统 SHALL 在 metadata 或 summary 报告 active 时，以有界最新 turn 状态校正运行态。该校正 MUST NOT 读取 turn items 或完整 timeline。

#### Scenario: Latest turn is already terminal
- **WHEN** `thread/read includeTurns=false` 返回 active
- **AND** `thread/turns/list limit=1 itemsView=notLoaded` 返回最新 turn 为 completed、failed 或 interrupted
- **THEN** Web metadata/summary MUST 返回 idle
- **AND** MUST 清理匹配的 active turn identity

#### Scenario: Latest turn is still running after Web restart
- **WHEN** gateway registry 为空且 metadata 返回 active
- **AND** 有界最新 turn 状态为 inProgress
- **THEN** Web MUST 保持 active
- **AND** MUST 恢复该 turn 的 active identity
