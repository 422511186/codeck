## MODIFIED Requirements

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

## ADDED Requirements

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
