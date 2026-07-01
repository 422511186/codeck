## ADDED Requirements

### Requirement: Timeline event stream is the realtime source
系统 SHALL 提供面向浏览器的 timeline 增量事件流，用于传递运行中 thread 的 agent message、reasoning、tool、diff、system、error 和 turn lifecycle 事件。系统 SHALL 暴露 SSE endpoint 作为移动 Web 的 timeline event stream 主入口；若同时保留 WebSocket 作为兼容或内部通道，暴露给前端 store 的事件语义 MUST 与本规范一致。

#### Scenario: Running output arrives through event stream
- **WHEN** thread 处于 running 状态且 app-server 产生可见输出
- **THEN** 浏览器 MUST 通过 timeline event stream 收到对应增量事件
- **AND** 系统 MUST NOT 依赖高频 `readThread` polling 才能显示该输出

#### Scenario: HTTP controls remain separate
- **WHEN** 用户发送消息、审批请求、interrupt、rewind 或 fork
- **THEN** 客户端 MUST 继续使用对应 HTTP API 提交控制动作
- **AND** timeline event stream SHALL 只负责服务端到浏览器的状态和输出通知

#### Scenario: SSE endpoint is available
- **WHEN** 浏览器打开会话页并需要接收 running timeline 输出
- **THEN** 客户端 MUST 能连接服务端提供的 SSE timeline event endpoint
- **AND** 该 endpoint MUST 使用 `text/event-stream` 语义持续发送 timeline events

### Requirement: Timeline events carry stable identity and turn metadata
每个会影响 timeline 可见内容的事件 SHALL 携带稳定身份，至少包括 `eventId`、`kind` 以及可用于排序或幂等的 `seq`、`offset`、`revision` 或等价字段。属于某个 thread 的事件 MUST 携带 `threadId`。属于某个 turn 或 item 的事件 MUST 额外携带 `turnId` 和 `itemId`；非 turn-scoped 的 thread/global 事件 MUST 明确标记为不参与 rewind/fork turn 计数。

#### Scenario: Live event can be mapped to a turn
- **WHEN** 浏览器收到 agent、reasoning、tool、diff 或 item completion 事件
- **THEN** 生成或更新的 timeline entry MUST 保留该事件的 `turnId`
- **AND** 后续 rewind/fork 计算 MUST 能识别该 entry 所属 turn

#### Scenario: Thread-level event does not pollute turn counting
- **WHEN** 浏览器收到 warning、settings、connection 或其他没有自然 turn 的 thread/global event
- **THEN** 该事件 MUST 保留稳定 `eventId`
- **AND** 若渲染为 timeline entry，entry MUST 标记为不参与 rewind/fork 的 turn 距离计算
- **AND** 系统 MUST NOT 为了满足 turn 元数据要求伪造会污染历史操作的 `turnId`

#### Scenario: Duplicate event is ignored
- **WHEN** 浏览器因重连、补发或双通道竞态重复收到同一 `eventId`
- **THEN** 前端 MUST 忽略重复事件
- **AND** MUST NOT 再次追加相同文本 delta

#### Scenario: Snapshot-covered delta is not appended again
- **WHEN** 前端已经通过 snapshot 或 item completion 拥有某 item 的完整文本
- **AND** 之后收到较旧的 delta 事件
- **THEN** 前端 MUST 根据事件顺序或 revision 忽略该 delta
- **AND** MUST NOT 产生重复输出

### Requirement: Event stream supports reconnect and repair
timeline event stream SHALL 支持断线重连。客户端可使用 `Last-Event-ID` 或等价游标请求补发；若补发范围不可用，系统 MUST 明确触发 snapshot repair。

#### Scenario: Reconnect with recoverable cursor
- **WHEN** 事件流断开后浏览器携带最后处理的 event id 重连
- **THEN** 服务端 MUST 补发该 id 之后仍在缓存窗口内的事件
- **AND** 前端 MUST 按幂等规则应用补发事件

#### Scenario: Reconnect gap requires snapshot repair
- **WHEN** 服务端无法根据客户端游标补齐缺失事件
- **THEN** 客户端 MUST 执行一次 `readThread` 或等价 snapshot repair
- **AND** repair 结果 MUST replace 当前 thread timeline，而不是保留未知旧尾部

### Requirement: Deleted turn events are ignored after rewind or fork rollback
当 thread rollback、message rewind 或 fork rollback 删除某些 turns 后，服务端和前端 SHALL 阻止这些 turns 的 overlay 或 late event 再次进入 timeline。

#### Scenario: Late event for deleted turn
- **WHEN** rollback 成功后又收到属于已删除 turn 的 agent/reasoning/tool delta
- **THEN** 服务端 MUST 不把该事件写入当前 thread overlay
- **AND** 前端 MUST 忽略该事件
- **AND** timeline MUST NOT 重新显示被 rewind 的旧内容

#### Scenario: Event stream revision advances after rollback
- **WHEN** thread rollback 或 fork rollback 成功
- **THEN** 后续事件 MUST 携带可区分新历史的 revision、generation 或等价标识
- **AND** 客户端 MUST 用该标识拒绝旧历史中的 late event
