## ADDED Requirements

### Requirement: Fresh event consumers establish an explicit baseline
timeline event stream SHALL 为没有可恢复 `Last-Event-ID` 的新消费者提供显式 baseline 控制状态。无 cursor 连接 MUST NOT 被解释为已经覆盖现有 backlog；客户端必须通过 bounded snapshot 与 stream watermark 建立可证明的当前基线后再消费增量。

#### Scenario: Fresh device connects without a cursor
- **WHEN** 新设备打开 EventSource 且请求没有 `Last-Event-ID`
- **THEN** SSE endpoint MUST 发送包含当前 `bootId` 和 stream cursor/watermark 的 baseline-required 控制事件
- **AND** 页面 MUST 为当前 visible thread 读取 metadata 与 bounded latest page
- **AND** 服务端 MUST NOT 静默返回空 backlog 并宣称不存在 gap

#### Scenario: Cached client reconnects without a cursor
- **WHEN** 客户端已有 cached/tracked thread 但新 EventSource 没有可恢复 cursor
- **THEN** 客户端 MUST 为受影响的 cached/visible threads 建立按 `HistoryStamp` 去重的 bounded repair
- **AND** MUST NOT 只等待下一条 live event 来推断缺失区间

#### Scenario: Live events arrive while baseline is loading
- **WHEN** metadata/latest-page baseline 请求仍在进行
- **AND** 同一 thread 收到 baseline watermark 之后的 live events
- **THEN** 客户端 MUST 保留这些 events 并在 snapshot 提交后按 identity/watermark 合并
- **AND** snapshot MUST NOT 覆盖或重复这些 live events

### Requirement: Runtime overlays do not define rollback turn membership
runtime overlay、rollout supplement 和 timeline content repair SHALL 只补充属于权威 turn manifest 的内容。它们 MUST NOT 独立创建或重排可参与 rollback 计数的 turn membership。

#### Scenario: Completed overlay falls outside latest page
- **WHEN** 一个旧 completed overlay 的 turn 已不在 bounded latest authoritative manifest 中
- **THEN** gateway MUST NOT 把该 overlay 追加到当前 timeline 尾部作为新的 turn
- **AND** MUST 清理该 overlay、忽略它或触发 scoped repair

#### Scenario: Current live turn is authoritative
- **WHEN** gateway 已从 `turn/start` response 或 `turn_started` event 获得当前 live `turnId`
- **THEN** 该 turn MAY 进入当前 generation 的 authoritative manifest
- **AND** 同 turn overlay items MUST 附着到该 identity 而不是创建 synthetic tail turn

#### Scenario: Supplement identity cannot become a rollback unit
- **WHEN** rollout supplement 产生 `rollout-*` 或其他无法映射到 app-server turn manifest 的 identity
- **THEN** 该内容 MUST NOT 进入 ordered distinct rollback turns
- **AND** 无法安全附着时 MUST 标记 repair-required 或保持非破坏性展示

### Requirement: Partial output does not suppress confirmed final reconciliation
可见 agent、reasoning 或 tool output SHALL 只抑制 active 阶段的 missing-output fallback。已知 active turn 被 summary 或等价权威状态确认进入 idle 后，客户端 MUST 执行一次 generation-scoped final reconcile，即使当前已有 partial output。

#### Scenario: Partial agent output then missed completion tail
- **WHEN** 客户端已显示当前 turn 的部分 agent output
- **AND** 后续 live events 未送达
- **AND** summary 确认 thread 已从 active 变 idle
- **THEN** 客户端 MUST 为该 turn 执行一次 bounded latest-page final reconcile
- **AND** MUST 将 partial output 收敛为权威完成态

#### Scenario: Visible output suppresses only active missing-output fallback
- **WHEN** thread 仍为 active 且当前 turn 已有可见输出
- **THEN** 客户端 MUST NOT 仅因 missing-output timer 读取 timeline page
- **AND** 该抑制 MUST NOT 延续到后续确认的 active-to-idle final reconcile
