## ADDED Requirements

### Requirement: 昂贵输出渲染按可见性和展开状态延迟
Agent 输出中需要大量主线程工作的内容 SHALL 按可见性和用户展开状态延迟渲染。昂贵内容包括 Markdown 代码高亮、Mermaid、长 diff 行、长命令输出、长工具结果和长 reasoning 文本。

#### Scenario: 离屏代码块不立即高亮
- **WHEN** 历史 agent 消息包含 fenced code block
- **AND** 该消息不在 timeline 可见窗口内
- **THEN** 系统 MUST NOT 同步执行代码高亮
- **AND** 该消息进入可见窗口后 MUST 能渲染主题一致的代码块

#### Scenario: Mermaid 按需渲染
- **WHEN** agent 消息包含 Mermaid 代码块
- **AND** 用户尚未滚动到该消息或该消息尚未进入渲染窗口
- **THEN** 系统 MUST NOT 立即加载 Mermaid 并生成 SVG
- **AND** 该块进入可见窗口后 MUST 渲染为 Mermaid 图或显示可读错误

#### Scenario: 折叠卡片不构造完整长内容 DOM
- **WHEN** 命令、工具、reasoning 或 diff 卡片处于折叠状态
- **THEN** 系统 MUST 只渲染标题、摘要和必要状态
- **AND** MUST NOT 为折叠内容同步构造完整长文本或 diff rows DOM

### Requirement: 长输出默认有界展示
命令输出、工具结果、reasoning 文本、diff 和超长 agent 消息 SHALL 在默认展示状态下限制 DOM 文本量或行数。系统 MUST 保留查看完整内容的路径，但默认状态 MUST 避免把完整大文本直接挂载到主 timeline。

#### Scenario: 命令输出超过展示上限
- **WHEN** 命令输出超过默认展示上限
- **THEN** 折叠态 MUST 只显示命令摘要和状态
- **AND** 展开态 MUST 在内部滚动区域展示有限预览
- **AND** 用户 MUST 能通过明确操作查看或复制完整输出

#### Scenario: 工具结果超过展示上限
- **WHEN** MCP、dynamic、web 或 file 工具结果文本很长
- **THEN** 默认卡片 MUST 显示工具身份和摘要
- **AND** MUST NOT 将完整结果直接推入首屏 DOM

#### Scenario: Diff 超过展示上限
- **WHEN** diff 行数超过默认展示上限
- **THEN** 折叠态 MUST 只显示文件路径和增删统计
- **AND** 展开态 MUST 使用内部滚动或分段渲染显示 diff 预览
- **AND** 用户 MUST 能访问完整 diff 文本

### Requirement: Agent Markdown 分阶段完成
Agent Markdown SHALL 分阶段渲染：流式输出和离屏历史先以纯文本或轻量结构展示，进入可见窗口后再解析 Markdown，代码高亮和 Mermaid 在 Markdown 基础上继续延迟到对应 block 可见或用户展开。

#### Scenario: Streaming agent text
- **WHEN** agent message 正在持续收到 `agent_message_delta`
- **THEN** 当前 live 消息 MUST 使用轻量文本渲染路径
- **AND** MUST NOT 对每个 delta 重新执行完整 Markdown 解析或代码高亮

#### Scenario: Idle visible message
- **WHEN** agent message 已完成且进入可见窗口
- **THEN** 系统 MUST 在空闲时调度 Markdown 渲染
- **AND** 渲染完成后 MUST 保持复制代码、表格、列表和链接等既有能力

### Requirement: 完整内容访问不依赖首屏 DOM
长输出的完整内容 SHALL 可通过用户明确操作访问，例如展开更多、复制完整内容、打开详情视图或按需加载完整文本。系统 MUST NOT 把“默认截断”解释为数据丢失。

#### Scenario: 用户请求完整命令输出
- **WHEN** 用户在命令卡片上选择查看完整输出
- **THEN** 系统 MUST 展示或提供完整命令输出
- **AND** 若完整输出需要额外读取，加载失败时 MUST 显示内嵌错误状态

#### Scenario: 用户复制完整 agent 代码块
- **WHEN** 用户点击已渲染代码块的复制按钮
- **THEN** 系统 MUST 复制该代码块完整原文
- **AND** MUST NOT 只复制默认预览截断内容

#### Scenario: 用户查看完整 diff
- **WHEN** diff 默认预览被截断
- **AND** 用户请求查看完整 diff
- **THEN** 系统 MUST 提供完整 diff 的可读路径
- **AND** MUST 保持移动端页面主 timeline 不被完整 diff DOM 卡死
