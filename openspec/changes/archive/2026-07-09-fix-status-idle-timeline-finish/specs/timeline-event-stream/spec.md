## ADDED Requirements

### Requirement: Idle status finishes live timeline activity
timeline event stream 客户端 SHALL 在收到可信 `thread_status_changed` 且状态为 `idle` 时，收尾当前已知 active turn 的 live timeline activity。该 status 事件 MUST 继续作为 thread-level 状态事件处理，不得追加可见 timeline item，也不得仅因该 status 事件触发完整 timeline repair。

#### Scenario: Idle status finishes pending reasoning
- **WHEN** 客户端已记录某 thread 的 `activeTurnId`
- **AND** timeline 中存在该 turn 的 pending reasoning entry
- **AND** 浏览器收到该 thread 的 `thread_status_changed` 且 status 为 `idle`
- **THEN** 客户端 MUST 标记该 thread 为 not running
- **AND** 客户端 MUST 清理 stale active turn state
- **AND** 客户端 MUST 移除该 turn 的空 pending reasoning entry
- **AND** 客户端 MUST NOT 追加可见 status timeline item
- **AND** 客户端 MUST NOT 仅因此 status event 请求完整 timeline repair

#### Scenario: Idle status finishes running activity entries
- **WHEN** 客户端已记录某 thread 的 `activeTurnId`
- **AND** timeline 中存在该 turn 的 running tool 或 command entry
- **AND** 浏览器收到该 thread 的 `thread_status_changed` 且 status 为 `idle`
- **THEN** 客户端 MUST 将该 turn 的 running activity entry 标记为 ended
- **AND** 后续同一 item 的 completion 或 delta MUST 继续按现有幂等与合并规则处理

#### Scenario: Idle status without known active turn
- **WHEN** 浏览器收到某 thread 的 `thread_status_changed` 且 status 为 `idle`
- **AND** 客户端没有该 thread 的已知 active turn
- **THEN** 客户端 MUST 更新 thread status 并保持 not running
- **AND** 客户端 MUST NOT 猜测某个 timeline entry 所属 turn 并强行收尾
