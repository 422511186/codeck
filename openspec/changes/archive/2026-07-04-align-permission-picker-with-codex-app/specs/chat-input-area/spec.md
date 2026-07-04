## ADDED Requirements

### Requirement: Model reasoning chip display
移动端空闲态 composer 的模型/思考档位 chip SHALL 使用紧凑英文展示。模型名与推理强度之间 MUST 不使用中文逗号或英文逗号；常见推理强度 MUST 展示为官方英文表达 `Low`、`Medium`、`High`。协议传参 MUST 继续使用 app-server 返回的原始 reasoning effort 值。

#### Scenario: Render model with reasoning effort
- **WHEN** 当前模型为 `gpt-5-codex`
- **AND** 当前 reasoning effort 为 `medium`
- **THEN** composer 模型 chip MUST 显示 `gpt-5-codex Medium`
- **AND** chip 文案 MUST NOT 包含 `，`
- **AND** chip 文案 MUST NOT 包含 `,`

#### Scenario: Render known reasoning effort labels
- **WHEN** 模型选择面板显示 reasoning effort 选项 `low`、`medium`、`high`
- **THEN** 选项 MUST 分别显示为 `Low`、`Medium`、`High`
- **AND** 选项 MUST NOT 显示为「低」「中」「高」

#### Scenario: Preserve reasoning effort protocol value
- **WHEN** 用户选择显示为 `High` 的 reasoning effort
- **THEN** 后续 settings update 或 turn start 请求 MUST 继续发送 `reasoningEffort: "high"` 或 app-server 对应字段值 `effort: "high"`
- **AND** 请求中 MUST NOT 发送展示文案 `High`

#### Scenario: Unknown reasoning effort fallback
- **WHEN** app-server 返回未知 reasoning effort 字符串
- **THEN** UI MUST 使用可读英文形式展示该字符串
- **AND** 后续请求 MUST 保留原始字符串值
