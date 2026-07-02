## ADDED Requirements

### Requirement: 用户消息展示结构化 Skill 引用
会话 timeline 中的用户消息 SHALL 将 Skill 引用作为结构化附件展示，不得把 Skill 引用渲染进正文文本。Skill 引用 SHALL 使用只读 chip 或等价轻量样式显示 Skill 名称，并保持移动端可读、不撑宽布局。

#### Scenario: 展示 Skill 引用 chip
- **WHEN** timeline 渲染一条包含 Skill 引用的用户消息
- **THEN** 用户消息 MUST 显示对应 Skill 名称
- **AND** Skill 名称 MUST 与正文文本分离展示
- **AND** 正文文本 MUST 不包含 `[skill]`

#### Scenario: 乐观消息与服务端消息一致
- **WHEN** 用户发送一条带 Skill 引用的消息
- **THEN** 本地乐观消息 MUST 立即显示 Skill 引用
- **AND** 服务端回读或 snapshot repair 后 MUST 保持同样的 Skill 引用展示

#### Scenario: Skill 名称过长
- **WHEN** Skill 名称超过手机屏幕可展示宽度
- **THEN** Skill chip MUST 截断或换行而不撑出横向滚动
- **AND** 用户消息正文 MUST 仍保持可读
