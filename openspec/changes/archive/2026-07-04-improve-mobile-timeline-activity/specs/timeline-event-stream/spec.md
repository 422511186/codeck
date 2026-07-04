## ADDED Requirements

### Requirement: Skills notifications are normalized for browser consumption
timeline event stream SHALL normalize app-server Skills 加载、变更或失效通知为浏览器可消费事件。该事件 SHALL 至少能驱动 Skills picker 缓存失效；当事件具备可靠 thread/turn 归属且代表用户可见 agent 工作时，timeline SHALL 能将其显示为轻量 activity。

#### Scenario: Skills notification invalidates browser cache
- **WHEN** app-server 发送 Skills 加载、变更、启用状态变化或 roots 变化通知
- **THEN** 浏览器 MUST 收到可识别的 Skills 失效事件或带 Skills scope 的 settings invalidation 事件
- **AND** 前端 MUST 使后续 Skills picker 打开时重新读取 Skills 列表

#### Scenario: Thread-scoped Skills activity is visible
- **WHEN** Skills 通知包含可靠的 `threadId` 或 `turnId`
- **AND** 该通知表示当前 turn 中 agent/runtime 加载或使用了 Skills
- **THEN** timeline MUST 能显示 `Skills loaded` 或等价轻量 activity
- **AND** activity MUST 显示 Skill 名称列表或数量中可用的信息

#### Scenario: Ownerless Skills notification is not misattributed
- **WHEN** Skills 通知没有可靠的 thread 归属
- **THEN** 前端 MUST NOT 默认把该事件追加到当前 active thread
- **AND** 前端 MUST 仍执行 Skills picker 缓存失效或 settings 刷新

### Requirement: Activity-related events preserve stream identity
所有会影响 timeline 可见 activity 的 Skills、tool、command、diff、reasoning 或 raw response 事件 SHALL 携带或获得稳定的浏览器事件身份。客户端 SHALL 对这些事件应用与现有 timeline delta 相同的去重、generation、revision 和 snapshot repair 规则。

#### Scenario: Duplicate Skills activity is ignored
- **WHEN** 浏览器因重连、补发或双通道竞态重复收到同一 Skills activity event
- **THEN** timeline MUST 只显示一次对应 Skills activity
- **AND** Skills picker 缓存失效 MUST 不导致重复 UI 插入

#### Scenario: Skills activity respects generation
- **WHEN** thread rollback、message rewind 或 snapshot repair 后 generation 已推进
- **AND** 浏览器收到旧 generation 的 Skills activity event
- **THEN** 前端 MUST 忽略该可见 activity
- **AND** timeline MUST NOT 重新显示已删除历史中的 Skills 加载活动

#### Scenario: Reconnect preserves activity grouping
- **WHEN** timeline event stream 断线后补发 command、tool、reasoning、diff 或 Skills activity events
- **THEN** 前端 MUST 按原始 event identity 去重
- **AND** activity block MUST 不因为补发而重复显示同一摘要行或重复累加数量

### Requirement: Sent turn output appears without manual refresh
移动端 timeline SHALL 在用户发送消息并成功启动 turn 后，自动显示该 turn 的 agent 回复、工具活动和完成状态。即使 `POST /api/codex/turns/start` 只返回 `turnId`，客户端也 MUST 通过实时事件或 snapshot repair/read-thread 兜底让可见 timeline 与真实 thread history 收敛，不能要求用户手动刷新页面。

#### Scenario: Started turn receives live visible events
- **WHEN** 用户发送消息
- **AND** `POST /api/codex/turns/start` 成功返回 `turnId`
- **AND** app-server 随后发送 agent message、tool、raw response 或 turn progress 相关通知
- **THEN** 浏览器 MUST 将这些通知归一化为当前 thread 的可见 timeline entries 或 activity entries
- **AND** 用户 MUST 能在不刷新页面的情况下看到 agent 回复或活动进展

#### Scenario: Turn completion without visible server entries triggers repair
- **WHEN** 当前 active turn 已收到 `turn_completed` 或等价完成事件
- **AND** 该 turn 在当前 timeline 中没有任何可见的 agent message、tool、raw response 或 activity entry
- **THEN** 前端 MUST 触发 snapshot repair 或重新读取 thread history
- **AND** repair 后 MUST 将 thread history 中属于该 turn 的回复和活动合并到 timeline

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
