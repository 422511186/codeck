## ADDED Requirements

### Requirement: Same-text user turns remain distinct
消息级 rewind/fork 所依赖的 user message 身份 SHALL 以 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份为准。系统 MUST NOT 仅因两个 user message 文本和图片相同，就在不同 turn 之间合并、去重或替换其中任意一条。

#### Scenario: User sends identical prompts in consecutive turns
- **WHEN** 用户连续两轮发送相同文本
- **AND** 每轮 `turn/start` 都返回不同 `turnId`
- **THEN** timeline MUST 同时保留两条 user message
- **AND** 每条 user message MUST 绑定各自的 `turnId`
- **AND** rewind/fork MUST 能定位用户实际选择的那一条

### Requirement: Server confirmation does not cross turn boundaries
server user item 确认 optimistic local user message 时，客户端 SHALL 优先按 `clientUserMessageId` 或 `turnId` 映射原位替换。纯文本 fallback MUST 仅用于未绑定 turn、仍处于 sending 且候选唯一的本地消息；MUST NOT 匹配已经绑定其他 turn 的 sent local message。

#### Scenario: Confirmation for repeated text arrives late
- **WHEN** timeline 中存在两条相同文本的 local user message
- **AND** 它们已经绑定不同 `turnId`
- **AND** 服务端只确认其中一个 turn 的 user item
- **THEN** 客户端 MUST 只替换同 `turnId` 或同 `clientUserMessageId` 的 local entry
- **AND** MUST NOT 删除或覆盖另一条相同文本 user message

### Requirement: Fork rollback fails closed when fork-local target is unavailable
消息级 fork SHALL 在 fork 后基于新 thread 的服务端历史定位等价目标 turn。若无法可靠定位 fork-local 目标，系统 MUST NOT 使用原 thread 的 `numTurns` 猜测 rollback 范围。

#### Scenario: Fork target cannot be resolved
- **WHEN** fork API 返回的新 thread timeline 无法匹配原目标 user message
- **THEN** 客户端 MUST NOT 调用 rollback API 删除 forked thread 的 turns
- **AND** MUST 向用户提示无法定位目标消息，请刷新或稍后重试
