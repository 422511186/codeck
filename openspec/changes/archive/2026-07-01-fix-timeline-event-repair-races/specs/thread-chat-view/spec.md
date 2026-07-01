## ADDED Requirements

### Requirement: Confirmed snapshot repair is not lost across local mutations
会话页 SHALL 使用 thread-local epoch 或等价机制阻止旧 snapshot repair 覆盖较新的 send/rewind/fork 本地状态；但由确认缺口触发的 snapshot repair MUST NOT 因本地 mutation 发生而被静默清除。旧 repair 返回且不能应用时，系统 MUST 保留或重新排队 repair，直到某次 repair 成功应用或被新的权威 snapshot 明确替代。

#### Scenario: Repair returns after send changed epoch
- **WHEN** 客户端因 `timeline-gap` 为某 thread 发起 snapshot repair
- **AND** 用户随后发送消息导致 thread-local mutation epoch 增加
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 新发送的 optimistic entry 或 live delta
- **AND** 客户端 MUST 保留该 thread 的 repair 需求，使后续稳定 epoch 下再次执行 repair 或应用更新的权威 snapshot

#### Scenario: Repair succeeds at current epoch
- **WHEN** snapshot repair 返回时 request epoch 仍是当前 epoch
- **THEN** 客户端 MUST 用 repair 结果 replace 未知尾部
- **AND** repair 成功应用后 MUST 清除该 thread 的 repair 标记

### Requirement: Initial and repair snapshots are not invalidated by failed local actions
会话页 SHALL 只在实际产生本地 timeline mutation 或即将执行服务端历史 mutation 时推进 mutation epoch。仅本地校验失败的 rewind/fork 操作 MUST NOT 作废正在进行的 initial snapshot 或 snapshot repair。

#### Scenario: Rewind target cannot be resolved locally
- **WHEN** 用户尝试 rewind 某条 user message
- **AND** 前端无法可靠定位目标 turn 或计算 rollback 范围
- **THEN** 系统 MUST NOT 调用 rollback API
- **AND** MUST NOT 推进 mutation epoch 使正在返回的 initial snapshot 或 repair snapshot 失效

#### Scenario: Fork target cannot be resolved before rollback
- **WHEN** fork 后无法在 forked thread 中可靠定位等价目标 message
- **THEN** 系统 MUST NOT 调用 rollback API 删除 forked thread turns
- **AND** 原 thread 正在进行的 snapshot/repair MUST NOT 因该失败路径被无意义作废
