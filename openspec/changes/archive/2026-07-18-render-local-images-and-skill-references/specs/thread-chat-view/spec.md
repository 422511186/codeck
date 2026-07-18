## MODIFIED Requirements

### Requirement: 用户消息展示结构化 Skill 引用
会话 timeline 中的每个用户 item SHALL 只呈现为一个用户消息气泡。Skill 引用 SHALL 作为该气泡内的结构化上下文展示，不得被渲染为独立视觉消息，也不得写入正文文本。Skill 引用 SHALL 使用只读、非交互的语义行显示可读 Skill 名称和语义图标，并保持移动端可读、不撑宽布局、不暴露绝对路径。

#### Scenario: Skill 与正文属于同一消息气泡
- **WHEN** timeline 渲染一条包含 Skill 引用的用户消息
- **THEN** Skill 名称、语义图标、图片和正文 MUST 位于同一个用户消息气泡内
- **AND** timeline MUST 不为 Skill 创建独立视觉消息行或第二个消息气泡
- **AND** 所有 Skill MUST 位于气泡内容的最上方，图片与正文 MUST 显示在其后
- **AND** Skill 名称 MUST 使用可读展示形式
- **AND** 正文文本 MUST 不包含 `[skill]` 或兼容引用原文
- **AND** Skill 上下文 MUST 不提供打开本机 `SKILL.md` 的链接或含绝对路径的提示

#### Scenario: 仅包含 Skill 引用
- **WHEN** 用户消息包含 Skill 引用但清理后正文为空
- **THEN** timeline MUST 渲染一个包含 Skill 上下文的正常用户消息气泡
- **AND** MUST 不渲染空正文区域或第二个气泡

#### Scenario: 乐观消息与服务端消息一致
- **WHEN** 用户发送一条带 Skill 引用的消息
- **THEN** 本地乐观消息 MUST 立即显示 Skill 引用
- **AND** 服务端回读或 snapshot repair 后 MUST 保持同样的 Skill 引用展示

#### Scenario: 多个或过长的 Skill 名称
- **WHEN** 一条消息包含多个 Skill 引用或 Skill 名称超过手机屏幕可展示宽度
- **THEN** Skill 上下文 MUST 只在完整胶囊之间自动换行
- **AND** 单个 Skill 名称 MUST 保持一行并在过长时省略
- **AND** 气泡 MUST 不产生横向滚动
- **AND** 用户消息正文 MUST 仍保持可读

#### Scenario: 消息操作保持正文语义
- **WHEN** 用户对包含 Skill 引用的消息执行复制、重试或消息菜单操作
- **THEN** 操作 MUST 作用于同一个用户消息气泡
- **AND** 复制 MUST 只复制用户正文，不得复制 Skill 路径或兼容引用原文
