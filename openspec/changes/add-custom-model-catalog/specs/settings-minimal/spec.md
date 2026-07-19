## MODIFIED Requirements

### Requirement: 设置项最小集
设置页 SHALL 只包含以下六类内容，不暴露其他后端能力：
- 默认模型与默认 Plan/Build 模式
- 自定义模型管理
- 主题切换（自适应 / 明亮 / 暗黑）
- 账号状态（来自 `GET /api/codex/account/auth-status`）
- Token 用量（来自 `GET /api/codex/account/token-usage`）
- 登出 Web（清除 session cookie + 跳回登录页）

#### Scenario: 设置项分组
- **WHEN** 用户进入设置页
- **THEN** 页面 MUST 至少包含「默认模型与模式」「自定义模型」「主题」「账号」「Token 用量」「登出 Web」六块
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

### Requirement: 模型列表按需拉取
模型选择器（设置页和会话 composer）SHALL 在每次打开时调用 `GET /api/codex/models`；MUST 不做长期缓存。响应 SHALL 是后端生成的统一可选目录，并包含当前自定义目录修订号。

#### Scenario: 打开选择器拉模型
- **WHEN** 用户打开任一模型选择器
- **THEN** 前端 MUST 实时调用 `/api/codex/models`
- **AND** MUST 用最新返回的来源身份、能力元数据和 `catalogRevision` 渲染列表
