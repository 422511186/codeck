## MODIFIED Requirements

## MODIFIED Requirements

### Requirement: Agent Markdown 分阶段完成
Agent Markdown SHALL 分阶段渲染：离屏历史先以纯文本或轻量结构展示，进入可见窗口后再解析 Markdown；代码高亮和 Mermaid 在 Markdown 基础上可继续延迟到对应 block 可见或用户展开。流式 live agent 消息 SHALL 渐进渲染已稳定完成的块，未完成尾巴保持轻量文本；系统 MUST NOT 对每个 delta 重新执行完整 Markdown 解析或代码高亮。

#### Scenario: Streaming agent text
- **WHEN** agent message 正在持续收到 `agent_message_delta`
- **THEN** 当前 live 消息的未完成尾巴 MUST 使用轻量文本渲染路径
- **AND** 已稳定完成的段落或闭合代码块 MAY 使用 Markdown 渲染
- **AND** MUST NOT 对每个 delta 重新执行完整 Markdown 解析或代码高亮

#### Scenario: Idle visible message
- **WHEN** agent message 已完成且进入可见窗口
- **THEN** 系统 MUST 在空闲时调度 Markdown 渲染
- **AND** 渲染完成后 MUST 保持复制代码、表格、列表和链接等既有能力

#### Scenario: Incomplete fenced code stays plain while streaming
- **WHEN** live agent 消息包含尚未闭合的 fenced code block
- **THEN** 该未闭合代码块 MUST 保留在轻量文本尾巴中
- **AND** MUST NOT 提前渲染为可复制代码块控件
