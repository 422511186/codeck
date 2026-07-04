## MODIFIED Requirements

### Requirement: 会话头部布局
会话页顶部 SHALL 固定显示：返回按钮、会话名（两行省略号截断）、Plan/Build segmented 控件、`⋮` 次级菜单按钮；滚动时头部 MUST 保持 sticky 不消失。模型/思考档位选择 SHALL 移到 composer 底部工具栏展示，不再作为会话头部固定元素。

#### Scenario: 渲染头部
- **WHEN** 用户进入某会话
- **THEN** 头部 MUST 同时显示返回、会话名、Plan/Build、`⋮`
- **AND** 会话名 MUST 至多两行省略号截断
- **AND** 头部 MUST 不显示模型选择按钮

#### Scenario: 滚动行为
- **WHEN** 用户向下滚动 timeline
- **THEN** 头部 MUST 保持 sticky 不隐藏

### Requirement: 模型切换粒度
模型 SHALL 有全局默认值（设置页可改）；每个会话可在 composer 底部工具栏点击模型/思考档位 chip 独立切换；切换器列表 SHALL 每次打开时调用 `GET /api/codex/models` 拉取。

#### Scenario: 全局默认
- **WHEN** 用户在设置页设置全局默认模型
- **THEN** 之后新建的会话 MUST 默认使用该模型

#### Scenario: 会话内切换
- **WHEN** 用户在 composer 底部工具栏点击模型/思考档位 chip
- **THEN** 系统 MUST 调用 `GET /api/codex/models` 拉取最新列表
- **AND** 用户选定模型后 MUST 调用 `POST /api/codex/threads/:threadId/settings` 持久化
- **AND** composer 底部工具栏 MUST 更新显示当前模型和思考档位

#### Scenario: Header does not duplicate model picker
- **WHEN** 会话页渲染空闲态 composer
- **THEN** 模型/思考档位 chip MUST 在 composer 底部工具栏可见
- **AND** 会话头部 MUST 不重复显示模型选择按钮
