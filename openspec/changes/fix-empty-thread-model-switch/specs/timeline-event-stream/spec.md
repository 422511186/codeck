## ADDED Requirements

### Requirement: Operation warnings and errors use distinct timeline severity
移动端 timeline SHALL 区分不阻塞会话历史与后续发送的操作 warning 和真正失败 error。warning MUST 使用紧凑黄色内联提示；error MUST 使用紧凑红色内联提示，标题为“操作失败”。两者 MUST NOT 使用“出错了”折叠卡片或嵌套代码错误框。

#### Scenario: Recovered model switch renders as warning
- **WHEN** 目标模型切换失败但旧运行时已恢复
- **THEN** timeline MUST 追加 warning system entry
- **AND** 提示 MUST 说明目标未生效且旧状态已恢复
- **AND** 页面 MUST NOT 将该提示渲染为 error card

#### Scenario: Permission update rollback renders as warning
- **WHEN** 权限 settings update 失败且前端已回退到后端确认或先前选择
- **THEN** timeline MUST 追加紧凑 warning
- **AND** warning MUST NOT 使用“出错了”标题或折叠交互

#### Scenario: True operation failure renders as compact alert
- **WHEN** 模型或运行时操作产生未恢复的真正错误
- **THEN** timeline MUST 渲染 `role="alert"` 的紧凑红色提示并显示“操作失败”
- **AND** 提示 MUST NOT 包含可折叠 `BaseCard` 或嵌套红色 `<pre>`

### Requirement: Recovery-failed blocking UI remains authoritative
`recovery_failed` SHALL 继续阻止发送并由专用恢复界面提供“恢复原模型”和“重试目标模型”操作。timeline error MUST 只提供简短失败摘要，不得替代、隐藏或解除阻塞恢复流程。

#### Scenario: Recovery failure shows alert and recovery controls
- **WHEN** 目标状态与旧状态都无法可靠恢复
- **THEN** timeline MUST 显示紧凑“操作失败”摘要
- **AND** 页面 MUST 保持发送禁用并显示现有显式恢复操作
