## ADDED Requirements

### Requirement: Message action rollback barriers use reliable tail turns
消息级 rewind/fork 传给 rollback 的 deleted-turn hint SHALL 来自当前可验证的尾部 turn 范围。系统 MUST NOT 允许不属于实际 rollback 删除范围的 turn id 成为当前 thread 的 deleted barrier。

#### Scenario: Client hint contains unrelated turn
- **WHEN** rewind 或 fork rollback 请求携带 `expectedDeletedTurnIds`
- **AND** 其中某个 turn id 不在本次 rollback 删除的尾部范围内
- **THEN** 服务端 MUST 忽略该 id 或拒绝请求
- **AND** 后续该 turn 的合法 timeline event MUST 仍能显示

#### Scenario: Tail live turn is included in rollback hint
- **WHEN** user message action 删除了包含 live overlay 的尾部 turn
- **AND** 客户端提供该 turn id 作为 `expectedDeletedTurnIds`
- **THEN** 服务端 MUST 使用该 id 清理 overlay 和 late-event barrier
- **AND** 被删除尾部 MUST NOT 在 resend 后重新出现在 timeline

### Requirement: Failed message actions preserve repair opportunities
消息级 rewind/fork 在本地或 fork-local 目标解析失败时 SHALL 失败关闭，并且 MUST NOT 破坏正在进行的权威 snapshot 或 repair 机会。错误提示可以追加到 timeline，但不得使用户必须刷新页面才能拿回本来即将到达的 turn metadata。

#### Scenario: Local failure while snapshot is pending
- **WHEN** 初始 `readThread` 或 snapshot repair 正在进行
- **AND** 用户触发的 rewind/fork 在本地解析阶段失败
- **THEN** 系统 MUST 显示失败提示
- **AND** 正在进行的 snapshot/repair MUST 仍可在返回后用于补齐 turn metadata
