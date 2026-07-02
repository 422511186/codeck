## ADDED Requirements

### Requirement: Chat Skill 引用在 timeline 中保持可回放
通过聊天输入区选择的 Skill 引用 SHALL 作为结构化输入发送，并在后续 timeline 展示、历史分页、刷新修复中保持可识别。系统 SHALL 使用 Skill `name` 作为主要展示文案，使用 `path` 作为稳定标识和发送协议字段。

#### Scenario: 发送结构化 Skill 引用
- **WHEN** 用户通过聊天输入区选择 Skill 后发送消息
- **THEN** start turn 请求 MUST 包含对应 Skill 的 `name` 和 `path`
- **AND** 用户消息 timeline item MUST 保留该 Skill 引用

#### Scenario: 历史消息恢复 Skill 引用
- **WHEN** 页面从服务端历史或 snapshot 中读取包含 `type: "skill"` 的用户消息内容
- **THEN** 系统 MUST 将其转换为结构化 Skill 引用
- **AND** MUST 不把该内容转换成 `[skill]` 文本

#### Scenario: 多个 Skill 引用
- **WHEN** 一条用户消息包含多个 Skill 引用
- **THEN** timeline MUST 展示每个 Skill 的名称
- **AND** 每个 Skill MUST 使用其 `name/path` 组合保持稳定去重和渲染 key
