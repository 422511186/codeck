# chat-input-area Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
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
会话页底部 composer SHALL 通过 `+` 添加面板提供 Skill 引用入口。用户可在不记忆 Skill 名称的情况下从已启用 Skill 列表中选择一个或多个 Skill；已选择 Skill MUST 以 chip 形式显示在 composer 内部，并可单独移除。Skill 引用 MUST 作为本次 turn 的结构化输入发送，不得通过拼接自然语言提示词模拟。发送后 timeline MUST 展示本次用户消息引用的 Skill，即使服务端用户消息快照未返回 Skill 引用字段。

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

#### Scenario: Timeline keeps selected skills after send
- **WHEN** 用户发送带 Skill 引用的消息
- **AND** `turn/start` 返回的服务端 timeline 用户消息没有 Skill 引用字段
- **THEN** timeline 上对应的用户消息 MUST 继续显示已引用 Skill 的 chip
- **AND** 后续重试、回退或 fork 操作 MUST 使用保留后的 Skill 引用

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
当当前 thread 处于运行态（has active turn）时，底部 composer SHALL 保持可见并允许用户准备下一次发送内容。composer SHALL 将右侧发送按钮切换为中断按钮；中断按钮是运行中的唯一主要执行操作。运行中准备的文本、图片和 Skill 引用 SHALL 只作为下一次手动发送的草稿，不得自动发送，也不得发送到当前正在执行的 turn。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 底部 composer MUST 继续显示普通输入框、`+` 添加入口、权限模式 chip、模型/思考档位 chip 和已选上下文区域
- **AND** composer 右侧 MUST 显示中断按钮
- **AND** composer 右侧 MUST 不显示发送按钮
- **AND** 系统 MUST NOT 清空当前草稿、已选图片或已选 Skill

#### Scenario: 运行中准备下一条输入
- **WHEN** thread 处于运行态
- **AND** 用户编辑输入框、选择图片或选择 Skill
- **THEN** 系统 MUST 保存这些内容作为该 thread 的待发送 composer 状态
- **AND** 这些内容 MUST NOT 触发标准发送流程
- **AND** 这些内容 MUST NOT 调用 `turn/steer`

#### Scenario: 运行结束后发送准备好的内容
- **WHEN** thread 从运行态恢复静止
- **AND** composer 中存在非空文本且图片状态允许发送
- **THEN** composer 右侧 MUST 恢复显示发送按钮
- **AND** 用户点击发送后系统 MUST 按标准发送流程提交文本、图片和 Skill 引用

#### Scenario: 点击中断
- **WHEN** 用户点击运行中 composer 右侧的中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** composer 中已准备但尚未发送的文本、图片和 Skill 引用 MUST 保留

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口
- **AND** 运行中输入的普通文本 MUST 不作为 steer 请求发送

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

### Requirement: 图片相册选多张
composer SHALL 通过 `+` 添加面板提供图片入口，点击仅打开相册选择（不调用相机），单条 turn MUST 支持选择并发送多张图片。

#### Scenario: 多选图片
- **WHEN** 用户打开 `+` 添加面板并点击「图片」
- **THEN** 系统 MUST 打开支持多选的相册选择
- **AND** MUST 不打开相机

#### Scenario: 追加选择图片
- **WHEN** 用户已经选过一张或多张图片且未发送
- **AND** 用户再次通过 `+` 添加面板选择图片
- **THEN** 新选择的图片 MUST 追加到本次待发送图片列表
- **AND** MUST NOT 替换已选图片

#### Scenario: 发送多张图片
- **WHEN** 用户输入非空文本并选择多张已上传完成的图片
- **AND** 用户点击发送
- **THEN** 标准发送流程 MUST 携带所有已选图片路径
- **AND** 成功发送后 MUST 清空本次已选图片

### Requirement: 未发送图片缩略图与失败处理
选好图但未发送时 SHALL 在 composer 内部显示每张已选图片的缩略图，可逐张点击 `✕` 移除；上传中显示进度环；上传失败时对应缩略图变红、点击重试。

#### Scenario: 选完图
- **WHEN** 用户从相册选定一张或多张图
- **THEN** composer 内部 MUST 显示每张已选图片的缩略图
- **AND** 每张缩略图 MUST 提供 `✕` 移除按钮

#### Scenario: 上传中
- **WHEN** 用户已选择图片且图片正在上传
- **THEN** 对应缩略图上 MUST 叠加进度环
- **AND** 存在任意上传中的图片时发送按钮 MUST 不可点

#### Scenario: 上传失败
- **WHEN** 任意一张图片上传失败
- **THEN** 对应缩略图 MUST 变红
- **AND** 点击对应缩略图的重试入口 MUST 只重试该图片
- **AND** 存在任意上传失败的图片时发送按钮 MUST 不可点

### Requirement: turns/start 失败的可重试呈现
当用户已点发送、`POST /api/codex/turns/start` 返回失败时 SHALL 把 timeline 上的用户消息标红并提供重试按钮。

#### Scenario: 接口失败
- **WHEN** `turns/start` 返回失败
- **THEN** timeline 上对应的用户消息 MUST 变红
- **AND** MUST 提供「重试」按钮
- **AND** 错误细节 MUST 在内嵌错误卡片中显示

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

### Requirement: Model reasoning chip display

移动端空闲态 composer MUST 使用两个独立 chip 展示当前模型和推理强度。模型 chip 只显示模型标识并打开模型选择器；推理强度 chip 只显示当前档位并打开独立选择器。两个 chip MUST 使用紧凑英文展示，常见推理强度 MUST 展示为 `Low`、`Medium`、`High`。协议传参 MUST 继续使用 app-server 返回的原始 reasoning effort 值。

#### Scenario: Render independent model and reasoning chips
- **WHEN** 当前模型为 `gpt-5-codex`
- **AND** 当前 reasoning effort 为 `medium`
- **THEN** composer MUST 分别显示模型 chip `gpt-5-codex` 和推理强度 chip `Medium`
- **AND** 两个 chip MUST 都不包含中文逗号或英文逗号

#### Scenario: Model chip opens only model picker
- **WHEN** 用户点击模型 chip
- **THEN** 系统 MUST 打开模型选择器
- **AND** 模型选择器 MUST NOT 显示推理强度选项

#### Scenario: Reasoning chip opens only effort picker
- **WHEN** 用户点击推理强度 chip
- **THEN** 系统 MUST 打开独立推理强度选择器
- **AND** 选择器 MUST 只显示当前模型支持的 effort 选项

#### Scenario: Render known reasoning effort labels
- **WHEN** 选择器显示 reasoning effort 选项 `low`、`medium`、`high`
- **THEN** 选项 MUST 分别显示为 `Low`、`Medium`、`High`
- **AND** 选项 MUST NOT 显示为「低」「中」「高」

#### Scenario: Preserve reasoning effort protocol value
- **WHEN** 用户选择显示为 `High` 的 reasoning effort
- **THEN** 后续 settings update 或 turn start 请求 MUST 继续发送原始值 `high`
- **AND** 请求中 MUST NOT 发送展示文案 `High`

#### Scenario: Unknown reasoning effort fallback
- **WHEN** app-server 返回未知 reasoning effort 字符串
- **THEN** UI MUST 使用可读英文形式展示该字符串
- **AND** 后续请求 MUST 保留原始字符串值

#### Scenario: Model without effort hides reasoning chip
- **WHEN** 当前模型没有 supported reasoning efforts 且当前 effort 为空
- **THEN** composer MUST 隐藏推理强度 chip

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

