## ADDED Requirements

### Requirement: Timeline events carry history generation
timeline event stream SHALL 为每个会影响可见 timeline 的事件携带当前 thread history generation。rollback、message rewind、fork rollback 或 snapshot repair 确认历史被替换后，服务端 SHALL 推进对应 thread 的 generation；客户端 MUST 记录当前 generation 并拒绝低于当前 generation 的可见事件。

#### Scenario: Late event from previous generation is ignored
- **WHEN** thread rollback 成功并推进 generation
- **AND** 浏览器之后收到旧 generation 的 agent、reasoning、tool、diff 或 item completion 事件
- **THEN** 前端 MUST 忽略该事件
- **AND** timeline MUST NOT 重新显示已删除尾部内容

#### Scenario: New generation event is accepted
- **WHEN** rollback 后用户重新发送消息并产生新 generation 的事件
- **THEN** 前端 MUST 接受新 generation 事件
- **AND** 新输出 MUST 追加到 rollback 后的 timeline

### Requirement: Event replay is idempotent after snapshot repair
timeline event stream replay、浏览器自动重连补发和 snapshot repair SHALL 使用同一幂等规则。客户端已经通过 snapshot 拥有的文本或 item completion MUST NOT 被后续旧 delta 再次追加；无法证明 delta 是新尾部时，客户端 MUST 忽略该 delta 或触发新的 snapshot repair。

#### Scenario: Replayed middle delta is ignored
- **WHEN** snapshot repair 已把 item 文本替换为 `hello world`
- **AND** 后续补发 delta 为 `world`
- **THEN** 前端 MUST NOT 把文本变成 `hello worldworld`
- **AND** 该 delta MUST 被视为已被 snapshot 覆盖

#### Scenario: New tail delta is appended
- **WHEN** snapshot repair 已把 item 文本替换为 `hello world`
- **AND** 后续收到同一 item 的新 generation 或可证明 offset 在末尾之后的 delta `!`
- **THEN** 前端 MUST 把文本更新为 `hello world!`

### Requirement: Event backlog honors rollback barriers
服务端事件 backlog SHALL 遵守 rollback/fork 后的 history generation 和 deleted turn 屏障。SSE 补发时 MUST NOT 补发会在当前 thread 历史中重新显示已删除 tail 的旧可见事件；若无法筛除，服务端 MUST 发送 `timeline-gap` 让客户端执行 snapshot repair。

#### Scenario: Backlog contains deleted turn events
- **WHEN** 客户端携带旧 `Last-Event-ID` 重连
- **AND** backlog 窗口中包含已被 rollback 删除 turn 的可见事件
- **THEN** 服务端 MUST 不补发这些可见事件
- **AND** 若补发范围无法可靠过滤，MUST 发送 `timeline-gap`

