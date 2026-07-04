## MODIFIED Requirements

### Requirement: 头部固定显示返回、会话名、Plan/Build、模型、菜单
会话头部 SHALL 显示 4 个固定元素：返回按钮、会话名、Plan/Build segmented 控件、`⋮` 次级菜单按钮。模型/思考档位 SHALL 在 composer 底部工具栏中作为发送前状态展示与切换入口。

#### Scenario: 头部内容
- **WHEN** 会话聊天页渲染
- **THEN** 头部 MUST 同时显示返回、会话名、Plan/Build、`⋮`
- **AND** 头部 MUST 不显示模型选择按钮
- **AND** composer 底部工具栏 MUST 显示模型/思考档位 chip

#### Scenario: 头部 sticky
- **WHEN** 用户向下滚动 timeline
- **THEN** 头部 MUST 保持 sticky 不随滚动消失

### Requirement: Plan/Build 使用 segmented 控件且每会话独立
Plan/Build 模式 SHALL 用 segmented 控件呈现，每个会话独立保存当前选择。Plan/Build SHALL 表示协作模式，不承担权限模式切换职责。

#### Scenario: 新会话默认值
- **WHEN** 新建会话
- **THEN** Plan/Build segmented 控件 MUST 默认选中设置页中的全局默认模式

#### Scenario: 切换模式
- **WHEN** 用户在会话头部切换 Plan/Build
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/settings` 更新 collaboration mode
- **AND** 切换 MUST 只影响下一条用户消息，不影响当前正在执行的 turn
- **AND** 系统 MUST NOT 通过 Plan/Build 切换更新 named permission profile

#### Scenario: 进入已有会话
- **WHEN** 用户重新进入某个会话
- **THEN** 头部 MUST 恢复该会话上次的 Plan/Build 选中态
