## ADDED Requirements

### Requirement: Mutation responses preserve the progressive timeline window
会话发送、resume、rename、steer、interrupt、review、fork 和 unarchive 等 mutation SHALL 只更新操作结果或 thread metadata，MUST NOT 通过响应中的完整 timeline 扩展或替换当前分页窗口。rollback 如需刷新可见消息，MUST 返回受控最新页和 cursor。

#### Scenario: Send while thread is not loaded
- **WHEN** 用户在缓存消息可见但 thread 状态为 `notLoaded` 时发送消息
- **THEN** resume MUST 只 materialize 会话并返回 metadata 或显式有界页
- **AND** 页面 MUST 保留当前已加载分页窗口
- **AND** 页面 MUST NOT 使用 `response.thread.turns` replace 当前 timeline

#### Scenario: Mutation response contains unexpected turns
- **WHEN** 上游忽略 `excludeTurns` 或其他 metadata-only 参数并在 mutation 响应中返回完整 turns
- **THEN** Web 服务 MUST 在公开 API 边界丢弃这些 turns
- **AND** 浏览器响应 MUST NOT 包含完整 timeline

#### Scenario: Rollback refreshes a bounded latest page
- **WHEN** 用户执行 rollback 且成功删除尾部 turns
- **THEN** 页面 MUST 仅使用 rollback 返回的显式最新消息页重建窗口
- **AND** 该页 MUST 包含受控 cursor、条目上限和字节预算

### Requirement: Progressive loading fails closed
消息分页、resume 或 metadata 协议失败时，系统 SHALL 展示局部失败并保持已有分页窗口，MUST NOT 回退到完整 thread detail、metadata 中的 turns 或无 cursor 的历史数组。

#### Scenario: Latest page fails after metadata succeeds
- **WHEN** metadata 请求成功但最新消息页请求失败
- **THEN** 页面 MUST 保持已有消息窗口或显示局部重试状态
- **AND** 页面 MUST NOT 使用 detail timeline 作为消息 fallback

#### Scenario: Resume omits initial page
- **WHEN** `thread/resume` 响应缺少 `initialTurnsPage`
- **THEN** 系统 MUST 将其解释为没有可用消息页
- **AND** 系统 MUST NOT 使用 `response.thread.turns`
