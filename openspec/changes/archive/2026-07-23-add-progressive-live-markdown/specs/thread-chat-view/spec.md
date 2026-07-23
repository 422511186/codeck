## MODIFIED Requirements

## MODIFIED Requirements

### Requirement: Agent 回复全量渲染 markdown
Agent 回复 SHALL 最终按 GitHub-flavored markdown 全量渲染，包含列表、加粗、表格、链接、内联代码块。为了保证移动端首屏性能，系统 MAY 在消息离屏、尚未进入渲染窗口、浏览器尚未空闲时先展示轻量纯文本占位；当消息进入可见窗口且调度条件满足后，系统 MUST 完成 Markdown 渲染。对于仍在流式输出的 live agent 消息，系统 SHALL 对已稳定完成的 markdown 块尽早渲染，未完成尾巴 MAY 继续轻量纯文本展示。

#### Scenario: 渲染 markdown 元素
- **WHEN** agent 消息包含 markdown 语法
- **AND** 该消息进入 timeline 可见渲染窗口且 Markdown 渲染已调度完成
- **THEN** 列表、表格、加粗、链接 MUST 渲染为对应可视元素

#### Scenario: 不渲染 LaTeX
- **WHEN** agent 消息包含 `$...$` 或 `\[...\]` 等 LaTeX 公式语法
- **THEN** 系统 MUST 不解析公式
- **AND** MUST 保留原文展示

#### Scenario: 渲染 Mermaid
- **WHEN** agent 消息包含 ```mermaid 代码块
- **AND** 用户展开或查看到该 Mermaid 所在消息
- **THEN** 系统 MUST 渲染为 Mermaid 图

#### Scenario: 离屏历史消息延迟 Markdown
- **WHEN** 会话首屏包含大量历史 agent 消息
- **AND** 某条 agent 消息不在当前渲染窗口内
- **THEN** 系统 MAY 暂时不执行 Markdown 解析、代码高亮或 Mermaid 渲染
- **AND** 该消息进入窗口后 MUST 仍能完成完整 Markdown 渲染

#### Scenario: Live message renders completed blocks progressively
- **WHEN** live agent 消息正在流式输出
- **AND** 文本中已出现完整段落或已闭合 fenced code block
- **THEN** 这些已完成块 MUST 可按 Markdown 渲染
- **AND** 尚未完成的尾巴 MAY 继续以轻量纯文本展示
