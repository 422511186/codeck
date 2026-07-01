## ADDED Requirements

### Requirement: Reconnect repair is only triggered by confirmed gaps
timeline event stream 客户端 SHALL 区分普通连接错误和确认不可恢复的事件缺口。浏览器 `EventSource error` 本身 MUST NOT 直接触发 snapshot repair；只有服务端明确发送 `timeline-gap`、或客户端检测到无法通过补发恢复的缺口时，客户端 SHALL 执行 `readThread` repair。

#### Scenario: EventSource error waits for replay
- **WHEN** 浏览器 SSE 连接触发 `error`
- **THEN** 客户端 MUST 标记连接为 reconnecting
- **AND** 客户端 MUST NOT 立即为当前 active thread 请求 snapshot repair

#### Scenario: Server reports timeline gap
- **WHEN** SSE endpoint 因 `Last-Event-ID` 超出 backlog 或无法可靠过滤旧事件而发送 `timeline-gap`
- **THEN** 客户端 MUST 为对应 thread 执行一次 snapshot repair
- **AND** repair 结果 MUST replace 当前 thread 的未知尾部

### Requirement: Rollback barriers cover live overlay turns
thread rollback、message rewind 或 fork rollback 成功后，服务端和前端 SHALL 屏蔽 rollback 前目标 tail 中的所有 turn，包括尚未 materialized 到 `thread/read` snapshot、但已进入 overlay 或 event stream 的 live turn。

#### Scenario: Live turn is rewound before snapshot materializes
- **WHEN** 用户发送消息后收到该 turn 的 live reasoning、tool 或 agent delta
- **AND** 该 turn 尚未出现在 rollback 前的 `thread/read` snapshot
- **AND** 用户 rewind 删除该 turn
- **THEN** 服务端 MUST 清理该 turn 的 overlay 和 backlog 可见事件
- **AND** 后续该 turn 的 late event MUST NOT 重新显示在 timeline

### Requirement: Event id idempotency survives repair
客户端 SHALL 在 snapshot repair、generation bump 或 timeline replace 后保留足够的近期事件幂等信息。已处理过的同一 `eventId` 在同一可恢复窗口内 MUST NOT 因 replace repair 而再次追加可见内容。

#### Scenario: Processed event replays after repair
- **WHEN** 客户端已经处理某个 `agent_message_delta` eventId
- **AND** snapshot repair replace 了当前 thread timeline
- **AND** SSE 自动重连再次补发同一 eventId
- **THEN** 客户端 MUST 忽略该重复事件
- **AND** MUST NOT 再次追加相同文本 delta
