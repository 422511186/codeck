## MODIFIED Requirements

### Requirement: Composer add panel
移动端空闲态 composer SHALL 提供左下角 `+` 添加入口。点击后 MUST 在 composer 上方打开列表式添加面板，面板用于承载给本次请求添加上下文、引用能力或管理当前会话目标的入口。

#### Scenario: Open add panel
- **WHEN** thread 静止且用户点击 composer 左下角 `+`
- **THEN** 系统 MUST 在 composer 上方打开添加面板
- **AND** 添加面板 MUST 适配手机宽度
- **AND** 添加面板 MUST 保持底部 composer 可见
- **AND** 添加面板高度超过最大值时 MUST 在面板内部滚动

#### Scenario: Add panel list layout
- **WHEN** 添加面板打开
- **THEN** 面板 MUST 显示标题栏「添加内容」和关闭操作「完成」
- **AND** 面板 MUST 使用纵向列表布局，不得使用宫格卡片布局
- **AND** 每个入口 MUST 包含轻量图标容器、主标题和副标题
- **AND** 入口之间 MUST 使用轻量分割线或等价列表分隔样式

#### Scenario: Add panel primary actions
- **WHEN** 添加面板打开
- **THEN** 面板 MUST 显示「图片」「引用 Skill」「设定目标」或「编辑目标」入口
- **AND** 面板 MUST 不显示尚未支持的「文件」和「插件」入口
- **AND** 「图片」和「引用 Skill」入口 MUST 替代 composer 底栏中的独立图片按钮和独立 Skill 按钮

#### Scenario: Skill selection status
- **WHEN** 添加面板打开且本次消息已选择一个或多个 Skill
- **THEN** 「引用 Skill」入口 MUST 显示 `已选 N` 状态，其中 N 为已选 Skill 数量
- **AND** 入口 MUST 继续允许用户打开 Skill 选择器管理多选 Skill

#### Scenario: Goal entry status
- **WHEN** 添加面板打开且当前 thread 没有 goal
- **THEN** 目标入口 MUST 显示为「设定目标」
- **AND** 目标入口 MUST 不显示 `已设置` 状态

#### Scenario: Goal entry with existing goal
- **WHEN** 添加面板打开且当前 thread 已有 goal
- **THEN** 目标入口 MUST 显示为「编辑目标」
- **AND** 目标入口 MUST 显示 `已设置` 状态
- **AND** 目标入口 MUST 不在列表中展示完整 objective 文本

#### Scenario: Close add panel
- **WHEN** 用户点击添加面板标题栏的「完成」
- **THEN** 添加面板 MUST 关闭

#### Scenario: Close add panel by backdrop
- **WHEN** 添加面板打开且用户点击面板外遮罩
- **THEN** 添加面板 MUST 关闭

#### Scenario: Close add panel after action
- **WHEN** 用户在添加面板中选择「图片」「引用 Skill」或目标入口
- **THEN** 添加面板 MUST 关闭
- **AND** 对应的图片选择、Skill 选择或目标编辑流程 MUST 继续执行

## ADDED Requirements

### Requirement: Goal editing from composer add panel
会话页底部 composer SHALL 通过 `+` 添加面板提供当前 thread goal 的设置和编辑入口。目标编辑 MUST 使用已有 thread goal API，不得通过普通消息文本模拟目标。

#### Scenario: Open goal editor without goal
- **WHEN** 当前 thread 没有 goal
- **AND** 用户打开 `+` 添加面板并点击「设定目标」
- **THEN** 系统 MUST 从屏幕底部打开目标编辑面板
- **AND** 目标描述输入框 MUST 为空
- **AND** 目标编辑面板 MUST NOT 显示 token budget 输入框

#### Scenario: Open goal editor with existing goal
- **WHEN** 当前 thread 已有 goal
- **AND** 用户打开 `+` 添加面板并点击「编辑目标」
- **THEN** 系统 MUST 从屏幕底部打开目标编辑面板
- **AND** 目标描述输入框 MUST 使用当前 goal objective 预填
- **AND** 目标编辑面板 MUST NOT 显示当前 goal tokenBudget

#### Scenario: Save goal
- **WHEN** 用户在目标编辑面板输入非空目标描述并点击保存
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/goal`
- **AND** 页面层 MUST 只提交 trim 后的 objective
- **AND** Web API 封装 MUST 在请求体中显式设置 `tokenBudget: null`
- **AND** 保存成功后 MUST 更新当前 thread 的 goal 状态
- **AND** 目标编辑面板 MUST 关闭

#### Scenario: Reject empty goal
- **WHEN** 用户在目标编辑面板输入空白目标描述
- **THEN** 保存操作 MUST 不可用
- **AND** 前端 MUST NOT 调用目标设置 API

#### Scenario: Clear goal
- **WHEN** 当前 thread 已有 goal
- **AND** 用户在目标编辑面板点击清除目标
- **THEN** 前端 MUST 调用 `DELETE /api/codex/threads/:threadId/goal`
- **AND** 清除成功后 MUST 更新当前 thread 的 goal 状态为空
- **AND** 目标编辑面板 MUST 关闭

#### Scenario: Goal API failure
- **WHEN** 设置或清除目标 API 失败
- **THEN** 目标编辑面板 MUST 保持打开
- **AND** 面板内 MUST 显示错误提示
- **AND** 用户已输入的目标描述 MUST 保留
