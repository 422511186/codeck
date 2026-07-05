## MODIFIED Requirements

### Requirement: 移动端活动以内联日志穿插展示
移动端 timeline SHALL 将 agent 运行中的工具、读取、搜索、命令、Skill/工具加载、文件变更和公开 reasoning 等活动渲染为 Codex App 风格的内联活动日志。内联活动日志 SHALL 作为消息流的一部分穿插在 assistant 消息之间，MUST NOT 显示统一的 `Activity` 标题、厚卡片边框、强调色左边框或独立卡片容器。snapshot、pagination、overlay 或 JSONL repair 补齐活动但缺少可靠文本锚点时，系统 MUST 使用同 turn 的安全语义插入点，至少将活动放在 user message 之后、最终 assistant 回复之前，且该顺序 MUST 在 store normalize、刷新、历史分页和 overlay 合并后保持稳定。系统 MUST NOT 因找不到锚点就统一追加到 turn 末尾。

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
- **AND** 该顺序 MUST 在 store 根据 `createdAt` 归一化后保持不变

#### Scenario: Snapshot load keeps repaired order stable
- **WHEN** 首屏读取、startTurn 返回 thread、rewind 或 fork 得到的 snapshot 中同一 turn 为 user message、最终 assistant message、补齐 activity
- **THEN** timeline MUST 将补齐 activity 渲染在 user message 之后、最终 assistant message 之前
- **AND** 后续 store replace 或 merge MUST NOT 把 activity 再排回最终 assistant message 之后

#### Scenario: Paginated history preserves activity before final assistant
- **WHEN** 历史分页返回同一 turn 的 user message、activity、最终 assistant message
- **THEN** prepend 到 timeline 后 MUST 保持 user message、activity、最终 assistant message 的顺序
- **AND** fallback timestamp MUST NOT 导致 activity 被排序到最终 assistant message 之后

#### Scenario: Overlay fallback inserts activity inside owning turn
- **WHEN** app-server overlay 提供一个有 `turnId` 的 activity
- **AND** 当前 snapshot 中同一 turn 已有 user message 和最终 assistant message
- **AND** overlay item 无法匹配到已有 snapshot item
- **THEN** overlay activity MUST 插入到该 turn 的 user message 之后、最终 assistant message 之前
- **AND** 系统 MUST NOT 把该 overlay activity 追加到整个 timeline 末尾

#### Scenario: 只合并连续活动
- **WHEN** 多个 activity entries 在同一 turn 中连续出现
- **THEN** timeline MAY 将这些连续 entry 派生为同一个内联活动日志组
- **AND** 合并 MUST 在遇到 assistant、user、system 或 error entry 时停止
