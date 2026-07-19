# thread-operation-notices Specification

## Purpose
TBD - created by archiving change fix-thread-warning-and-permission-state. Update Purpose after archive.
## Requirements
### Requirement: Session warnings are stored as notices

会话状态 MUST 提供独立于 timeline 的 operation notice 集合，并为每条 notice 提供稳定身份、文本、来源和关闭能力。

#### Scenario: First warning creates a notice
- **WHEN** 前端收到一个带有 thread id 的 app-server warning 事件
- **THEN** 对应会话创建一条 warning notice，且不新增 timeline entry

#### Scenario: Duplicate warning is deduplicated
- **WHEN** 同一会话再次收到相同来源和消息的 warning
- **THEN** 系统更新已有 notice 而不是创建第二条相同 notice

#### Scenario: User dismisses a notice
- **WHEN** 用户点击 notice 的关闭按钮
- **THEN** 该 notice 从当前会话的 notice 集合移除，timeline 内容不变

#### Scenario: Dismissed notice stays hidden after refresh
- **WHEN** 用户关闭 notice 后刷新同一会话，且服务端再次发送相同 warning
- **THEN** 系统根据稳定 id 过滤该 notice，不再次显示已关闭提示

### Requirement: Notices use non-error presentation

会话页 MUST 在标题/计划区域下方展示 warning notice，使用紧凑的中性或黄色状态样式和 `role=status`；warning 文案 MUST NOT 使用“操作失败”错误标题。

#### Scenario: Model compatibility warning is visible
- **WHEN** 会话收到模型不一致或模型元数据缺失 warning
- **THEN** 用户在消息列表上方看到可关闭的 warning notice，而不是红色错误卡片
