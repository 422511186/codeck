## MODIFIED Requirements

### Requirement: 移动端活动以内联日志穿插展示
移动端 timeline SHALL 将 agent 运行中的工具、读取、搜索、命令、Skill/工具加载、文件变更和公开 reasoning 等活动渲染为 Codex App 风格的内联活动日志。内联活动日志 SHALL 作为消息流的一部分穿插在 assistant 消息之间，MUST NOT 显示统一的 `Activity` 标题、厚卡片边框、强调色左边框或独立卡片容器。snapshot/JSONL repair 补齐活动但缺少可靠文本锚点时，系统 MUST 使用同 turn 的安全语义插入点，至少将活动放在 user message 之后、最终 assistant 回复之前，MUST NOT 因找不到锚点就统一追加到 turn 末尾。

#### Scenario: 活动不显示 Activity 卡片
- **WHEN** 一个 turn 产生 tool、command、diff、reasoning 或 runtime loading 活动
- **THEN** timeline MUST 渲染具体活动标题和明细行
- **AND** timeline MUST NOT 显示 `Activity` 作为用户可见标题
- **AND** 活动 MUST NOT 使用厚卡片、蓝色左侧强调条或独立卡片容器

#### Scenario: 活动按真实顺序穿插
- **WHEN** 同一 turn 内真实顺序为 assistant 消息、工具活动、assistant 消息、文件变更、assistant 消息
- **THEN** timeline MUST 按该原始顺序渲染为 assistant 消息、内联活动日志、assistant 消息、内联活动日志、assistant 消息
- **AND** 系统 MUST NOT 将该 turn 的所有活动集中堆到用户消息下方或所有 assistant 文本之前

#### Scenario: Repair fallback keeps activity before final assistant
- **WHEN** snapshot/JSONL repair 为同一 turn 补齐 tool、command、read、search、runtime loading 或 Thinking 活动
- **AND** repair 过程无法找到匹配的 assistant 文本锚点
- **AND** 该 turn 已有 user message 和最终 assistant message
- **THEN** 补齐活动 MUST 渲染在该 turn 的 user message 之后、最终 assistant message 之前
- **AND** 系统 MUST NOT 仅因为缺少锚点就把这些活动追加到最终 assistant message 之后

#### Scenario: 只合并连续活动
- **WHEN** 多个 activity entries 在同一 turn 中连续出现
- **THEN** timeline MAY 将这些连续 entry 派生为同一个内联活动日志组
- **AND** 合并 MUST 在遇到 assistant、user、system 或 error entry 时停止
