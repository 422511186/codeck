## ADDED Requirements

### Requirement: Markdown code blocks follow theme colors
Agent 消息中的 Markdown fenced code block SHALL 使用应用主题 token 渲染背景、文字、边框和滚动区域。语法高亮库的默认样式 MUST NOT 把代码块背景固定为与当前主题不匹配的颜色。

#### Scenario: Light theme code block
- **WHEN** 用户在明亮主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用明亮主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定暗色背景覆盖整个代码区域

#### Scenario: Dark theme code block
- **WHEN** 用户在暗黑主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用暗黑主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定浅色背景覆盖整个代码区域

### Requirement: Markdown code copy button remains visible
Markdown 代码块的复制按钮 SHALL 在明亮主题和暗黑主题下都清晰可见、可点击，并使用当前主题 token 表达默认状态和复制成功状态。

#### Scenario: Copy button in light theme
- **WHEN** 用户在明亮主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button in dark theme
- **WHEN** 用户在暗黑主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button success state
- **WHEN** 用户点击代码块复制按钮且复制成功
- **THEN** 按钮 MUST 显示复制成功状态
- **AND** 成功状态 MUST 在当前主题下保持可读
