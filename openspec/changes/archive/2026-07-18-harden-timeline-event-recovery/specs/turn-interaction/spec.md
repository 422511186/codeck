## MODIFIED Requirements

### Requirement: Lightweight turn start preserves client message identity
`turn/start` Web API MAY 返回轻量 `{turnId}`，但客户端 SHALL 将该 `turnId` 与本次发送的 `clientUserMessageId` 稳定绑定。绑定后的 optimistic user message MUST 保持可确认、可 rewind/fork，并且 MUST NOT 因后续相同文本发送而被合并。若 `turn/start` 的网络结果未知，失败 entry MUST 保留原 `clientUserMessageId`、原始 payload fingerprint、发起时 bootId 和 ambiguous outcome；查询或重试该发送动作 MUST 使用同一 identity。同 boot 内服务端 SHALL 返回已创建的 `turnId` 或继续同一幂等操作；boot 已改变且无法查询或从有界历史唯一确认原动作时，服务端 MUST 失败关闭为 unresolved，MUST NOT 再次启动 turn。

#### Scenario: Lightweight start for repeated prompt
- **WHEN** `turn/start` 只返回 `{turnId}`
- **AND** 用户随后发送另一条相同文本消息并获得不同 `turnId`
- **THEN** 两个 optimistic user message MUST 分别绑定各自 `turnId`
- **AND** 服务端确认任一 user item 时 MUST 按 client id 或 turn id 替换对应 entry

#### Scenario: Accepted turn start response is lost
- **WHEN** 服务端已经按 `clientUserMessageId` 接受 `turn/start` 并创建 turn
- **AND** HTTP 响应在客户端收到 `turnId` 前超时、断开或无法解析
- **THEN** 客户端 MUST 将该发送动作标记为 ambiguous，而不是创建新的发送身份
- **AND** 查询或重试 MUST 复用原 `clientUserMessageId` 和未修改 payload
- **AND** 服务端 MUST 返回已创建的同一 `turnId` 或继续同一幂等操作，MUST NOT 再调用第二次 app-server `turn/start`

#### Scenario: Confirmed rejection permits a new action identity
- **WHEN** 服务端明确返回输入校验拒绝或其他可证明没有创建 turn 的结果
- **AND** 用户修正或重新提交内容形成新的发送动作
- **THEN** 客户端 MAY 为该新动作生成新的 `clientUserMessageId`
- **AND** 客户端 MUST NOT 把结果未知的超时、连接中断、5xx 或解析失败当作已确认拒绝

#### Scenario: Gateway restart does not replay an unresolved start
- **WHEN** 客户端使用旧 boot 的 `clientUserMessageId` 重试 ambiguous start
- **AND** 新 boot 无法从 app-server 或 bounded latest page 唯一确认原 turn
- **THEN** Web MUST 返回显式 unresolved 结果并保留原失败 entry
- **AND** MUST NOT 再次调用 app-server `turn/start`
- **AND** 用户只有明确确认开始新的发送动作时 MAY 生成新 identity

### Requirement: Final stream failure remains a single explicit retryable turn
Web SHALL 为一次发送只创建一个 turn。上游流最终失败时，Web MUST 保留失败用户消息、原始错误信息和已绑定的 `turnId`，并仅在用户显式选择重试时将原文本、图片和 skill 引用作为新的发送动作创建新 turn。与此不同，发生在 `turn/start` 接受结果尚未知阶段的超时、连接中断、5xx 或响应解析失败 MUST 保留并复用原 `clientUserMessageId`，不得被当作已结束 turn 的新动作重试。

#### Scenario: Upstream Responses stream disconnects
- **WHEN** app-server 上报 `stream disconnected before completion` 且不再重试
- **THEN** 当前用户消息 MUST 标记为失败
- **AND** Web MUST NOT 自动再次调用 `turn/start`
- **AND** 用户 SHALL 能通过显式“重试”将原文本、图片和 skill 引用作为新发送动作重新发送

#### Scenario: Duplicate start request uses the same client message id
- **WHEN** 相同 `clientUserMessageId` 在去重窗口内重复到达 start API
- **THEN** 服务端 MUST 复用同一个进行中的请求或已创建的 turn 结果
- **AND** app-server MUST NOT 收到第二个 `turn/start`

#### Scenario: Ambiguous start failure is not a final stream failure
- **WHEN** 客户端尚未收到 `turnId`，且 `turn/start` 请求因超时、连接中断、5xx 或响应解析失败而结束
- **THEN** Web MUST 将 outcome 记录为 ambiguous 并保留原 `clientUserMessageId`
- **AND** 显式重试该未决发送动作 MUST 查询或复用相同幂等身份
- **AND** 只有已知 turn 随后发生最终 stream failure 后的用户显式重试，才 SHALL 作为新的发送动作生成新身份
