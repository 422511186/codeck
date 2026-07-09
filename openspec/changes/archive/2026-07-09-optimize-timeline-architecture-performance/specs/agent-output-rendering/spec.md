## ADDED Requirements

### Requirement: Output derivations are cached by stable entry identity
agent 输出渲染层 SHALL 对长 Markdown、diff rows、command output preview、tool result preview、reasoning preview 和 inline activity detail preview 使用稳定 entry identity 的派生缓存或等价机制。系统 MUST 不在每个 unrelated timeline update 或每个 delta commit 中重新 split、parse 或格式化未变化的大文本。

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

### Requirement: Heavy rendering follows the recycled viewport
agent 输出中的 Markdown、代码高亮、Mermaid、diff rows、长 command output、tool result、reasoning detail 和 inline activity detail SHALL 只在当前 recycled viewport 或用户展开的有界区域内执行重渲染。窗口外 rows MUST 不构造 Markdown AST、highlight DOM、diff row DOM 或长 `<pre>` 预览。

#### Scenario: Recycled row releases heavy output DOM
- **WHEN** 用户滚动导致某条历史 agent message 离开 viewport buffer
- **THEN** 该 row 的 Markdown、代码高亮、diff 或长文本 DOM MUST 被卸载或替换为轻量 spacer
- **AND** DOM 中 MUST 不继续保留该 row 的完整历史输出

#### Scenario: Re-entering row restores output lazily
- **WHEN** 用户滚回之前被回收的历史 row
- **THEN** 系统 MUST 先恢复可读的轻量文本或摘要
- **AND** Markdown、diff rows 或长文本详情 MUST 在可见且调度条件满足后恢复

#### Scenario: Expanded activity remains bounded
- **WHEN** 用户展开包含长参数、stdout、stderr、result、raw response 或 fallback 文本的 inline activity
- **THEN** 展开区域 MUST 只渲染有界预览、分段内容或内部滚动片段
- **AND** 其他 viewport rows MUST 不因此重建完整长输出 DOM

### Requirement: Live output stays lightweight until stable
流式 agent、reasoning、tool 或 command 输出 SHALL 在 live 阶段使用轻量文本渲染和批处理后的最小更新。系统 MUST 不对每个 live delta 同步执行完整 Markdown 解析、代码高亮、diff parsing、activity summary 全量重建或长文本 preview 全量重算。

#### Scenario: Agent live delta renders as plain text
- **WHEN** active turn 的 agent message 高频追加 delta
- **THEN** live 区域 MUST 以纯文本或等价轻量结构显示最新内容
- **AND** 完整 Markdown MUST 等输出稳定、row 可见且浏览器调度条件满足后再执行

#### Scenario: Tool live delta avoids full preview rebuild
- **WHEN** running tool output 高频追加 stdout/stderr delta
- **THEN** UI MUST 只更新受影响 tool entry 的轻量尾部显示或有界 preview
- **AND** MUST 不因每段 delta 重新计算整个 timeline 的 activity sections
