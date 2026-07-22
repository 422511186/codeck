## ADDED Requirements

### Requirement: Ambiguous start retry survives Web and gateway restarts
客户端 SHALL 明确标记对结果未知的 `turn/start` 的重试，并携带原发送动作的 boot identity。服务端在该重试 cache miss、operation 属于旧 boot 或 Web 进程已重启时 MUST 仅从有界历史唯一确认原 `clientUserMessageId` 对应的 turn；无法确认时 MUST 返回 unresolved，MUST NOT 再次调用 app-server `turn/start`。已完成 cache 结果只有在 operation boot 与当前 gateway boot 一致时才可直接复用。

#### Scenario: Resolved cache belongs to an old boot
- **WHEN** 某 `clientUserMessageId` 已在 boot A 缓存为 resolved，随后 gateway 切换到 boot B
- **THEN** 重复请求 MUST 先从 boot B 的有界历史唯一确认该 turn
- **AND** 找不到时 MUST 返回 unresolved，MUST NOT 直接返回旧缓存 `turnId` 或再次启动 turn

#### Scenario: Ambiguous retry after Web cache loss
- **WHEN** 客户端携带原 boot identity 和 ambiguous retry 标记，但服务端内存中已没有该 operation
- **THEN** 服务端 MUST 只执行 bounded history recovery
- **AND** 无法唯一确认时 MUST NOT 调用 app-server `turn/start`

#### Scenario: Stale in-flight completion cannot overwrite recovery
- **WHEN** boot A 的 start promise 尚未完成时 boot B 已开始同 identity 的 bounded recovery
- **THEN** boot A 的迟到完成或失败 MUST NOT 覆盖 boot B 的 operation 状态或结果
- **AND** 等待 boot A promise 的 HTTP 请求 MUST 返回 boot B 的恢复结果或 unresolved，MUST NOT 返回 stale `turnId`

#### Scenario: Cached result is independent of mutable start preconditions
- **WHEN** 某发送动作已缓存 resolved 结果，随后其附件过期、Skill 被禁用或 thread 新动作前置校验失败
- **THEN** 相同 payload 与 `clientUserMessageId` 的幂等重试 MUST 直接返回原 `turnId`
- **AND** MUST NOT 再次执行仅用于创建新 turn 的可变前置校验

#### Scenario: Ambiguous recovery is independent of mutable start preconditions
- **WHEN** ambiguous retry 需要从有界历史确认原 turn，且原附件或 Skill 当前已不可用
- **THEN** 服务端 MUST 仍执行 bounded history recovery
- **AND** MUST NOT 在 recovery 前将资源当前不可用解释为原操作已明确拒绝

### Requirement: Retry identity follows the failed operation state
Timeline 的重试 SHALL 根据原发送动作是否已绑定已知 turn 区分 identity。结果未知的 ambiguous start retry MUST 复用原 `clientUserMessageId`、payload 与 boot identity；已知 turn 的最终失败或明确拒绝后的用户重试 MUST 创建新的 `clientUserMessageId` 和新的 optimistic entry，并保留原失败消息。

#### Scenario: Retry ambiguous start
- **WHEN** 失败用户消息的 `sendOperation.outcome` 为 `ambiguous`
- **THEN** 重试 MUST 复用原 `clientUserMessageId` 和 `sendOperation.bootId`
- **AND** 请求 MUST 标记为 ambiguous recovery
- **AND** recovery 成功后 MUST 清理同发送动作的临时“结果未确认”错误卡

#### Scenario: Retry final turn failure
- **WHEN** 用户消息已绑定 turn 且该 turn 最终失败
- **THEN** 用户显式重试 MUST 生成新的 `clientUserMessageId`
- **AND** 原失败消息 MUST 保留，新 optimistic 消息 MUST 作为独立发送动作追加

#### Scenario: Retry confirmed rejection
- **WHEN** 原发送动作已被明确拒绝而不是结果未知
- **THEN** 重试 MUST 使用新的发送 identity
- **AND** MUST NOT 被旧 operation cache 当作同一次动作

#### Scenario: Precondition failure is a confirmed rejection
- **WHEN** 附件、Skill、模型恢复或其他创建 turn 前置条件失败，且 app-server `turn/start` 尚未被调用
- **THEN** 服务端 MUST 返回可识别的 confirmed rejection，并 MUST NOT 把 operation 缓存为 ambiguous
- **AND** 客户端 MUST 将发送动作标记为 `rejected`，后续重试 MUST 使用新 identity

#### Scenario: Resume fails before start request
- **WHEN** Web 为 not-loaded thread 执行 resume 且 resume 失败，尚未调用 `turn/start`
- **THEN** 客户端 MUST 将发送动作标记为 `rejected` 而不是 `ambiguous`
- **AND** 后续重试 MUST 创建新 identity，MUST NOT 进入原 identity 的 bounded recovery

#### Scenario: Audit failure cannot poison or block a cached operation
- **WHEN** 新 turn 的审计日志写入在调用 app-server 前失败
- **THEN** 服务端 MUST 返回 confirmed rejection 并清理 pending operation
- **AND** 已 resolved 的幂等缓存命中或 ambiguous history recovery MUST NOT 因后续审计状态失败而被阻断
