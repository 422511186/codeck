## ADDED Requirements

### Requirement: Rollback requires an authoritative tail precondition
消息级 rewind/fork rollback SHALL 在执行破坏性 mutation 前验证当前 thread 的 `HistoryStamp`、目标 `turnId` 和完整尾部 turn manifest。客户端提供的 `numTurns` 或可见 entries 只能作为请求提示，MUST NOT 单独授权 rollback。

#### Scenario: Valid target and tail precondition
- **WHEN** rollback 请求携带稳定 `operationId`、当前 `HistoryStamp`、目标 `turnId` 和 `expectedTailTurnIds`
- **AND** 服务端权威 bounded manifest 与这些值完全一致
- **THEN** gateway MUST 从该 manifest 导出 `numTurns`
- **AND** MUST 在当前 thread 的 mutation lock 内只调用一次 app-server rollback

#### Scenario: Tail changed before rollback
- **WHEN** rollback 请求的 `HistoryStamp`、目标 turn 或 expected tail 与服务端当前 manifest 不一致
- **THEN** 服务端 MUST 返回 conflict 或 repair-required 结果
- **AND** MUST NOT 调用 app-server rollback
- **AND** 浏览器 MUST 保持 timeline 与草稿不变并重新建立有界基线

#### Scenario: Render-only turn cannot widen rollback
- **WHEN** overlay、rollout supplement、synthetic entry 或虚拟化可见切片包含不在权威 manifest 中的 turn-like identity
- **THEN** 该 identity MUST NOT 进入 `expectedTailTurnIds` 或 `numTurns` 计算
- **AND** 消息操作 MUST 等待 repair 或失败关闭

### Requirement: Rollback mutation response establishes the deletion boundary
app-server rollback response 中更新后的 turn membership SHALL 作为本次 mutation 的权威删除结果。后续 bounded page MAY 补充可见 item 与 cursor，但 MUST NOT 改写 mutation response 已证明的 turn membership 或复活 expected deleted turn。

#### Scenario: Immediate page is stale after rollback
- **WHEN** rollback response 已不包含目标尾部 turns
- **AND** 紧随其后的 bounded page 仍包含任一 expected deleted turn
- **THEN** gateway MUST 不提交该 stale page
- **AND** MUST 有界重试到 page 与 mutation response 兼容，或返回 repair-required

#### Scenario: Compatible page enriches lossy response
- **WHEN** rollback response 的 items 不完整但 turn membership 已确定
- **AND** bounded latest page 的 `HistoryStamp` 与 turn manifest 和 mutation response 兼容
- **THEN** gateway MAY 使用该 page 补齐内容和 cursor
- **AND** turn membership 与删除范围 MUST 继续以 mutation response 为准

#### Scenario: Deleted turn is blocked before new history is visible
- **WHEN** rollback 成功删除一个或多个 turns
- **THEN** gateway MUST 在广播或返回新 generation 内容前推进 generation、记录 deleted-turn barrier 并清理相关 overlay
- **AND** snapshot replace、late event、backlog 与 supplement MUST NOT 重新引入这些 turns

### Requirement: Message action eligibility uses complete normalized state
消息级 rewind/fork 的目标身份、同 turn user/steer 关系和尾部范围 SHALL 基于完整 normalized engine state 与权威 turn manifest。虚拟化后的 `visibleEntries` MUST NOT 单独决定破坏性操作是否可用。

#### Scenario: Same turn steer crosses virtualization boundary
- **WHEN** 同一 turn 的 initial user item 与后续 steer item 位于不同虚拟化窗口
- **THEN** 系统 MUST 仍识别二者属于同一 turn
- **AND** MUST NOT 因当前窗口只看见一个 user item 而把 steer 当成独立可回滚 turn

#### Scenario: Target suffix is not fully proven
- **WHEN** 当前 normalized state 无法证明目标 turn 到权威尾部的完整 suffix
- **THEN** rewind/fork MUST 不可执行或先完成 bounded metadata repair
- **AND** MUST NOT 根据数组末尾、时间或文本猜测删除范围
