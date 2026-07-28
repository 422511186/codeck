## ADDED Requirements

### Requirement: Fork-local target resolution fails closed without stable identity

消息级 Fork 在新 thread 中定位等价 user message 时 SHALL 只使用 `clientUserMessageId`、可靠的 `turnIndex` 与受约束的稳定 item identity。若这些身份均不可用，系统 MUST 失败关闭并提示用户刷新或稍后重试；MUST NOT 因为正文文本恰好唯一而猜测 rollback 目标。

#### Scenario: Missing fork-local identity does not use text fallback
- **WHEN** forked thread 中找不到目标的 `clientUserMessageId`，目标没有可靠 `turnIndex` 或 server item identity，且正文文本在当前窗口中恰好只出现一次
- **THEN** 消息级 Fork MUST 不调用 forked thread 的 rollback API
- **AND** MUST 保留 forked thread identity 并呈现不可定位反馈

#### Scenario: Same text in different turns remains isolated
- **WHEN** forked thread 中有多个不同 turn 的 user message 使用相同正文
- **THEN** 目标解析 MUST 返回不可确定
- **AND** MUST NOT 选择任一文本匹配项作为 rollback 目标

## MODIFIED Requirements

### Requirement: 从这里 Fork
用户消息菜单中的「从这里 Fork」SHALL 保留当前 thread 不变，创建一个新 thread，并在新 thread 中回滚到目标 user message 所属 turn 之前，再跳转到新 thread 继续编辑发送。该复合动作 MUST 具有稳定 fork operation identity 和 fork-local rollback operationId；fork 结果未知或 fork 已完成但后续步骤失败时，重试 MUST 复用对应 identity，不得创建第二个 fork 或重复执行不同 rollback 操作。operation 状态 MUST 在当前 tab 的组件卸载或 route 重挂载后保持可恢复，完整成功或明确拒绝后 MUST 清理。

#### Scenario: Fork 历史用户消息
- **WHEN** thread 静止
- **AND** 用户在某条 user message 的消息级菜单点击「从这里 Fork」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/fork`
- **AND** MUST 在 fork 出的新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST 保持原 thread timeline 不变
- **AND** MUST 跳转到新 thread 的聊天页
- **AND** MUST 将目标 user message 的文本回填到新 thread 的输入框

#### Scenario: Fork 后不自动发送
- **WHEN** 「从这里 Fork」成功并跳转到新 thread
- **THEN** 系统 MUST NOT 自动调用 `POST /api/codex/turns/start`
- **AND** 用户 MUST 能在新 thread 中编辑回填文本后再发送

#### Scenario: Fork retry after lost response
- **WHEN** fork 请求已发出但客户端收到超时、连接中断或 5xx，无法确认新 thread 是否创建
- **THEN** 当前消息 action MUST 标记为 ambiguous 并保留原 operation identity
- **AND** 用户再次触发同一目标时 MUST 发送 `retryAmbiguousFork: true` 与原 operation identity
- **AND** 服务端 MUST 返回原结果或 `FORK_UNRESOLVED`，MUST NOT 创建第二个 fork

#### Scenario: Ambiguous fork survives component remount
- **WHEN** fork 响应结果未知后 ThreadPage 卸载，并在同一浏览器 tab 中重新挂载原 thread
- **THEN** 页面 MUST 恢复原 fork operation identity 与 ambiguous 状态
- **AND** 再次触发同一消息 action MUST 发送原 identity 和 `retryAmbiguousFork: true`
- **AND** MUST NOT 因 React ref 已重建而创建新的 fork identity

#### Scenario: Pending fork becomes ambiguous after component remount
- **WHEN** fork 请求已发出但尚未返回时 ThreadPage 卸载，并在同一浏览器 tab 中重新挂载原 thread
- **THEN** 页面 MUST 恢复原 fork operation identity，并将持久化的 pending 状态按 ambiguous 处理
- **AND** 再次触发同一消息 action MUST 发送原 identity 和 `retryAmbiguousFork: true`
- **AND** Web cache 已丢失时 MUST 失败关闭，MUST NOT 创建第二个 fork

#### Scenario: Stale fork callback cannot overwrite a remounted attempt
- **WHEN** 原 ThreadPage 的 fork 或 fork-local rollback 请求在卸载后仍未完成
- **AND** 重挂载页面对同一消息 action 发起的新 attempt 已取得结果
- **THEN** 原页面迟到的成功或失败回调 MUST NOT 覆盖新 attempt 的 session 状态
- **AND** MUST NOT 再次执行 rollback、写入错误提示或触发页面跳转

#### Scenario: Confirmed fork rejection uses a new action
- **WHEN** fork 在 app-server 调用前被明确拒绝
- **THEN** 当前 action MUST 标记为 rejected 并清理 operation identity
- **AND** 用户后续重新发起 Fork MAY 创建新的 operation identity

#### Scenario: Fork then rollback remains isolated
- **WHEN** fork operation 成功并在 forked thread 上执行 rollback
- **THEN** 原 thread timeline MUST 保持不变
- **AND** operation identity MUST 只关联 fork 创建动作，不得把 rollback 重试误当作另一个 fork

#### Scenario: Fork resolved but rollback response is lost
- **WHEN** fork API 已返回新 thread，但 fork-local rollback 的响应超时、断开或失败
- **THEN** 用户重试同一消息 action MUST 复用已返回的 forked thread，MUST NOT 再次调用 fork API
- **AND** rollback MUST 复用原 fork-local rollback operationId
- **AND** MUST NOT 创建第二个 fork 或使用新的 rollback operationId 猜测状态

#### Scenario: Resolved fork survives component remount
- **WHEN** forked thread 已明确返回，但 fork-local rollback 结果未知后页面重挂载
- **THEN** 页面 MUST 根据已保存的 forked thread id 读取同一 thread
- **AND** MUST 复用原 rollback operationId，MUST NOT 再次调用 fork API

#### Scenario: Fork rollback returns a confirmed conflict
- **WHEN** fork 已返回新 thread，fork-local rollback 明确返回 conflict、unresolved 或 repair-required
- **THEN** 后续重试 MUST 继续使用同一 forked thread，并在执行前刷新其权威详情
- **AND** MUST 为新前置条件创建新的 rollback operationId
- **AND** MUST NOT 复用已缓存 rejected promise 或创建第二个 fork

#### Scenario: Fork 回滚失败
- **WHEN** fork 已创建但新 thread rollback 失败
- **THEN** 系统 MUST NOT 静默跳转到错误历史状态
- **AND** MUST 向用户呈现失败反馈
- **AND** MUST 保持原 thread 可继续使用
