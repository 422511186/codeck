## ADDED Requirements

### Requirement: 普通文件支持多选与追加
composer SHALL 通过 `+` 添加面板提供「文件」入口。文件入口 MUST 打开支持多选的系统文件选择器；同一草稿再次选择文件时 MUST 追加，而不是替换已经选择的普通文件、图片或 Skill。

#### Scenario: 一次选择多个普通文件
- **WHEN** 用户打开添加面板并点击「文件」
- **THEN** 系统 MUST 打开支持多选的文件选择器
- **AND** 用户选择的普通文件 MUST 按选择顺序加入当前草稿

#### Scenario: 再次选择时追加
- **WHEN** 草稿已经包含一个或多个普通文件
- **AND** 用户再次从「文件」入口选择文件
- **THEN** 新文件 MUST 追加到当前普通文件列表
- **AND** MUST NOT 替换已有普通文件、图片或 Skill 引用

#### Scenario: 文件选择器选中受支持图片
- **WHEN** 用户从「文件」入口选择 MIME 与扩展名均属于现有图片白名单的文件
- **THEN** 该文件 MUST 进入现有图片上传流程
- **AND** MUST 使用图片缩略图、`localImage` 和模型 image modality 校验
- **AND** MUST NOT 同时创建普通文件附件

### Requirement: 普通文件上传状态、操作与配额
composer SHALL 为每个普通文件维护独立的上传状态，并以紧凑文件 chip 显示名称、格式化大小和状态。普通文件 MUST 限制为单条消息最多 10 个、单文件最多 20 MiB、合计最多 50 MiB，客户端同时上传的普通文件 MUST 不超过 3 个。

#### Scenario: 文件上传中
- **WHEN** 一个普通文件正在上传
- **THEN** 对应文件 chip MUST 显示上传中状态
- **AND** 发送按钮 MUST 不可点
- **AND** 其他已排队文件 MUST 在并发槽位可用后自动开始

#### Scenario: 单个文件上传失败
- **WHEN** 一个普通文件上传失败
- **THEN** 对应文件 chip MUST 显示失败状态和重试操作
- **AND** 重试 MUST 只重新上传该文件
- **AND** 用户 MUST 能移除该失败文件
- **AND** 文件仍失败且未移除时发送按钮 MUST 不可点

#### Scenario: 文件上传完成
- **WHEN** 普通文件上传成功并返回服务端引用
- **THEN** 对应文件 chip MUST 显示完成状态
- **AND** 发送 payload MUST 使用服务端返回的 `fileReference`

#### Scenario: 超过单文件限制
- **WHEN** 用户选择大小超过 20 MiB 的普通文件
- **THEN** 客户端 MUST 不发起该文件的上传请求
- **AND** MUST 显示可理解的大小限制错误
- **AND** 其他符合限制的已选附件 MUST 保持不变

#### Scenario: 超过数量或总量限制
- **WHEN** 新选择会使普通文件超过 10 个或合计超过 50 MiB
- **THEN** 客户端 MUST 不把超出限制的文件加入上传队列
- **AND** MUST 告知用户触发的数量或总量限制
- **AND** 已经选择和上传的附件 MUST 保持不变

#### Scenario: 逐项移除普通文件
- **WHEN** 用户点击某个普通文件 chip 的移除操作
- **THEN** composer MUST 只移除该普通文件
- **AND** MUST NOT 移除其他文件、图片、Skill 或文本草稿

### Requirement: 普通文件草稿在运行态保持
agent 运行期间 composer SHALL 允许用户为下一轮选择和上传普通文件。运行态选择的普通文件 MUST 保持为下一次手动发送的草稿，MUST NOT 注入当前 turn。

#### Scenario: 运行中准备下一轮文件
- **WHEN** 当前 thread 存在 active turn
- **AND** 用户选择普通文件并编辑文本
- **THEN** 文件与文本 MUST 保留在 composer
- **AND** 当前 active turn MUST NOT 收到这些文件

#### Scenario: 当前 turn 结束
- **WHEN** 当前 active turn 结束且 composer 已准备普通文件
- **THEN** composer MUST 保留文件、上传状态和文本
- **AND** 用户 MUST 能按标准发送流程手动发送下一轮

## MODIFIED Requirements

### Requirement: 发送规则
发送按钮 SHALL 仅在输入框包含非空白文本，且所有图片与普通文件都已上传完成并满足输入兼容性时可点；空消息、仅图片无文本或仅普通文件无文本 SHALL 被禁止发送。

#### Scenario: 空消息
- **WHEN** 输入框文本为空白
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 仅图片无文本
- **WHEN** 用户已选图但文本为空
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 仅普通文件无文本
- **WHEN** 用户已选择一个或多个普通文件但文本为空
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 文本与附件均已就绪
- **WHEN** 输入框包含非空白文本
- **AND** 所有图片和普通文件均已上传完成
- **AND** 当前模型输入兼容性允许发送
- **THEN** 发送按钮 MUST 可点

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
- **THEN** 面板 MUST 显示「图片」「文件」「引用 Skill」「设定目标」或「编辑目标」入口
- **AND** 面板 MUST 不显示尚未支持的「插件」入口
- **AND** 「图片」「文件」和「引用 Skill」入口 MUST 替代 composer 底栏中的独立附件按钮和独立 Skill 按钮

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
- **WHEN** 用户在添加面板中选择「图片」「文件」「引用 Skill」或目标入口
- **THEN** 添加面板 MUST 关闭
- **AND** 对应的图片选择、文件选择、Skill 选择或目标编辑流程 MUST 继续执行
