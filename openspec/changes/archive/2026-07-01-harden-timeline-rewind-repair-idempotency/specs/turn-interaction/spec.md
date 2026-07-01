## ADDED Requirements

### Requirement: Lightweight turn start preserves client message identity
`turn/start` Web API MAY 返回轻量 `{turnId}`，但客户端 SHALL 将该 `turnId` 与本次发送的 `clientUserMessageId` 稳定绑定。绑定后的 optimistic user message MUST 保持可确认、可 rewind/fork，并且 MUST NOT 因后续相同文本发送而被合并。

#### Scenario: Lightweight start for repeated prompt
- **WHEN** `turn/start` 只返回 `{turnId}`
- **AND** 用户随后发送另一条相同文本消息并获得不同 `turnId`
- **THEN** 两个 optimistic user message MUST 分别绑定各自 `turnId`
- **AND** 服务端确认任一 user item 时 MUST 按 client id 或 turn id 替换对应 entry
