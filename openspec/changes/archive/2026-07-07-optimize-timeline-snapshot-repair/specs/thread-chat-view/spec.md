## MODIFIED Requirements

### Requirement: Running chat view uses event stream instead of full-timeline polling
会话聊天页 SHALL 在首屏 snapshot 后使用 timeline event stream 更新 running thread。页面 MUST NOT 在事件流正常时以固定短间隔轮询 `/api/codex/threads/:threadId` 获取完整 timeline。Snapshot repair SHALL 只作为确认缺口或明确异常窗口的有界恢复手段；一次 repair 返回 active 状态本身 MUST NOT 安排下一次 full-thread detail repair。

#### Scenario: Initial snapshot then event stream
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MAY 调用一次 `readThread` 获取初始 timeline
- **AND** running 状态下后续新增输出 MUST 通过 timeline event stream 更新

#### Scenario: No two-second full timeline polling
- **WHEN** thread 处于 running 状态且事件流连接正常
- **THEN** 页面 MUST NOT 每 2 秒或其他固定短周期调用 `/api/codex/threads/:threadId` 拉取完整 thread detail
- **AND** timeline 增量 MUST 由事件流驱动

#### Scenario: Repair read only after stream gap or explicit missing-output recovery
- **WHEN** 事件流断线、重连补发失败、检测到事件缺口，或当前 active turn 完成后缺少可见服务端输出
- **THEN** 页面 MAY 调用 `readThread` 执行一次 snapshot repair
- **AND** repair 完成后 MUST 回到事件流主路径
- **AND** repair 结果仍为 active MUST NOT 仅因此重新安排下一次 full-thread detail repair

#### Scenario: Active repair result does not loop
- **WHEN** 页面因已确认的 repair 标记调用 `/api/codex/threads/:threadId`
- **AND** repair 返回的 thread 仍处于 running 状态
- **THEN** 页面 MUST 应用该 repair snapshot 并清除已完成的 repair 标记
- **AND** 页面 MUST NOT 因该 active snapshot 自动启动新的短周期 repair timer

#### Scenario: Send fallback is one-shot when no visible output arrives
- **WHEN** 用户发送消息后 `startTurn` 没有返回可用 thread snapshot
- **AND** 当前 turn 在短暂等待窗口内没有任何可见服务端输出
- **THEN** 页面 MAY 发起一次 snapshot repair 恢复缺失输出或状态
- **AND** 该 repair 成功应用后 MUST NOT 因 thread 仍 active 而继续重复 full-thread detail repair

#### Scenario: Visible live output cancels missing-output fallback
- **WHEN** 用户发送消息后页面已为当前 turn 收到 agent、reasoning、tool、command、diff 或 error 等可见服务端输出
- **THEN** 页面 MUST NOT 再因该 turn 的 missing-output fallback 调用 `/api/codex/threads/:threadId`
- **AND** 后续输出 MUST 继续由 timeline event stream 更新
