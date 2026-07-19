## ADDED Requirements

### Requirement: Cross-device running thread state converges
会话页 SHALL 让后加入、重新加载或从后台恢复的设备收敛到同一 gateway 的当前 running turn。metadata / summary MUST 提供当前 `activeTurnId` 或等价稳定 identity；页面不得只依赖本设备之前收到的 `turn_started` event。

#### Scenario: Second device opens an active thread
- **WHEN** 设备 A 已启动一个 turn
- **AND** 设备 B 随后打开同一 thread
- **THEN** 设备 B 的 initial metadata/latest-page baseline MUST 恢复 running 状态与 `activeTurnId`
- **AND** 设备 B MUST 显示当前 turn 已 materialized 或 overlay 中的执行记录

#### Scenario: Active metadata has no visible output yet
- **WHEN** fresh device 的 metadata 表明 thread active 并携带 `activeTurnId`
- **AND** initial latest page 尚无该 turn 的可见输出
- **THEN** 页面 MUST 保持 running 状态并为该 turn 安排一次有界 missing-output recovery
- **AND** MUST NOT 因本地 timeline 为空或旧而把 thread 当作 idle

#### Scenario: Background device resumes with partial output
- **WHEN** 设备在后台期间漏过当前 turn 的部分事件
- **AND** 恢复后本地已有该 turn 的 partial output
- **THEN** 页面 MUST 使用 stream cursor、summary 状态和 final reconcile 使 timeline 收敛
- **AND** MUST NOT 因已有任意可见输出而永久保留旧片段

### Requirement: Invalidated initial baseline is rescheduled
initial metadata/latest-page 响应因 live delivery、mutation epoch、HistoryStamp 或 boot barrier 失效时，页面 SHALL 拒绝旧响应，并且 MUST 保留或重新安排建立当前基线的 bounded 请求。拒绝旧响应本身不得成为恢复流程的终点。

#### Scenario: Live event invalidates fresh initial page
- **WHEN** fresh device 的 initial baseline 请求进行中
- **AND** 同一 thread 的 live event 先提交并使请求 guard 失效
- **THEN** 页面 MUST 拒绝旧 initial replace
- **AND** MUST 使用当前 guard 重新建立 bounded baseline 或证明 live state 已覆盖基线

#### Scenario: Boot changes during initial load
- **WHEN** initial 请求使用 boot G1
- **AND** SSE baseline 或 barrier 表明当前 boot 已变为 G2
- **THEN** G1 响应 MUST 不更新 timeline、cursor、running 或 active turn
- **AND** 页面 MUST 为 G2 安排新的 metadata/latest-page baseline

#### Scenario: Baseline retry remains bounded
- **WHEN** initial baseline 因有效 barrier 被重新安排
- **THEN** 重试 MUST 继续只读取 metadata 与 bounded latest page
- **AND** MUST 按当前 `HistoryStamp` 去重并遵守最大重试预算
