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
设置页 SHALL 只包含以下五类内容，不暴露其他后端能力：
- 默认模型与默认 Plan/Build 模式
- 主题切换（自适应 / 明亮 / 暗黑）
- 账号状态（来自 `GET /api/codex/account/auth-status`）
- Token 用量（来自 `GET /api/codex/account/token-usage`）
- 登出 Web（清除 session cookie + 跳回登录页）

#### Scenario: 设置项分组
- **WHEN** 用户进入设置页
- **THEN** 页面 MUST 至少包含「默认模型与模式」「主题」「账号」「Token 用量」「登出 Web」五块
- **AND** MUST 不包含 marketplace、插件、MCP、配置批量编辑、Remote Control、Windows Sandbox、environment 等管理类入口

### Requirement: 默认模型与默认模式
设置页 SHALL 提供全局默认模型选择器和全局默认 Plan/Build 选择器；新建会话时 MUST 使用该全局默认值。

#### Scenario: 设置全局默认模型
- **WHEN** 用户在设置页选择默认模型
- **THEN** 前端 MUST 持久化到 localStorage
- **AND** 之后新建的会话 MUST 默认使用该模型

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
设置页 SHALL 调用 `GET /api/codex/account/token-usage` 展示 token 用量；MUST 不在 timeline 或会话页其他地方显示 token 数据。

#### Scenario: Token 用量只在设置里
- **WHEN** 用户进入设置页
- **THEN** Token 用量数据 MUST 在设置页可见

#### Scenario: 不在 timeline 显示
- **WHEN** 用户在会话聊天页
- **THEN** timeline 中 MUST 不显示任何 token 用量或耗时数字

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
模型选择器（设置页和会话头部）SHALL 在每次打开时调用 `GET /api/codex/models`；MUST 不做长期缓存。

#### Scenario: 打开选择器拉模型
- **WHEN** 用户打开任一模型选择器
- **THEN** 前端 MUST 实时调用 `/api/codex/models`
- **AND** MUST 用最新返回结果渲染列表

