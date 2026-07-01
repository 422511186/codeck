## ADDED Requirements

### Requirement: Freshly sent user message is rewind-addressable
用户发送消息后，前端 SHALL 在 `turn/start` 成功返回时把返回的 `turnId` 绑定到对应 optimistic user message。该 user message 在无需刷新页面的情况下 MUST 可参与消息级 rewind/fork 的 turn 计数。

#### Scenario: Rewind immediately after send completes
- **WHEN** 用户发送消息
- **AND** `turn/start` 返回 `turnId`
- **AND** thread 之后进入静止态
- **THEN** 刚发送的 user message entry MUST 保留该 `turnId`
- **AND** 用户 MUST 能直接对该消息执行「回滚到这里」

#### Scenario: Server user item confirms local message in place
- **WHEN** 本地 optimistic user message 已绑定 `turnId`
- **AND** 后续收到同一 turn 的 server user item
- **THEN** 前端 MUST 原位替换本地 entry 的 id 和 metadata
- **AND** MUST NOT 删除本地 entry 后把 server user item 追加到 agent 输出之后

### Requirement: Rewind updates visible input draft immediately
消息级 rewind 成功后，系统 SHALL 同步更新当前 `ChatInput` 的可见文本状态和持久化草稿。只写 localStorage 但不更新当前输入框 SHALL NOT be sufficient。

#### Scenario: Rewind fills current input
- **WHEN** 用户点击「回滚到这里」且 rollback 成功
- **THEN** 底部输入框 MUST 立即显示目标 user message 文本
- **AND** 用户 MUST 能在不刷新页面的情况下编辑并重新发送

### Requirement: Message actions are disabled without reliable turn metadata
消息级 rewind/fork 菜单 SHALL 仅在目标 user message 有可靠 `turnId` 且当前已知 timeline 能计算尾部 turns 时启用历史操作。缺少元数据时，UI MUST 不呈现可执行的 rollback/fork 入口，或必须将入口置为不可用并给出反馈。

#### Scenario: Local message has no turn id yet
- **WHEN** user message 仍是未绑定 `turnId` 的 optimistic entry
- **THEN** 「回滚到这里」和「从这里 Fork」MUST 不可执行
- **AND** 系统 MUST NOT 调用 rollback 或 fork API

### Requirement: Fork rollback uses fork-local history metadata
消息级 fork SHALL 在 fork 后以新 thread 的服务端历史为准计算和标记 rollback 屏障。系统 MUST NOT 假设新 thread 的 turnId 与原 thread 完全相同，除非 app-server 明确保证。

#### Scenario: Forked thread has different turn ids
- **WHEN** 原 thread fork 后新 thread 的 turnId 与原 thread 不同
- **AND** 客户端需要在新 thread 上 rollback 到目标消息之前
- **THEN** 客户端 MUST 使用 fork 返回或新 thread read/resume 结果定位等价目标 turn
- **AND** MUST NOT 用原 thread 的 turnId 作为新 thread 的唯一删除屏障

