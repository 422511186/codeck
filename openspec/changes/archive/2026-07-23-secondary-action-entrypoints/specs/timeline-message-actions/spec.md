## MODIFIED Requirements

### Requirement: 用户消息轻点操作菜单
timeline SHALL 在用户自己的 user message 上提供轻点操作入口，作为复制、回滚到这里和从这里 Fork 的入口。MUST NOT 以长按作为唯一或主入口。

#### Scenario: 打开用户消息菜单
- **WHEN** thread 静止且用户轻点一条 user message 气泡
- **THEN** 系统 MUST 显示消息级操作菜单或工具条
- **AND** 菜单 MUST 包含「复制」「回滚到这里」「从这里 Fork」「取消」

#### Scenario: 非用户消息无菜单
- **WHEN** 用户点击或长按 agent message、reasoning、tool、diff、system 或 error 条目
- **THEN** 系统 MUST NOT 显示回滚或 Fork 操作

#### Scenario: 运行中禁用历史操作
- **WHEN** thread 处于运行态
- **AND** 用户轻点 user message
- **THEN** 系统 MUST NOT 允许触发「回滚到这里」或「从这里 Fork」
- **AND** 系统 MAY 继续提供「复制」操作

#### Scenario: 长按不再作为消息操作入口
- **WHEN** 用户长按 user message
- **THEN** 系统 MUST NOT 仅因长按打开消息级操作菜单
- **AND** 用户仍 MUST 能通过轻点打开操作菜单

### Requirement: 复制用户消息
用户消息菜单中的「复制」SHALL 将该 user message 的文本复制到系统剪贴板，不改变会话历史或输入框草稿。

#### Scenario: 复制文本
- **WHEN** 用户在消息级菜单点击「复制」
- **THEN** 系统 MUST 将该 user message 的文本写入剪贴板
- **AND** MUST 关闭消息级菜单
- **AND** MUST NOT 调用 rollback、fork 或 turn/start 接口
