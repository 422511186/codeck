## ADDED Requirements

### Requirement: Running snapshot repair is reasoned and deduplicated
移动端会话页 SHALL 将运行态全量 snapshot repair 视为有明确原因的有界修复动作，而不是轮询机制。每个 repair 请求 MUST 携带可区分来源的 reason，并以 thread、turn、reason 和 history generation 或等价标识生成去重 key。相同 key 的 pending repair MUST NOT 反复触发 `/api/codex/threads/:threadId` 全量读取。

#### Scenario: Summary polling stays lightweight
- **WHEN** 当前 thread 处于 active 或 compact pending 状态
- **THEN** 客户端 MAY 周期性请求 thread summary
- **AND** 该周期性请求 MUST NOT 使用带 timeline 的 `readThread` endpoint

#### Scenario: Duplicate completion repair is suppressed
- **WHEN** 当前 active turn 已因 `turn_completed` 请求 snapshot repair
- **AND** summary 轮询随后也观察到该 thread 已 idle
- **THEN** 客户端 MUST 复用或忽略等价 repair 请求
- **AND** MUST NOT 为同一 turn completion 连续发起多次全量 timeline 读取

#### Scenario: Running without output does not force early full read
- **WHEN** 用户发送消息后 thread 仍处于 active
- **AND** 尚未收到可见 live output
- **AND** 事件流未报告 `timeline-gap`
- **THEN** 客户端 MUST NOT 仅因短固定时间无输出就请求完整 thread timeline
- **AND** 客户端 MUST 继续依赖事件流、运行状态提示和 summary 状态兜底

#### Scenario: Confirmed gap still repairs
- **WHEN** 客户端收到归属到某 thread 的 `timeline-gap`
- **THEN** 客户端 MUST 为该 thread 请求 snapshot repair
- **AND** 该 repair MUST 使用可去重的 gap reason

#### Scenario: Completion without visible output repairs once
- **WHEN** 当前 active turn 完成
- **AND** 当前 timeline 没有该 turn 的可见 agent、tool、reasoning、diff 或 error 输出
- **THEN** 客户端 MUST 请求一次 snapshot repair
- **AND** 后续重复完成事件或 summary idle MUST NOT 造成同一完成原因的重复全量读取
