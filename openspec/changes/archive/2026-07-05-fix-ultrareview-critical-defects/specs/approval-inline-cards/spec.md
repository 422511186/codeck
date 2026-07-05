## ADDED Requirements

### Requirement: Dynamic tool request actions use protocol values
`dynamic_tool` 审批卡 SHALL 使用 app-server 归一化后的 `submit` 和 `fail` 操作值。后端 MUST 按该值构造 dynamic tool response，不得把通用 approve/deny 值当作工具输出。

#### Scenario: Dynamic tool submit
- **WHEN** 用户在 `dynamic_tool` 请求上选择 `submit`
- **THEN** 后端 MUST 构造 `{success: true, contentItems: [{type: "inputText", text: value}]}`

#### Scenario: Dynamic tool fail
- **WHEN** 用户在 `dynamic_tool` 请求上选择 `fail`
- **THEN** 后端 MUST 构造 `{success: false, contentItems: [{type: "inputText", text: "用户在移动端标记动态工具调用失败"}]}`

### Requirement: File approval details include diff when present
`file_approval` 卡片 SHALL 显示文件路径；当 request payload 包含 diff、patch 或 file changes 字段时，卡片 MUST 显示可审查的变更内容。

#### Scenario: File approval with diff
- **WHEN** `file_approval` request 包含 `path` 和 `diff`
- **THEN** 卡片 MUST 同时显示路径和 diff
