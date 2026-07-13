## MODIFIED Requirements

### Requirement: Output derivations are cached by stable entry identity
agent 输出渲染层 SHALL 对长 Markdown、diff rows、command output preview、tool result preview、reasoning preview 和 inline activity detail preview 使用稳定 entry identity、entry 引用和内容版本的派生缓存或等价机制。系统 MUST 不在每个 unrelated timeline update 或每个 delta commit 中重新 split、parse 或格式化未变化的大文本；父 timeline 更新时，未变化 row MUST 能跳过重新渲染。

#### Scenario: Unrelated delta does not reparse long diff
- **WHEN** timeline 中存在已展开或可见的长 diff
- **AND** 另一个 agent message 收到 live delta
- **THEN** 长 diff 的 rows 派生 MUST 复用缓存或保持不变
- **AND** MUST 不因 unrelated delta 重新解析完整 diff 文本

#### Scenario: Tool output preview changes only when output changes
- **WHEN** tool result 文本未变化
- **AND** timeline 状态因 running、approval、context usage 或其他 entry 更新而重渲染
- **THEN** tool result preview MUST 不重新处理完整文本
- **AND** 复制完整内容路径 MUST 仍使用原始完整文本

#### Scenario: Markdown cache respects entry revision
- **WHEN** agent message 的 `entry.id`、generation、revision 或文本内容发生变化
- **THEN** Markdown/preview cache MUST 对该 entry 失效并重新派生
- **AND** 其他 entry 的 Markdown 派生 MUST 保持可复用

#### Scenario: Unchanged row skips render
- **WHEN** timeline entries 数组因另一个 entry 的 live delta 产生新引用
- **AND** 某个可见 row 的 entry 引用、live 状态、action 状态和回调语义均未变化
- **THEN** 该 row MUST 跳过 React render 或执行等价的零昂贵派生更新
- **AND** 其 Markdown、diff、preview 和 activity detail MUST 不重新计算

### Requirement: Live output stays lightweight until stable
流式 agent、reasoning、tool 或 command 输出 SHALL 在 live 阶段使用轻量文本渲染和批处理后的最小更新。系统 MUST 不对每个 live delta 同步执行完整 Markdown 解析、代码高亮、diff parsing、activity summary 全量重建或长文本 preview 全量重算；同一 item 的短窗口 delta MUST 只使其所属 row 或 activity block 失效。

#### Scenario: Agent live delta renders as plain text
- **WHEN** active turn 的 agent message 高频追加 delta
- **THEN** live 区域 MUST 以纯文本或等价轻量结构显示最新内容
- **AND** 完整 Markdown MUST 等输出稳定、row 可见且浏览器调度条件满足后再执行

#### Scenario: Tool live delta avoids full preview rebuild
- **WHEN** running tool output 高频追加 stdout/stderr delta
- **THEN** UI MUST 只更新受影响 tool entry 的轻量尾部显示或有界 preview
- **AND** MUST 不因每段 delta 重新计算整个 timeline 的 activity sections

#### Scenario: Batched delta invalidates one render block
- **WHEN** 同一 item 的多个文本 delta 被合并为一次 store 提交
- **THEN** 渲染层 MUST 只失效包含该 item 的 timeline row 或 inline activity block
- **AND** 其他可见 blocks MUST 保持派生缓存和展开状态
