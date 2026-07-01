## ADDED Requirements

### Requirement: Message actions require reliable live turn metadata
消息级「回滚到这里」和「从这里 Fork」SHALL 只在前端能可靠定位目标 user message 所属 turn，并能可靠计算目标 turn 到当前尾部 turns 数时启用。实时事件、overlay 和 snapshot 混合后的 timeline entries MUST 保留 `turnId`，否则不得执行 rollback/fork。

#### Scenario: Newly streamed turn remains rewind-addressable after completion
- **WHEN** 用户发送消息并通过 timeline event stream 收到该 turn 的 user、agent、reasoning 或 tool entries
- **AND** turn 完成后 thread 静止
- **THEN** 该 turn 的 user message entry MUST 保留 `turnId`
- **AND** 用户无需刷新页面即可对该 user message 执行「回滚到这里」或「从这里 Fork」

#### Scenario: Missing turn metadata blocks action
- **WHEN** 用户长按某条 user message 并选择 rewind/fork
- **AND** 前端无法可靠获得该 user message 的 `turnId` 或无法确认已知尾部范围
- **THEN** 系统 MUST NOT 调用 rollback 或 fork
- **AND** MUST 提示用户重新加载或稍后重试

### Requirement: Rewind and fork discard old local tail state
消息级 rewind/fork 成功后，前端 SHALL 以服务端返回的 thread detail 作为唯一 timeline 来源。旧本地 entries、旧 overlay、旧 event stream delta 和 rollback 前的本地切片 MUST NOT 被重新写入回滚后的 thread timeline。

#### Scenario: Rewind replace ignores local fallback
- **WHEN** 「回滚到这里」调用 rollback 成功
- **THEN** 前端 MUST 用 rollback 返回的 thread detail replace 当前 timeline
- **AND** MUST 仅把目标 user message 文本写入 draft
- **AND** MUST NOT 把 rollback 前的本地 entriesBeforeTarget 作为 timeline fallback

#### Scenario: Fork rollback initializes new thread from server result
- **WHEN** 「从这里 Fork」先 fork 后 rollback 成功
- **THEN** 新 thread 的初始 timeline MUST 来自 rollback 后服务端 thread detail
- **AND** 原 thread timeline MUST 保持不变
- **AND** 新 thread MUST 不包含被回滚删除的旧 tail entries

#### Scenario: Deleted tail does not reappear after resend
- **WHEN** 用户 rewind 成功并修改 draft 后再次发送
- **THEN** 新 turn 的 event stream MUST 只显示新历史上的输出
- **AND** 被 rewind 删除的旧 user/agent/reasoning/tool entries MUST NOT 通过 late event 或 overlay 再次显示
