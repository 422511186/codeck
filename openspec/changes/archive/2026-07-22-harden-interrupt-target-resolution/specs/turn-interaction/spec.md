## ADDED Requirements

### Requirement: Interrupt client does not guess from historical tail

会话页 SHALL 仅在已知当前 active turn identity 时向 interrupt API 显式发送 `turnId`。当 active identity 未知时，客户端 MUST 省略 `turnId` 并让 gateway 解析当前 active turn；MUST NOT 使用 thread detail 的历史 `lastTurnId`、timeline 尾部、createdAt 或文本作为替代目标。

#### Scenario: Active identity missing while lastTurnId is stale

- **WHEN** thread 状态为 active、store 尚无 `activeTurnId`，且 detail 的 `lastTurnId` 指向上一轮终态 turn
- **THEN** 客户端调用 interrupt API 时 MUST 省略 `turnId`
- **AND** route MUST 使用 gateway 当前 active identity 或稳定返回 409
- **AND** MUST NOT 显式中断 stale `lastTurnId`

#### Scenario: Known active identity remains explicit

- **WHEN** store 已记录当前 `activeTurnId`
- **THEN** 客户端 MUST 将该 identity 作为 interrupt 的显式目标
- **AND** detail 中不同的 `lastTurnId` MUST NOT 覆盖该 identity

#### Scenario: Duplicate interrupt clicks remain serialized

- **WHEN** 第一次 interrupt 请求仍在进行中且用户再次点击中断
- **THEN** 页面 MUST 复用或忽略重复操作，MUST NOT 发出第二个并发 interrupt 请求
