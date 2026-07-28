## ADDED Requirements

### Requirement: Completed-turn reconciliation is coalesced and repair commits once
会话聊天页 SHALL 将 completion event 与权威 summary 的 active-to-idle 变化合并为同一 generation、同一 turn 的一个 final-reconcile 协调周期，即使该 turn 已有 partial agent、tool 或 command 输出也 MUST 执行。协调周期 MAY 按既有有界 materialization 策略重试读取，但每个成功 repair response MUST 只以 `replace-latest-window` 语义提交一次；页面 MUST NOT 随后把同一 payload 再作为普通 merge 输入提交。重复完成信号 MUST 复用或忽略已有协调周期，不能重复启动并发 final reconcile。

#### Scenario: Partial command output still receives final reconcile
- **WHEN** running turn 已显示一个或多个 command 或 partial assistant entries
- **AND** 页面收到该 turn 的 completion event，或 summary 确认 thread 从 active 变 idle
- **THEN** 页面 MUST 启动该 generation 和 turn 的 bounded final-reconcile 周期
- **AND** 可见 partial 输出 MUST NOT 抑制完成态对账

#### Scenario: Completion event and idle summary coalesce
- **WHEN** 同一 generation 和 turn 的 completion event 与 idle summary 在相邻时段到达
- **THEN** 页面 MUST 将二者合并到同一个 final-reconcile 周期
- **AND** MUST NOT 因两个信号并发读取或重复提交同一 latest page

#### Scenario: Repair response is not resubmitted as merge
- **WHEN** final reconcile 返回带权威窗口边界和 watermark 的 bounded latest page
- **THEN** 页面 MUST 只提交一次 `replace-latest-window`
- **AND** MUST NOT 随后以普通 `merge` 再次提交相同 entries，从而覆盖 live `sourceOrder`、`streamSequence`、revision 或 suppression metadata

#### Scenario: Completed timeline converges across manual refresh
- **WHEN** final reconcile 已完成且用户随后手动刷新同一会话
- **THEN** 刷新基线与刷新前 timeline MUST 产生相同的可见 entry identity 顺序
- **AND** 不同 command identity MUST 保持独立，且不能跨越中间 assistant message 改变 activity 分组
