## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 底部输入区固定单行 + 半屏编辑器
会话页底部在 thread 静止时 SHALL 固定显示空闲态 composer。composer SHALL 使用移动端两层卡片结构：上层为自动增高文本输入区，下层为固定工具栏。composer MUST 不再提供半屏编辑入口；文本输入区达到最大高度后 MUST 内部滚动，并保持底部工具栏可见。composer 高度变化时，timeline MUST 为实际 composer 高度保留底部空间，不得遮挡最新消息。

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

#### Scenario: Composer height does not cover latest timeline message
- **WHEN** 用户输入多行文本或添加上下文导致 composer 高度变高
- **THEN** timeline 滚动区域底部 MUST 按实际 composer 高度保留空间
- **AND** 最新消息 MUST NOT 被 composer 遮挡
- **AND** 如果用户原本停留在 timeline 底部附近，系统 MUST 在高度变化后保持最新消息可见

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

## REMOVED Requirements

### Requirement: 图片相册选单张
**Reason**: 产品要求图片上传支持多选和多张上传，单条 turn 仅允许一张图片已经不符合当前移动端使用场景。

**Migration**: 使用新增的 `图片相册选多张` 要求；旧的再次选择替换行为改为追加选择，用户仍可通过单张缩略图移除操作删除不需要的图片。
