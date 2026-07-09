## ADDED Requirements

### Requirement: 消息操作必须使用 engine 派生的稳定 turn 身份
消息级 rewind/fork SHALL 使用 timeline engine 归一化后的稳定身份和 turn metadata 作为唯一计算来源。系统 MUST NOT 直接从渲染文本、数组位置、createdAt 排序或未归一化 snapshot/live 混合条目推断目标 turn。

#### Scenario: Optimistic 用户消息被服务端确认
- **WHEN** 本地 optimistic user message 通过 `turn/start` 和 server user item 被确认
- **THEN** timeline engine MUST 将确认结果合并为一条带稳定 turn 身份的 user entry
- **AND** 消息操作 MUST 使用该 engine entry 计算 rewind/fork 目标

#### Scenario: 渲染层存在重复候选
- **WHEN** 旧代码路径或 repair 暂时产生两个文本相同的 user entry 候选
- **THEN** 消息操作 MUST 只接受 engine 标记为当前有效的 normalized entry
- **AND** MUST NOT 基于用户看到的第一个相同文本猜测 rollback 范围

### Requirement: 尾部 turn 计算必须基于有序且去重的 turns
消息级 rewind/fork 计算需要删除的尾部 turns 时，SHALL 使用 timeline engine 输出的 ordered distinct turns。系统 MUST 去除重复 user/agent/activity entry 对 turn 计数的影响，并 MUST 保留同一 turn 内多个 user/steer item 的真实位置。

#### Scenario: 同一 turn 内存在多个 user item
- **WHEN** 一个 turn 内包含原始 user prompt 和后续 steer user item
- **THEN** rewind/fork MUST 将二者识别为同一个 turn 内不同 item
- **AND** MUST NOT 把后续 steer 当成新的独立 turn 计算尾部数量

#### Scenario: 重复 agent 输出不影响尾部计数
- **WHEN** 同一 turn 的 agent output 因 live/snapshot 重复候选出现多条 raw entry
- **THEN** ordered distinct turns MUST 仍只包含该 turn 一次
- **AND** rewind/fork 删除范围 MUST 不因重复输出而扩大或缩小

#### Scenario: 分页窗口只包含部分历史
- **WHEN** 当前已知 timeline window 不能证明目标 turn 到尾部 turns 的完整范围
- **THEN** rewind/fork MUST 禁用或先触发有界 metadata repair
- **AND** MUST NOT 用不完整窗口猜测 `numTurns`

### Requirement: 同 turn 多 user/steer item 不得被重排或合并
timeline SHALL 保留同一 turn 内多个 user、steer 或 control item 的真实 item 顺序。消息操作必须能区分用户选择的是同 turn 内哪一个 user-visible item，但 rollback/fork 的删除屏障仍以该 item 所属 turn 和合法尾部范围为准。

#### Scenario: 用户选择同 turn 后续 steer
- **WHEN** 同一 turn 内存在 initial user prompt 和后续 steer item
- **AND** 用户长按后续 steer item
- **THEN** 系统 MUST 将菜单目标绑定到该 steer entry 的稳定 item 身份
- **AND** rollback/fork 的 turn 范围 MUST 使用该 entry 所属 turn
- **AND** timeline MUST NOT 因 user phase 排序把 steer item 移到 initial prompt 之前

#### Scenario: 相同文本 user item 不合并
- **WHEN** 同一 turn 或相邻 turns 中存在文本相同的 user-visible item
- **THEN** timeline engine MUST 按稳定 item/turn 身份保留可区分条目
- **AND** 消息操作 MUST 定位用户实际长按的条目

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

