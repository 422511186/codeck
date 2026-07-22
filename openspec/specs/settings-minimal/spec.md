# settings-minimal Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 设置入口
设置入口 SHALL 位于项目页右上角 `⚙️` 图标；点击进入独立设置页（有独立 URL）。

#### Scenario: 入口位置
- **WHEN** 用户在项目页
- **THEN** 右上角 MUST 显示 `⚙️` 图标
- **AND** 点击后 MUST 跳转到独立设置页路径

### Requirement: 设置项最小集
设置页 SHALL 只包含以下七类内容，不暴露其他后端能力：
- 默认模型与默认 Plan/Build 模式
- 默认项目存储位置
- 自定义模型管理
- 主题切换（自适应 / 明亮 / 暗黑）
- 账号状态（来自 `GET /api/codex/account/auth-status`）
- Token 用量（来自 `GET /api/codex/account/token-usage`）
- 登出 Web（清除 session cookie + 跳回登录页）

#### Scenario: 设置项分组
- **WHEN** 用户进入设置页
- **THEN** 页面 MUST 至少包含「默认模型与模式」「项目」「自定义模型」「主题」「账号」「Token 用量」「登出 Web」七块
- **AND** MUST 不包含 provider、接口地址、API key、marketplace、插件、MCP、配置批量编辑、Remote Control、Windows Sandbox、environment 等管理类入口

### Requirement: 默认模型与默认模式
设置页 SHALL 提供设备默认模型选择器和设备默认 Plan/Build 选择器；新建会话时 MUST 使用该设备默认值。默认模型 MUST 以来源敏感结构化身份保存，自定义模型使用 `customModelId`，app-server 模型使用模型标识。

#### Scenario: 设置设备默认模型
- **WHEN** 用户在设置页选择默认模型
- **THEN** 前端 MUST 将结构化选择身份持久化到 localStorage
- **AND** 之后新建的会话 MUST 由后端使用最新目录解析该身份

#### Scenario: 自定义默认已失效
- **WHEN** localStorage 默认引用的 `customModelId` 已不存在
- **THEN** 前端 MUST 清除该默认并回退到 app-server 服务端默认模型
- **AND** MUST NOT 改为同名 app-server 模型

#### Scenario: 设置全局默认 Plan/Build
- **WHEN** 用户在设置页选择默认 Plan/Build
- **THEN** 前端 MUST 持久化到 localStorage
- **AND** 之后新建的会话 MUST 默认使用该模式
- **AND** 系统级初始默认值 MUST 为 `Build`

### Requirement: 账号状态展示
设置页 SHALL 调用 `GET /api/codex/account/auth-status` 显示当前 Codex 账号登录状态（已登录/未登录/账号标识）；不在 UI 暴露登录/登出 Codex 账号的操作（属于后端配置）。

#### Scenario: 显示账号状态
- **WHEN** 用户进入设置页
- **THEN** 前端 MUST 调用 `auth-status` 并展示登录状态文本
- **AND** MUST 不显示 ChatGPT 登录、API key 登录、Codex 账号登出等操作按钮

### Requirement: Token 用量展示
设置页 SHALL 调用 `GET /api/codex/account/token-usage` 展示 token 用量；MUST 不在 timeline 或会话页其他地方显示 token 数据。账号未提供可读取 token 用量的 ChatGPT 认证时，该 API MUST 返回可渲染的空用量结果，不得把该预期不可用状态冒泡为 5xx 网关错误。

#### Scenario: Token 用量只在设置里
- **WHEN** 用户进入设置页
- **THEN** Token 用量数据 MUST 在设置页可见

#### Scenario: 不在 timeline 显示
- **WHEN** 用户在会话聊天页
- **THEN** timeline 中 MUST 不显示任何 token 用量或耗时数字

#### Scenario: Token 用量不可用
- **WHEN** app-server 返回 “chatgpt authentication required to read token usage” 或等价的账号用量不可用错误
- **THEN** `GET /api/codex/account/token-usage` MUST 返回 HTTP 200
- **AND** 响应 MUST 包含 `summary` 各字段为 `null`、`dailyUsageBuckets: null` 的空用量
- **AND** 设置页 MUST 不把该情况展示为网关错误

### Requirement: 主题切换
设置页 SHALL 提供「自适应 / 明亮 / 暗黑」三种主题选择；选择结果 MUST 持久化到 localStorage，并立即应用到当前页面。

#### Scenario: 默认主题
- **WHEN** 用户尚未设置主题
- **THEN** 设置页主题选项 MUST 默认显示「自适应」

#### Scenario: 切换主题
- **WHEN** 用户选择「明亮」或「暗黑」
- **THEN** 前端 MUST 持久化该主题
- **AND** 当前页面 MUST 立即切换到对应主题

### Requirement: 登出 Web
设置页 SHALL 提供「登出 Web」按钮；点击后清除前端 session cookie 并跳转回登录页；MUST 不影响 Codex 账号在 app-server 侧的登录状态。

#### Scenario: 登出
- **WHEN** 用户点击「登出 Web」
- **THEN** 前端 MUST 清除 web session cookie
- **AND** MUST 跳转到登录页
- **AND** MUST 不调用任何 Codex 账号 logout 接口

### Requirement: 模型列表按需拉取
模型选择器（设置页和会话 composer）SHALL 在每次打开时调用 `GET /api/codex/models`；MUST 不做长期缓存。响应 SHALL 是后端生成的统一可选目录，并包含当前自定义目录修订号。

#### Scenario: 打开选择器拉模型
- **WHEN** 用户打开任一模型选择器
- **THEN** 前端 MUST 实时调用 `/api/codex/models`
- **AND** MUST 用最新返回的来源身份、能力元数据和 `catalogRevision` 渲染列表

### Requirement: 默认项目存储位置由服务端共享
设置页 SHALL 提供「仅当前设备 / 保存到服务端」默认项目存储位置选择器。该值 MUST 持久化到服务端项目目录并在同一后端实例的设备间共享；未保存时初始值 MUST 为服务端。该设置只初始化新增项目表单，MUST NOT 移动已有项目。

#### Scenario: 读取默认项目存储位置
- **WHEN** 用户进入设置页
- **THEN** 前端 MUST 从服务端项目目录读取当前默认值
- **AND** 未配置时 MUST 显示「保存到服务端」

#### Scenario: 修改默认项目存储位置
- **WHEN** 用户选择新的默认项目存储位置
- **THEN** 前端 MUST 携带当前 revision 写入服务端
- **AND** 其他设备刷新设置页后 MUST 显示新值

#### Scenario: 新增表单使用默认值
- **WHEN** 用户修改默认值后打开新增项目表单
- **THEN** 表单 MUST 预选该服务端共享值
- **AND** 用户 MUST 能只为当前新增项目改选

#### Scenario: 修改默认值不迁移项目
- **WHEN** 用户修改默认项目存储位置
- **THEN** 已有客户端和服务端项目 MUST 保持原存储位置

### Requirement: Settings routes own their scroll viewport
在全局 body 锁定滚动的移动端布局中，`/settings` 路由树 SHALL 提供独立的视口级纵向滚动容器。容器 MUST 使用手机动态视口高度并为底部安全区预留空间，不得依赖 document/body 滚动。

#### Scenario: Main settings page reaches logout
- **WHEN** 设置页内容高度超过手机视口
- **THEN** 用户 MUST 能在设置路由容器内纵向滚动
- **AND** MUST 能看到并点击「登出 Web」按钮
- **AND** 按钮 MUST 不被底部安全区遮挡

#### Scenario: Custom model settings reuse scroll viewport
- **WHEN** 用户进入 `/settings/custom-models`
- **THEN** 列表页面 MUST 使用同一 settings 路由滚动边界
- **AND** 固定表单 overlay 自身的滚动行为 MUST 保持可用

#### Scenario: Chat viewport remains isolated
- **WHEN** settings 路由增加独立滚动容器
- **THEN** 全局 body 锁和 thread 页面固定 composer/Timeline 滚动 MUST 保持不变
