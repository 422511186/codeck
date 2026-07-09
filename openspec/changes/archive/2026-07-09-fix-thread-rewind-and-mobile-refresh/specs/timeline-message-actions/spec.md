## MODIFIED Requirements

### Requirement: Message actions require reliable live turn metadata
消息级「回滚到这里」和「从这里 Fork」SHALL 只在前端能可靠定位目标 user message 所属 turn，并能可靠计算目标 turn 到当前尾部 turns 数时启用。实时事件、overlay 和 snapshot 混合后的 timeline entries MUST 保留 `turnId`，且历史窗口 MUST 能证明目标 turn 到尾部的完整范围，否则不得执行 rollback/fork。系统 MUST NOT 使用文本唯一匹配、createdAt、数组下标或渲染候选 fallback 作为破坏性历史操作的目标身份。

#### Scenario: Newly streamed turn remains rewind-addressable after completion
- **WHEN** 用户发送消息并通过 timeline event stream 收到该 turn 的 user、agent、reasoning 或 tool entries
- **AND** turn 完成后 thread 静止
- **THEN** 该 turn 的 user message entry MUST 保留 `turnId`
- **AND** 用户无需刷新页面即可对该 user message 执行「回滚到这里」或「从这里 Fork」

#### Scenario: Missing turn metadata blocks action
- **WHEN** 用户长按某条 user message 并选择 rewind/fork
- **AND** 前端无法可靠获得该 user message 的 `turnId` 或无法确认已知尾部范围
- **THEN** 系统 MUST NOT 调用 rollback 或 fork
- **AND** MUST 提示用户重新加载或稍后重试

#### Scenario: Text fallback cannot choose rollback target
- **WHEN** 当前 timeline 中点击的 user entry 无法通过稳定 entry id、clientUserMessageId、turnId 或等价 normalized identity 在当前 thread 中定位
- **AND** 存在一条文本相同或唯一文本匹配的其他 user message
- **THEN** 系统 MUST NOT 使用文本匹配结果调用 rollback 或 fork
- **AND** MUST 显示无法定位目标消息的反馈

#### Scenario: Incomplete page window blocks rollback range
- **WHEN** 当前 timeline window 仍有 `nextCursor` 指向更早历史
- **AND** 前端不能证明目标 turn 到当前尾部的完整 distinct turn 范围
- **THEN** 系统 MUST NOT 根据当前窗口猜测 `numTurns`
- **AND** MUST 禁用或拒绝 rewind/fork 操作

### Requirement: 身份缺失或歧义时消息操作必须失败关闭
当 timeline entry 缺少可靠 turnId、generation、item identity 或当前尾部范围时，消息级 rewind/fork SHALL 失败关闭。系统 MUST 禁用历史操作或显示不可用反馈，MUST NOT 为了保持按钮可用而回退到文本相似、createdAt 或数组下标猜测。

#### Scenario: Ownerless user event
- **WHEN** 某条 user-visible entry 缺少可靠 threadId 或 turnId
- **THEN** 消息级菜单 MUST 不提供可执行的 rewind/fork
- **AND** 系统 MAY 提示需要等待同步或重新加载

#### Scenario: 身份冲突
- **WHEN** 两条 normalized entry 声称拥有相同 turn/item 身份但内容或 generation 冲突
- **THEN** timeline engine MUST 标记诊断或触发 bounded repair
- **AND** 在冲突解决前 rewind/fork MUST 不可执行

#### Scenario: Stable candidate missing from current entries
- **WHEN** 用户触发 rewind/fork 时传入的 entry 不再存在于当前 thread 的 normalized entries
- **THEN** 系统 MUST NOT 通过文本、时间或数组位置寻找替代 entry
- **AND** MUST 失败关闭并保留当前 thread history
