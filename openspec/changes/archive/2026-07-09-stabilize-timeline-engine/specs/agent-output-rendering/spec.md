## ADDED Requirements

### Requirement: 等价 agent 输出只能渲染一次
agent 输出渲染层 SHALL 以 timeline engine 提供的 normalized entry 为唯一渲染输入。来自 live delta、completed item、snapshot item、overlay 和 rollout supplement 的同一 agent/reasoning/tool/diff 输出 MUST 合并为同一个可见条目，MUST NOT 因来源不同、文本格式不同或完成态不同而重复渲染。

#### Scenario: Live 与 completed agent message 合并
- **WHEN** 同一 generation、turnId 和 itemId 的 agent message 先通过 live delta 显示
- **AND** 后续 snapshot 或 completed item 返回完整文本
- **THEN** 渲染层 MUST 原位更新同一条 agent message
- **AND** timeline MUST NOT 同时显示 live 版本和 completed 版本

#### Scenario: Tool output 多来源补齐
- **WHEN** 同一 tool call 的输出同时来自 command delta、turn item detail 和 rollout supplement
- **THEN** 渲染层 MUST 只显示一个 tool activity
- **AND** 该 activity MUST 保留最完整的状态、输出和元数据

#### Scenario: Snapshot refresh 不重复旧输出
- **WHEN** 用户刷新页面或 snapshot repair 返回已通过 event stream 显示过的 agent/reasoning/tool/diff 输出
- **THEN** 渲染结果 MUST 保持每个稳定身份只出现一次
- **AND** 已展开或折叠状态 MAY 保留，但重复条目 MUST NOT 出现

### Requirement: 压缩上下文消息只能出现一次
上下文压缩、compact、summary 或类似系统消息 SHALL 使用稳定 identity 在 timeline 中归一化。若同一压缩消息同时来自 live event、snapshot、overlay 或 rollout supplement，系统 MUST 只渲染一次。

#### Scenario: Live compact 后 snapshot 返回同一消息
- **WHEN** timeline 已显示一次上下文压缩消息
- **AND** 后续 snapshot 或 repair 返回同一 turn/generation 的压缩 item
- **THEN** timeline MUST 原位确认或补全该消息
- **AND** MUST NOT 再追加第二条压缩消息

#### Scenario: Rollout supplement 重放压缩 activity
- **WHEN** rollout supplement 在当前窗口内发现与已渲染压缩消息等价的 activity
- **THEN** supplement MUST 合并到同一 normalized entry
- **AND** 渲染层 MUST NOT 把它作为新的独立 system/activity 行显示

### Requirement: Inline activity 分组必须保持服务端 item 顺序
内联 activity 日志 SHALL 按 timeline engine 的 orderKey 渲染。连续 reasoning、tool、command、runtime loading、diff 和 system activity 可以分组展示，但分组内部 MUST 保留服务端 item order、event sequence 或等价 source order，MUST NOT 为了按类型聚合而改变同一 turn 内真实顺序。

#### Scenario: Reasoning 与 tool 交错
- **WHEN** 同一 turn 内服务端顺序为 reasoning、tool、agent delta、tool、agent delta
- **THEN** timeline MUST 以相同相对顺序展示对应可见 activity 和 agent 文本
- **AND** MUST NOT 把全部 tool 或全部 reasoning 移到同一 turn 的固定位置

#### Scenario: 多个文件 diff 与命令活动
- **WHEN** 同一 turn 内先执行命令再产生文件 diff
- **THEN** inline activity 分组 MUST 保留命令在 diff 之前的顺序
- **AND** 多文件 diff MAY 汇总，但不能越过更早的可见活动

### Requirement: 长输出渲染预算必须保持有界
agent 输出渲染层 SHALL 在大会话和高频 delta 下保持有界 DOM 与 Markdown 工作量。timeline engine 重构后，长 Markdown、reasoning、命令输出、tool result、diff 和 raw response fallback MUST 继续按可见窗口、折叠状态、展开状态或空闲时机懒渲染，MUST NOT 因 normalized entries 引入全量挂载。

#### Scenario: 大会话滚动
- **WHEN** 会话包含大量历史 turns 和长工具输出
- **THEN** timeline MUST 只挂载可见窗口和必要 buffer 内的 rows
- **AND** 窗口外长 Markdown、diff 和 tool result MUST NOT 全量渲染到 DOM

#### Scenario: 高频 agent delta
- **WHEN** 当前 agent message 高频追加文本
- **THEN** 渲染层 MUST 只更新当前可见且受影响的输出区域
- **AND** MUST NOT 因每个 delta 重新计算或重新挂载整个历史 timeline

