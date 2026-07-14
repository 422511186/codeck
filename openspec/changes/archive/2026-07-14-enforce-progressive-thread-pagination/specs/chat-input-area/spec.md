## MODIFIED Requirements

### Requirement: 底部输入区固定单行 + 半屏编辑器
会话页底部在 thread 静止时 SHALL 显示空闲态 composer。composer SHALL 使用移动端两层结构：上层为自动增高文本输入区，下层为固定工具栏。composer MUST 不再提供半屏编辑入口；文本输入区达到最大高度后 MUST 内部滚动，并保持底部工具栏可见。composer MUST 作为页面 flex 布局中的普通子元素参与尺寸计算，高度变化时 timeline 视口 MUST 同步缩小，不得覆盖消息内容。

#### Scenario: 默认输入
- **WHEN** thread 静止且用户在会话页打字
- **THEN** 底部 composer MUST 显示自动增高文本输入区、`+` 添加入口、权限模式 chip、模型/思考档位 chip 和发送按钮
- **AND** 文本输入区 MUST 随内容增高
- **AND** 文本输入区达到最大高度后 MUST 内部滚动
- **AND** 底部工具栏 MUST 保持可见

#### Scenario: No half-screen editor
- **WHEN** thread 静止且底部 composer 渲染
- **THEN** composer MUST 不显示半屏编辑入口
- **AND** 用户 MUST 在普通文本输入区完成多行编辑

#### Scenario: Selected context placement
- **WHEN** 用户已选择图片或 Skill 且尚未发送
- **THEN** 已选图片缩略图和 Skill chip MUST 显示在 composer 内部
- **AND** 它们 MUST 位于文本输入区下方、底部工具栏上方

#### Scenario: Composer height resizes timeline
- **WHEN** 用户输入多行文本或添加上下文导致 composer 高度变高
- **THEN** timeline 滚动视口 MUST 按 composer 实际增量同步缩小
- **AND** 最新消息 MUST NOT 被 composer 遮挡
- **AND** 如果用户原本停留在 timeline 底部附近，系统 MUST 在高度变化后保持最新消息可见
- **AND** 如果用户正在查看历史，系统 MUST 保持当前可见内容锚点
