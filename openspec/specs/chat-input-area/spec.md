# chat-input-area Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 底部输入区固定单行 + 半屏编辑器
会话页底部在 thread 静止时 SHALL 固定显示空闲态 composer。composer SHALL 使用移动端两层卡片结构：上层为自动增高文本输入区，下层为固定工具栏。composer MUST 不再提供半屏编辑入口；文本输入区达到最大高度后 MUST 内部滚动，并保持底部工具栏可见。

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

### Requirement: 普通输入框回车不发送
会话页底部普通输入框 SHALL NOT 使用 `Enter` 触发标准发送流程；`Enter` MUST 保持文本输入行为，不得作为发送快捷键。

#### Scenario: 普通输入框回车不发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户在普通输入框按下 `Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程
- **AND** MUST NOT 清空输入框或对应草稿
- **AND** MUST NOT 阻止输入框的默认回车输入行为

#### Scenario: 普通输入框不可发送时按回车
- **WHEN** 普通输入框为空白、图片正在上传、仅有图片无文本或 thread 正在运行
- **AND** 用户按下 `Enter`
- **THEN** 系统 MUST NOT 触发发送
- **AND** MUST 保持现有内容和控件状态

#### Scenario: 普通输入框发送按钮发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户点击底部 composer 的「发送」按钮
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

### Requirement: Skill reference picker
会话页底部 composer SHALL 通过 `+` 添加面板提供 Skill 引用入口。用户可在不记忆 Skill 名称的情况下从已启用 Skill 列表中选择一个或多个 Skill；已选择 Skill MUST 以 chip 形式显示在 composer 内部，并可单独移除。Skill 引用 MUST 作为本次 turn 的结构化输入发送，不得通过拼接自然语言提示词模拟。

#### Scenario: Open skill picker
- **WHEN** thread 静止且底部 composer 渲染
- **AND** 用户打开 `+` 添加面板并点击「引用 Skill」
- **THEN** 用户 MUST 从屏幕底部打开移动端 Skill 选择器
- **AND** 同一次打开过程 MUST 复用进行中的 Skill 列表请求，不得因为 sheet 挂载或重复点击发起重复请求

#### Scenario: Search and select skill
- **WHEN** Skill 选择器打开
- **THEN** 系统 MUST 按当前会话 `cwd` 拉取已启用 Skill 列表
- **AND** 用户 MUST 能按 Skill 名称、短描述或描述搜索
- **AND** 用户选择某个 Skill 后，该 Skill MUST 显示为 composer 内部的 chip

#### Scenario: Remove selected skill
- **WHEN** composer 已选择一个 Skill
- **AND** 用户点击该 Skill chip 的移除操作
- **THEN** 系统 MUST 从本次待发送输入中移除该 Skill

#### Scenario: Send with selected skills
- **WHEN** 用户输入非空文本并选择一个或多个 Skill
- **AND** 用户点击发送
- **THEN** 标准发送流程 MUST 携带这些 Skill 引用
- **AND** 成功发送后 MUST 清空本次已选 Skill
- **AND** MUST 清空输入框和对应草稿

#### Scenario: Skill list load failure
- **WHEN** Skill 选择器拉取列表失败
- **THEN** 选择器 MUST 显示错误状态和重试入口
- **AND** 普通文本和图片发送 MUST 继续可用

### Requirement: 发送规则
发送按钮 SHALL 仅在输入框包含文本（或图片 + 文本）且非空白时可点；空消息（仅图片但无文本）SHALL 被禁止发送。

#### Scenario: 空消息
- **WHEN** 输入框文本为空白
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 仅图片无文本
- **WHEN** 用户已选图但文本为空
- **THEN** 发送按钮 MUST 不可点

### Requirement: Agent 跑中显示状态栏与中断
当当前 thread 处于运行态（has active turn）时，底部发送区 SHALL 切换为运行态状态栏。状态栏 SHALL 显示 agent 正在生成的状态提示，并把中断按钮作为唯一主要操作。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 底部发送区 MUST 显示运行态状态栏
- **AND** MUST 显示「正在生成…」或等价状态提示
- **AND** MUST 显示中断按钮
- **AND** MUST 不显示普通输入框、`+` 添加入口、权限模式 chip、模型/思考档位 chip 或发送按钮

#### Scenario: 点击中断
- **WHEN** 用户点击中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** 输入区 MUST 在 thread 恢复静止后重新显示空闲态 composer

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口

### Requirement: 草稿按会话保存
未发送的输入框内容 SHALL 按 `threadId` 保存到 `localStorage`，切换会话或刷新页面后恢复。

#### Scenario: 切换会话
- **WHEN** 用户在会话 A 输入未发送内容
- **AND** 切换到会话 B
- **THEN** 会话 B 的输入框 MUST 显示其自己的草稿（如果存在）
- **AND** 切回会话 A 时 MUST 恢复 A 的草稿

#### Scenario: 发送后清空
- **WHEN** 用户成功发送一条消息
- **THEN** 该会话对应的草稿 MUST 被清空

### Requirement: 图片相册选单张
composer SHALL 通过 `+` 添加面板提供图片入口，点击仅打开相册选择（不调用相机），单条 turn 仅允许一张图片。

#### Scenario: 选图
- **WHEN** 用户打开 `+` 添加面板并点击「图片」
- **THEN** 系统 MUST 打开相册选择
- **AND** MUST 不打开相机

#### Scenario: 已选图
- **WHEN** 已经选过一张图且未发送
- **AND** 用户再次通过 `+` 添加面板选择图片
- **THEN** 新选择的图片 MUST 替换原图，而非追加

### Requirement: 未发送图片缩略图与失败处理
选好图但未发送时 SHALL 在 composer 内部显示缩略图，可点击 `✕` 移除；上传中显示进度环；上传失败时缩略图变红、点击重试。

#### Scenario: 选完图
- **WHEN** 用户从相册选定一张图
- **THEN** composer 内部 MUST 显示缩略图
- **AND** 缩略图 MUST 提供 `✕` 移除按钮

#### Scenario: 上传中
- **WHEN** 用户已点发送、图片正在上传
- **THEN** 缩略图上 MUST 叠加进度环

#### Scenario: 上传失败
- **WHEN** `POST /api/codex/uploads/images` 失败
- **THEN** 缩略图 MUST 变红
- **AND** 点击 MUST 重试上传

### Requirement: turns/start 失败的可重试呈现
当用户已点发送、`POST /api/codex/turns/start` 返回失败时 SHALL 把 timeline 上的用户消息标红并提供重试按钮。

#### Scenario: 接口失败
- **WHEN** `turns/start` 返回失败
- **THEN** timeline 上对应的用户消息 MUST 变红
- **AND** MUST 提供「重试」按钮
- **AND** 错误细节 MUST 在内嵌错误卡片中显示

### Requirement: Composer add panel
移动端空闲态 composer SHALL 提供左下角 `+` 添加入口。点击后 MUST 在 composer 上方打开添加面板，面板用于承载给本次请求添加上下文或能力的入口。

#### Scenario: Open add panel
- **WHEN** thread 静止且用户点击 composer 左下角 `+`
- **THEN** 系统 MUST 在 composer 上方打开添加面板
- **AND** 添加面板 MUST 适配手机宽度
- **AND** 添加面板高度超过最大值时 MUST 在面板内部滚动

#### Scenario: Add panel primary actions
- **WHEN** 添加面板打开
- **THEN** 面板 MUST 至少包含「图片」和「引用 Skill」入口
- **AND** 这些入口 MUST 替代 composer 底栏中的独立图片按钮和独立 Skill 按钮

#### Scenario: Close add panel after action
- **WHEN** 用户在添加面板中选择「图片」或「引用 Skill」
- **THEN** 添加面板 MUST 关闭
- **AND** 对应的图片选择或 Skill 选择流程 MUST 继续执行
