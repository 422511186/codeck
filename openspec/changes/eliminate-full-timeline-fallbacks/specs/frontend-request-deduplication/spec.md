## ADDED Requirements

### Requirement: Recovery requests cannot widen timeline scope
前端恢复请求 SHALL 按 metadata、latest-page、history-page 和目标 mutation 使用独立稳定 key。任何失败重试 MUST 保持原请求范围，MUST NOT 从有界 page 升级为 resume、完整 detail 或完整 timeline 请求。

#### Scenario: Repeated repair signals during send
- **WHEN** 发送期间收到多个 `turn-completed`、`timeline-gap` 或 stream recovery signal
- **THEN** 客户端 MUST 合并等价 metadata/latest-page 请求
- **AND** 每个有效请求 MUST 只返回有界页或 metadata
- **AND** 重试 MUST NOT 扩展为完整历史读取

#### Scenario: Stale mutation response arrives after pagination
- **WHEN** 用户已加载新的历史页后，较早的 resume、rename、steer 或 review 响应才返回
- **THEN** 该响应 MUST NOT replace、清空或扩展当前 timeline 窗口

### Requirement: Public thread responses enforce negative timeline guarantees
所有非消息分页公开接口 SHALL 对 timeline 提供负向保证：响应不得包含完整消息数组，即使上游返回非兼容 turns。测试 MUST 对每个相关 route 校验该保证。

#### Scenario: Upstream ignores metadata-only flags
- **WHEN** 上游在 `includeTurns: false` 或 `excludeTurns: true` 请求后仍返回大量 turns
- **THEN** metadata 和 mutation route 响应 MUST 不含这些消息
- **AND** 服务端 MUST NOT 通过裁剪该数组伪造分页结果或 cursor
