# permission-mode-controls Specification

## Purpose
TBD - created by archiving change redesign-mobile-composer-permission-controls. Update Purpose after archive.
## Requirements
### Requirement: Composer permission mode chip
移动端会话页空闲态 composer SHALL 在底部工具栏常驻展示当前权限模式 chip。chip MUST 使用用户可理解的中文标签展示常见 permission profile，并在 profile 未知时回退显示 profile id 或 app-server description。

#### Scenario: Render active permission mode
- **WHEN** 用户进入会话页且 thread 处于静止状态
- **THEN** composer 底部工具栏 MUST 显示当前权限模式 chip
- **AND** chip MUST 与发送按钮、模型/思考档位 chip 同处于发送前状态区域

#### Scenario: Unknown permission profile
- **WHEN** 当前 active permission profile 不是移动端内置映射的常见 profile
- **THEN** 权限 chip MUST 显示 profile id
- **AND** 如果 app-server 提供 description，权限选择面板 MUST 展示该 description

### Requirement: Permission mode picker
权限模式 chip SHALL 打开移动端权限模式选择面板。面板 MUST 至少支持 app-server 返回的 permission profiles，并提供「自定义 config.toml」选项用于清除会话级权限 override。

#### Scenario: Open picker
- **WHEN** 用户点击 composer 底部工具栏的权限模式 chip
- **THEN** 系统 MUST 打开权限模式选择面板
- **AND** 面板 MUST 显示可选权限模式、说明文案和当前选中状态

#### Scenario: Config default option
- **WHEN** 权限模式选择面板打开
- **THEN** 面板 MUST 提供「自定义 config.toml」或等价选项
- **AND** 该选项 MUST 表示使用 app-server / `config.toml` 当前定义的默认权限

### Requirement: Permission mode update semantics
用户选择权限模式后，系统 SHALL 更新当前会话后续 turn 的 permission profile。普通 profile MUST 以 profile id 写入；「自定义 config.toml」MUST 以 `permissions: null` 清除会话级 override。

#### Scenario: Select named profile
- **WHEN** 用户在权限模式选择面板中选择一个 named permission profile
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions` profile id
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一个 profile id，除非用户再次切换

#### Scenario: Select config default
- **WHEN** 用户选择「自定义 config.toml」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: null`
- **AND** 后续 `POST /api/codex/turns/start` MUST 不带 named profile override 或以 `permissions: null` 表达清除 override

#### Scenario: Running turn unchanged
- **WHEN** agent 正在执行当前 turn
- **AND** 用户切换权限模式
- **THEN** 当前已开始的 turn 权限 MUST 不变
- **AND** 新权限模式 MUST 只影响后续 turn

### Requirement: Permission mode state source
会话页 SHALL 优先使用 app-server 返回的 active permission profile 作为当前权限显示来源。本地缓存 SHALL 仅作为刷新恢复或 app-server 暂未返回 active profile 时的兜底。

#### Scenario: Read active profile from backend
- **WHEN** `thread/resume`、`thread/start` 或等价读取结果包含 `activePermissionProfile`
- **THEN** 前端 MUST 使用该 profile 作为权限 chip 的当前状态

#### Scenario: Fallback to local state
- **WHEN** app-server 暂未返回 active permission profile
- **AND** 前端存在该 thread 的本地权限选择记录
- **THEN** 权限 chip SHALL 使用本地记录作为临时显示
- **AND** 下一次后端返回 active profile 后 MUST 以后端状态为准

