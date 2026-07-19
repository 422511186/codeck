## MODIFIED Requirements

### Requirement: Mutations Are Guarded By Action Locks
前端 SHALL 对会产生副作用的用户动作使用动作级 pending 锁或等价互斥机制，至少覆盖发送消息、新建会话、中断、归档、撤销归档、压缩、重命名、rewind/fork rollback、模型选择、推理强度选择和 Plan/Build 模式切换。历史 mutation 的锁 MUST 以 `threadId` 为作用域，并覆盖 preflight、app-server mutation 与 mutation response 提交的完整生命周期。

#### Scenario: Duplicate mutation click is ignored while pending
- **WHEN** 用户在同一 mutation 请求完成前重复点击同一动作
- **THEN** 前端 MUST 只发起一次对应 API 请求，并在请求完成前禁用、忽略或复用重复触发

#### Scenario: Failed mutation can be retried
- **WHEN** mutation 请求在服务端明确证明未执行的情况下失败
- **THEN** 前端 MUST 释放对应动作锁，并保留用户可理解的重试路径

#### Scenario: Ambiguous rollback failure keeps the operation identity
- **WHEN** rollback 请求因超时、断线或 5xx 无法证明是否已执行
- **THEN** 前端 MUST 保留原 `operationId` 与 precondition
- **AND** MUST NOT 生成新 identity 后直接对当前尾部再次执行 rollback

#### Scenario: Different resources are independent
- **WHEN** 两个 mutation 作用于不同 `threadId` 或不同资源
- **THEN** 前端 MUST NOT 因一个资源的 pending 锁阻塞另一个资源的合法操作

## ADDED Requirements

### Requirement: Rollback is idempotent per user operation
浏览器、Web route 与 gateway SHALL 使用稳定 rollback `operationId` 对同一次 rewind/fork 操作执行幂等处理。同一 boot、thread 与 operation identity 的重复请求 MUST 返回同一结果，MUST NOT 再次把 `numTurns` 应用于已经变化的尾部。

#### Scenario: Double tapping rewind
- **WHEN** 用户在第一次 rewind 请求完成前再次触发同一消息操作
- **THEN** 前端 MUST 复用 pending Promise 或忽略重复触发
- **AND** gateway MUST 最多调用一次 app-server rollback

#### Scenario: Duplicate request arrives after success
- **WHEN** gateway 已为某 `operationId` 完成 rollback
- **AND** 同一 boot 和 thread 再次收到相同 operationId 与 payload fingerprint
- **THEN** gateway MUST 返回缓存的相同 mutation result
- **AND** MUST NOT 根据新的 thread 尾部再次调用 rollback

#### Scenario: Same operation id has different precondition
- **WHEN** 同一 `operationId` 被用于不同 target、HistoryStamp 或 expected tail
- **THEN** 服务端 MUST 拒绝该请求为 identity conflict
- **AND** MUST NOT 执行任一新的历史 mutation

#### Scenario: Retry crosses a gateway boot
- **WHEN** ambiguous rollback operation 属于旧 boot
- **AND** 新 gateway 无法从权威 history 唯一证明旧 operation 的结果
- **THEN** 服务端 MUST 返回 unresolved 或 conflict
- **AND** MUST NOT 自动重放 app-server rollback

### Requirement: Rollback precondition conflicts do not mutate history
rollback 的 history precondition 校验 SHALL 在调用 app-server 之前完成。冲突响应 MUST 与普通传输失败区分，使客户端只能刷新权威尾部后发起新的用户操作，而不能自动重试旧 count。

#### Scenario: Another device changes the tail
- **WHEN** 设备 A 准备 rollback 后，设备 B 先改变了同一 thread 的尾部或 generation
- **AND** 设备 A 的请求仍携带旧 `HistoryStamp` 与 expected tail
- **THEN** 服务端 MUST 返回 conflict
- **AND** MUST NOT 调用 app-server rollback

#### Scenario: Conflict refreshes without implicit retry
- **WHEN** 客户端收到 rollback precondition conflict
- **THEN** 客户端 MUST 请求 bounded latest baseline 并保持当前草稿
- **AND** MUST NOT 在 refresh 后自动把旧 `numTurns` 应用于新尾部
