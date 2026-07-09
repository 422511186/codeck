## MODIFIED Requirements

### Requirement: Sent turn output appears without manual refresh
移动端 timeline SHALL 在用户发送消息并成功启动 turn 后，自动显示该 turn 的 agent 回复、reasoning、工具活动、diff、raw response、错误和完成状态。即使 `POST /api/codex/turns/start` 只返回 `turnId`，客户端也 MUST 通过实时事件或 snapshot repair/read-thread 兜底让可见 timeline 与真实 thread history 收敛，不能要求用户手动刷新页面。

#### Scenario: Started turn receives live visible events
- **WHEN** 用户发送消息
- **AND** `POST /api/codex/turns/start` 成功返回 `turnId`
- **AND** app-server 随后发送 agent message、reasoning、tool、diff、raw response、activity 或 turn progress 相关通知
- **THEN** 浏览器 MUST 将这些通知归一化为当前 thread 的可见 timeline entries 或 activity entries
- **AND** 用户 MUST 能在不刷新页面的情况下看到 agent 回复或活动进展

#### Scenario: Turn completion without visible server entries triggers repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中没有任何可见的 agent message、reasoning、tool、diff、raw response、activity 或 error entry
- **THEN** 前端 MUST 触发 snapshot repair 或重新读取 thread history
- **AND** repair 后 MUST 将 thread history 中属于该 turn 的回复和活动合并到 timeline

#### Scenario: Completion with tool-only output does not repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中已有可见 tool、activity、reasoning、diff、raw response 或 error 输出
- **THEN** 前端 MUST NOT 仅因缺少 agent message 而触发 completion snapshot repair

#### Scenario: Missing live item event is repaired from history
- **WHEN** `startTurn` 已成功
- **AND** 实时流没有送达可见 item/raw response 事件
- **AND** 重新读取 thread history 后发现该 turn 已产生 agent 回复
- **THEN** 前端 MUST 合并该回复
- **AND** timeline MUST 从“需要刷新才可见”的状态恢复为当前页面可见

#### Scenario: Repaired entries do not duplicate delayed live events
- **WHEN** snapshot repair 已把某个 turn 的 agent 回复或活动合并进 timeline
- **AND** 后续又收到同一内容对应的延迟 live event 或重连补发 event
- **THEN** 前端 MUST 根据 event identity、thread item id、turn id、generation 或 revision 去重
- **AND** timeline MUST NOT 显示重复的 agent 回复、activity 摘要或完成状态

### Requirement: Running snapshot repair is reasoned and deduplicated
移动端会话页 SHALL 将运行态 snapshot repair 视为有明确原因的有界修复动作，而不是轮询机制。每个 repair 请求 MUST 携带可区分来源的 reason，并以 thread、turn、reason 和 history generation 或等价标识生成去重 key。相同 key 的 pending repair MUST NOT 反复触发 `/api/codex/threads/:threadId` timeline 读取。

#### Scenario: Summary polling stays lightweight
- **WHEN** 当前 thread 处于 active 或 compact pending 状态
- **THEN** 客户端 MAY 周期性请求 thread summary
- **AND** 该周期性请求 MUST NOT 使用带 timeline 的 `readThread` endpoint

#### Scenario: Duplicate completion repair is suppressed
- **WHEN** 当前 active turn 已因 `turn_completed` 请求 snapshot repair
- **AND** summary 轮询随后也观察到该 thread 已 idle
- **THEN** 客户端 MUST 复用或忽略等价 repair 请求
- **AND** MUST NOT 为同一 turn completion 连续发起多次 timeline 读取

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
- **AND** 当前 timeline 没有该 turn 的可见 agent、tool、reasoning、diff、raw response、activity 或 error 输出
- **THEN** 客户端 MUST 请求一次 snapshot repair
- **AND** 后续重复完成事件或 summary idle MUST NOT 造成同一完成原因的重复 timeline 读取

#### Scenario: Completion with visible non-agent output is stable
- **WHEN** 当前 active turn 完成
- **AND** 当前 timeline 已有该 turn 的可见 tool-only、reasoning-only、activity-only、diff-only、raw response 或 error 输出
- **THEN** 客户端 MUST NOT 仅因没有 agent message 请求 completion repair
- **AND** 后续确认 gap 或用户显式刷新仍 MAY 触发有界 repair
