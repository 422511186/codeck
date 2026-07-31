## ADDED Requirements

### Requirement: Agent Markdown tables use a mobile-readable GitHub style

Agent 消息中的 GFM Markdown 表格 SHALL 使用轻量 GitHub 风格展示：表格、表头和单元格 MUST 具备清晰的细边框，表头 MUST 有独立的主题背景，单元格 MUST 有足够的内边距并按顶部对齐。表格 MUST 继续保留语义化的 `table`、`thead`、`th` 和 `td` 结构。

#### Scenario: Markdown table has visible hierarchy

- **WHEN** agent 消息包含合法的 GFM Markdown 表格
- **THEN** timeline MUST 渲染语义化表格结构
- **AND** 表头与数据单元格 MUST 通过主题边框、表头背景和单元格间距形成可读层次

#### Scenario: Wide table scrolls inside its own container

- **WHEN** Markdown 表格的内容宽度超过移动端 timeline 可用宽度
- **THEN** 表格 MUST 保持内容驱动的列宽
- **AND** 表格外层容器 MUST 提供横向滚动
- **AND** timeline 主滚动容器 MUST NOT 因该表格产生横向溢出

#### Scenario: Table styling follows the active theme

- **WHEN** 用户在明亮或暗黑主题下查看 Markdown 表格
- **THEN** 表格边框、表头背景和文字 MUST 使用当前主题 token
- **AND** 表格 MUST NOT 固定使用与当前主题不匹配的浅色或暗色背景
