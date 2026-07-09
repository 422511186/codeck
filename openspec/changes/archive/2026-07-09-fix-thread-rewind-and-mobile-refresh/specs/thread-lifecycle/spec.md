## MODIFIED Requirements

### Requirement: Thread rollback
系统 SHALL 支持回滚会话指定数量的 turns。rollback 返回的会话详情 SHALL 表示回滚后的 thread history，前端用于消息级回滚时 MUST 用该详情替换本地 timeline。rollback 成功后，系统 MUST 清理或失效被删除 turns 的 realtime overlay、事件缓存和 late event，使这些 turns 不会再次出现在当前 thread timeline。若 app-server rollback 响应只包含有限 turns 窗口，Web 层 MUST 保留或恢复正确分页语义，不能把有限窗口误标记为已经到达会话开头。

#### Scenario: Rollback thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/rollback` 并提供 `numTurns`
- **THEN** 调用 `gateway.rollbackThread(threadId, numTurns)`，返回回滚后的会话详情
- **AND** 返回的 timeline MUST 不包含被删除 turns 的 overlay item

#### Scenario: Rollback response replaces client timeline
- **WHEN** 前端为了消息级「回滚到这里」调用 rollback 且请求成功
- **THEN** 前端 MUST 使用返回的会话详情替换当前 thread timeline
- **AND** MUST NOT 使用保留旧尾部条目的 merge 策略
- **AND** MUST NOT 使用 rollback 前本地 entries 切片作为 timeline fallback

#### Scenario: Rollback preserves pagination state
- **WHEN** app-server rollback 响应中的 thread turns 不是完整历史
- **AND** 回滚后仍可能存在更早 turns
- **THEN** Web 返回给前端的 thread detail MUST 带有可继续读取更早历史的 cursor 或等价未到开头状态
- **AND** 前端 MUST NOT 将该 timeline 视为完整会话开头

#### Scenario: Rollback only changes history
- **WHEN** 系统执行 thread rollback
- **THEN** rollback MUST 只修改 thread history
- **AND** MUST NOT 自动还原 agent 已经写入本地工作区的文件变更

#### Scenario: Late events after rollback
- **WHEN** rollback 成功后收到属于已删除 turn 的 realtime 事件
- **THEN** 系统 MUST 忽略该事件或标记为过期
- **AND** 后续 `readThread` MUST NOT 通过 overlay 把该事件重新追加到 timeline
