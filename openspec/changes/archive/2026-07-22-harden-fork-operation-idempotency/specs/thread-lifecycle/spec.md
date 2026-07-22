## MODIFIED Requirements

### Requirement: Thread fork
系统 SHALL 支持从现有会话分叉新会话。Fork 本身 SHALL 创建完整分支；消息级 Fork 若需要从历史 user message 分支，客户端或 Web API 层 MUST 在新 thread 上继续执行 rollback。来源会话存在自定义绑定时，新 thread MUST 继承相同配置快照并获得独立 `bindingVersion`。Web fork API 接受可选 `operationId` 和 `retryAmbiguousFork`；相同 source thread 与 operation identity MUST 复用同一进行中或已完成结果，结果未知时 MUST 失败关闭且 MUST NOT 再次调用 app-server fork。

#### Scenario: Fork thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/fork`
- **THEN** 调用 `gateway.forkThread(threadId)`，返回分叉后的新会话详情
- **AND** 来源存在自定义绑定时 MUST 在返回前为新 `threadId` 写入继承绑定

#### Scenario: Concurrent fork requests share one operation
- **WHEN** 相同 source thread 和 `operationId` 的两个请求并发到达
- **THEN** lifecycle service/app-server MUST 只收到一次 fork
- **AND** 两个请求 MUST 返回同一个新 thread 结果

#### Scenario: Resolved fork retry reuses result
- **WHEN** fork 已完成但客户端重复提交相同 source thread 和 `operationId`
- **THEN** API MUST 直接返回原新 thread
- **AND** MUST NOT 创建第二个 fork

#### Scenario: Ambiguous fork retry fails closed
- **WHEN** fork operation 结果未知，或 Web/server cache 已丢失且请求带 `retryAmbiguousFork: true`
- **THEN** API MUST 返回结构化 `FORK_UNRESOLVED`
- **AND** MUST NOT 再次调用 lifecycle service 或 app-server `thread/fork`

#### Scenario: Confirmed pre-fork rejection can be retried
- **WHEN** 审计或其他明确发生在 app-server fork 前的前置步骤失败
- **THEN** API MUST 返回 `FORK_REJECTED` 并清理 operation cache
- **AND** 修正条件后使用同一 identity 的新请求 MAY 再次执行一次 fork

#### Scenario: Invalid ambiguous retry input
- **WHEN** 请求设置 `retryAmbiguousFork: true` 但没有合法非空 `operationId`，或字段类型无效
- **THEN** API MUST 返回 HTTP 400
- **AND** MUST NOT 调用 lifecycle service 或 app-server fork

#### Scenario: Fork then rollback for message action
- **WHEN** 用户通过消息级「从这里 Fork」指定历史 user message
- **THEN** 系统 MUST 先创建新 thread 并继承来源绑定
- **AND** MUST 在新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST NOT 修改原 thread history 或原绑定

#### Scenario: Rollback response loss is unresolved on same-operation retry
- **WHEN** fork-local rollback 已调用 app-server，但响应在 gateway 与客户端之间丢失
- **AND** 用户使用相同 rollback `operationId` 重试
- **THEN** gateway MUST 返回结构化 `ROLLBACK_UNRESOLVED`
- **AND** MUST NOT 再次调用 app-server rollback
- **AND** 客户端 MUST 能据此刷新 fork-local history 后为新的权威前置条件创建新 rollback identity

## ADDED Requirements

### Requirement: Rollback terminal response survives secondary audit failure
rollback route 在 gateway 已返回结构化 conflict、unresolved 或 repair-exhausted 终态后 SHALL 保留该终态响应。记录终态的二次审计失败 MUST NOT 覆盖原 HTTP 409、错误 code、实际尾部或权威 thread；初始 mutation 审计仍 MUST 在调用 gateway 前成功。

#### Scenario: Conflict audit write fails
- **WHEN** gateway 已明确返回 `ROLLBACK_CONFLICT` 和实际尾部
- **AND** `thread.rollback.conflict` 二次审计写入失败
- **THEN** route MUST 仍返回 HTTP 409 与 `ROLLBACK_CONFLICT`
- **AND** MUST 保留 `actualTailTurnIds`，MUST NOT 改写为通用 5xx

#### Scenario: Repair exhausted audit write fails
- **WHEN** gateway 已返回 `REPAIR_EXHAUSTED` 和权威 thread
- **AND** `thread.rollback.repair_exhausted` 二次审计写入失败
- **THEN** route MUST 仍返回 HTTP 409、原 code 和权威 thread
