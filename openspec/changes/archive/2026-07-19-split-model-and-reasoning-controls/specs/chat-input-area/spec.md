## MODIFIED Requirements

### Requirement: Model reasoning chip display

移动端空闲态 composer MUST 使用两个独立 chip 展示当前模型和推理强度。模型 chip 只显示模型标识并打开模型选择器；推理强度 chip 只显示当前档位并打开独立选择器。两个 chip MUST 使用紧凑英文展示，常见推理强度 MUST 展示为 `Low`、`Medium`、`High`。协议传参 MUST 继续使用 app-server 返回的原始 reasoning effort 值。

#### Scenario: Render independent model and reasoning chips
- **WHEN** 当前模型为 `gpt-5-codex`
- **AND** 当前 reasoning effort 为 `medium`
- **THEN** composer MUST 分别显示模型 chip `gpt-5-codex` 和推理强度 chip `Medium`
- **AND** 两个 chip MUST 都不包含中文逗号或英文逗号

#### Scenario: Model chip opens only model picker
- **WHEN** 用户点击模型 chip
- **THEN** 系统 MUST 打开模型选择器
- **AND** 模型选择器 MUST NOT 显示推理强度选项

#### Scenario: Reasoning chip opens only effort picker
- **WHEN** 用户点击推理强度 chip
- **THEN** 系统 MUST 打开独立推理强度选择器
- **AND** 选择器 MUST 只显示当前模型支持的 effort 选项

#### Scenario: Render known reasoning effort labels
- **WHEN** 选择器显示 reasoning effort 选项 `low`、`medium`、`high`
- **THEN** 选项 MUST 分别显示为 `Low`、`Medium`、`High`
- **AND** 选项 MUST NOT 显示为「低」「中」「高」

#### Scenario: Preserve reasoning effort protocol value
- **WHEN** 用户选择显示为 `High` 的 reasoning effort
- **THEN** 后续 settings update 或 turn start 请求 MUST 继续发送原始值 `high`
- **AND** 请求中 MUST NOT 发送展示文案 `High`

#### Scenario: Unknown reasoning effort fallback
- **WHEN** app-server 返回未知 reasoning effort 字符串
- **THEN** UI MUST 使用可读英文形式展示该字符串
- **AND** 后续请求 MUST 保留原始字符串值

#### Scenario: Model without effort hides reasoning chip
- **WHEN** 当前模型没有 supported reasoning efforts 且当前 effort 为空
- **THEN** composer MUST 隐藏推理强度 chip
