# plugin-mcp-skills Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Plugin list
系统 SHALL 支持列出所有插件市场的插件信息（名称、安装状态、可用性等）。

#### Scenario: List plugins
- **WHEN** 已认证用户通过 settings 聚合请求 `plugin/list`
- **THEN** 返回 `MobilePluginView[]` 和 `MobilePluginMarketplaceErrorView[]`

### Requirement: Plugin read
系统 SHALL 支持读取单个插件的详情（描述、技能、hooks、apps、MCP 服务器）。

#### Scenario: Read plugin detail
- **WHEN** 已认证用户 GET `/api/codex/plugins/{pluginName}`
- **THEN** 调用 `gateway.readPlugin({pluginName})`，返回 `MobilePluginDetailView`

### Requirement: Plugin install
系统 SHALL 支持安装插件。安装结果包含 authPolicy 和需要授权的 apps 列表。

#### Scenario: Install plugin
- **WHEN** 已认证用户 POST `/api/codex/plugins/{pluginName}/install`
- **THEN** 调用 `gateway.installPlugin({pluginName})`，返回 `{authPolicy, appsNeedingAuth}`

### Requirement: Plugin uninstall
系统 SHALL 支持卸载插件。

#### Scenario: Uninstall plugin
- **WHEN** 已认证用户 POST `/api/codex/plugins/{pluginName}/uninstall`
- **THEN** 调用 `gateway.uninstallPlugin(pluginId)`

### Requirement: Plugin skill read
系统 SHALL 支持读取插件技能的内容。

#### Scenario: Read plugin skill
- **WHEN** 已认证用户 GET `/api/codex/plugin-skills/{skillName}`
- **THEN** 调用 `gateway.readPluginSkill({remoteMarketplaceName, remotePluginId, skillName})`，返回技能内容

### Requirement: Skills management
系统 SHALL 支持列出技能、写入技能配置和设置额外根路径。返回给移动端的 `MobileSkillView` MUST 包含 `cwd`、`name`、`path`、`description`、`shortDescription`、`scope` 和 `enabled`，其中 `path` 用于构造 app-server `UserInput.skill`。Skills 加载、启用状态或 roots 变化通知 SHALL 使移动端 Skills picker 缓存失效，并在具备可靠 thread/turn 归属时作为 timeline 轻量活动展示。

#### Scenario: List skills
- **WHEN** 已认证用户通过 settings 聚合请求 `skills/list`
- **THEN** 返回 `MobileSkillView[]` 和 `MobileSkillErrorView[]`
- **AND** 每个 `MobileSkillView` MUST 包含 skill `path`

#### Scenario: List skills for chat picker
- **WHEN** 已认证用户 GET `/api/codex/skills`
- **THEN** 调用 `gateway.listSkills({enabledOnly: true})`
- **AND** 返回已启用 `MobileSkillView[]` 和 `MobileSkillErrorView[]`

#### Scenario: List skills for active thread cwd
- **WHEN** 已认证用户 GET `/api/codex/skills?cwd=<thread-cwd>`
- **THEN** 系统 MUST 校验 `cwd` 是允许运行时路径
- **AND** 调用 `gateway.listSkills({enabledOnly: true, cwds: [thread-cwd]})`
- **AND** 返回该项目 `cwd` 可见的已启用 user/repo skills

#### Scenario: Write skill config
- **WHEN** 已认证用户 POST `/api/codex/skills/config` 并提供 `name`、`path`、`enabled`
- **THEN** 调用 `gateway.writeSkillConfig()`，返回 `{effectiveEnabled}`
- **AND** 移动端 MUST 使 Skills picker 缓存失效

#### Scenario: Set skills extra roots
- **WHEN** 已认证用户 POST `/api/codex/skills/extra-roots` 并提供 `extraRoots`
- **THEN** 调用 `gateway.setSkillsExtraRoots(extraRoots)`
- **AND** 移动端 MUST 使 Skills picker 缓存失效

#### Scenario: Skills changed notification refreshes picker cache
- **WHEN** app-server 通知 Skills 已加载、变更、启用状态变化或 roots 变化
- **THEN** 移动端 MUST 使已缓存的 chat picker Skills 列表失效
- **AND** 下一次打开 picker 或强制刷新时 MUST 重新请求 `/api/codex/skills`

#### Scenario: Runtime loaded Skills are distinct from selected Skill references
- **WHEN** 用户消息中包含用户主动选择的 Skill 引用
- **AND** 同一 turn 中 runtime 又发送 Skills 加载活动
- **THEN** 用户消息 MUST 继续以 chips 展示主动选择的 Skill 引用
- **AND** runtime 加载活动 MUST 作为 timeline activity 展示
- **AND** 两者 MUST NOT 互相覆盖或重复去重

### Requirement: Hooks management
系统 SHALL 支持列出 hooks 信息。

#### Scenario: List hooks
- **WHEN** 已认证用户通过 settings 聚合请求 `hooks/list`
- **THEN** 返回 `MobileHookView[]`、`MobileHookNoticeView[]` 和 `MobileHookErrorView[]`

### Requirement: MCP server management
系统 SHALL 支持列出 MCP 服务器状态、OAuth 登录、读取资源、刷新服务器。

#### Scenario: List MCP server status
- **WHEN** 已认证用户通过 settings 聚合请求 `mcpServerStatus/list`
- **THEN** 返回 `MobileMcpServerView[]`

#### Scenario: MCP server OAuth login
- **WHEN** 已认证用户 POST `/api/codex/mcp/servers/{serverName}/login`
- **THEN** 调用 `gateway.loginMcpServer(serverName)`，返回 `{authorizationUrl}`

#### Scenario: MCP resource read
- **WHEN** 已认证用户 POST `/api/codex/mcp/resources/read` 并提供 server 和 uri
- **THEN** 调用 `gateway.readMcpResource({server, uri})`，返回资源内容

#### Scenario: MCP server refresh
- **WHEN** 已认证用户 POST `/api/codex/mcp/servers/{serverName}/refresh`
- **THEN** 调用 `gateway.refreshMcpServer()`（底层调用 `config/mcpServer/reload`）

### Requirement: Apps list
系统 SHALL 支持列出可用应用。

#### Scenario: List apps
- **WHEN** 已认证用户 GET `/api/codex/apps`
- **THEN** 调用 `gateway.listApps()`，返回 `MobileAppPage`

### Requirement: MCP server event notifications
MCP 服务器启动状态变更 SHALL 通过 `mcpServer/startupStatus/updated` 通知推送到浏览器，触发 settings 刷新。

#### Scenario: MCP status update notification
- **WHEN** app-server 发送 `mcpServer/startupStatus/updated` 通知
- **THEN** 转换为 `{kind: "settings_invalidated"}` 事件

### Requirement: Experimental features
系统 SHALL 支持列出和设置实验性功能的启用状态。

#### Scenario: List experimental features
- **WHEN** 已认证用户通过 settings 聚合请求 `experimentalFeature/list`
- **THEN** 返回 `MobileExperimentalFeatureView[]`

#### Scenario: Set experimental feature enablement
- **WHEN** 已认证用户 POST `/api/codex/experimental-features/enablement` 并提供 enablement map
- **THEN** 调用 `gateway.setExperimentalFeatureEnablement()`

### Requirement: Collaboration modes
系统 SHALL 支持列出协作模式（Code、Ask 等）。

#### Scenario: List collaboration modes
- **WHEN** 已认证用户通过 settings 聚合请求 `collaborationMode/list`
- **THEN** 返回 `MobileCollaborationModeView[]`

### Requirement: Permission profiles
系统 SHALL 支持列出权限配置方案。

#### Scenario: List permission profiles
- **WHEN** 已认证用户通过 settings 聚合请求 `permissionProfile/list`
- **THEN** 返回 `MobilePermissionProfileOption[]`

### Requirement: Model provider capabilities
系统 SHALL 支持读取模型提供商的能力（namespaceTools、imageGeneration、webSearch）。

#### Scenario: Read provider capabilities
- **WHEN** 已认证用户通过 settings 聚合请求 `modelProvider/capabilities/read`
- **THEN** 返回 `MobileModelProviderCapabilitiesView`

### Requirement: Model list
系统 SHALL 支持列出可用模型。隐藏模型 MUST 从列表中过滤。reasoningEffort MUST 通过 `normalizeReasoningEffort` 标准化。

#### Scenario: List models
- **WHEN** 已认证用户 GET `/api/codex/models`
- **THEN** 调用 `gateway.listModels()`，返回非隐藏模型的列表

### Requirement: Windows sandbox
系统 SHALL 支持检查和启动 Windows Sandbox 的就绪状态和设置。

#### Scenario: Check sandbox readiness
- **WHEN** 已认证用户 GET `/api/codex/windows-sandbox/readiness`
- **THEN** 调用 `gateway.getWindowsSandboxReadiness()`，返回 `{status}`

#### Scenario: Start sandbox setup
- **WHEN** 已认证用户 POST `/api/codex/windows-sandbox/setup` 并提供 `mode` 和可选 `cwd`
- **THEN** 调用 `gateway.startWindowsSandboxSetup()`

### Requirement: Chat Skill 引用在 timeline 中保持可回放
通过聊天输入区选择的 Skill 引用 SHALL 作为结构化输入发送，并在后续 timeline 展示、历史分页、刷新修复中保持可识别。系统 SHALL 使用 Skill `name` 作为主要展示文案，使用 `path` 作为稳定标识和发送协议字段。发送失败后的重试 SHALL 保留原用户消息中的 Skill 引用。

#### Scenario: 发送结构化 Skill 引用
- **WHEN** 用户通过聊天输入区选择 Skill 后发送消息
- **THEN** start turn 请求 MUST 包含对应 Skill 的 `name` 和 `path`
- **AND** 用户消息 timeline item MUST 保留该 Skill 引用

#### Scenario: 历史消息恢复 Skill 引用
- **WHEN** 页面从服务端历史或 snapshot 中读取包含 `type: "skill"` 的用户消息内容
- **THEN** 系统 MUST 将其转换为结构化 Skill 引用
- **AND** MUST 不把该内容转换成 `[skill]` 文本

#### Scenario: 多个 Skill 引用
- **WHEN** 一条用户消息包含多个 Skill 引用
- **THEN** timeline MUST 展示每个 Skill 的名称
- **AND** 每个 Skill MUST 使用其 `name/path` 组合保持稳定去重和渲染 key

#### Scenario: 失败消息重试保留 Skill 引用
- **WHEN** 包含 Skill 引用的用户消息发送失败
- **AND** 用户从失败消息触发重试
- **THEN** 重试请求 MUST 继续携带原消息的 Skill 引用
- **AND** timeline 中的新用户消息 MUST 继续展示这些 Skill chips

### Requirement: Skills config write validates boolean semantics
`/api/codex/skills/config` SHALL 要求 `enabled` 为真实 boolean。缺失、字符串或其他类型 MUST 被拒绝，不能通过 `Boolean(value)` 改变语义。

#### Scenario: String false is rejected
- **WHEN** 已认证用户 POST `/api/codex/skills/config` 且 `enabled` 为字符串 `"false"`
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server

#### Scenario: Boolean false is preserved
- **WHEN** 已认证用户 POST `/api/codex/skills/config` 且 `enabled` 为 boolean `false`
- **THEN** route MUST 调用 app-server 并保留 `enabled: false`

### Requirement: Installed plugin cwds validation
系统 SHALL 在读取已安装插件信息前校验浏览器传入的 `cwds`。`cwds` 中每个路径 MUST 是非空字符串，并且 MUST 位于 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 内。校验失败时 MUST 返回 HTTP 400，且 MUST NOT 调用 app-server。

#### Scenario: Installed plugin cwds inside workspace
- **WHEN** 已认证用户 POST `/api/codex/plugins/installed` 并提供 workspace 内的 `cwds`
- **THEN** 系统 MUST 将每个 cwd 标准化后调用 app-server `plugin/installed`
- **AND** 返回已安装插件信息

#### Scenario: Installed plugin cwd outside workspace
- **WHEN** 已认证用户 POST `/api/codex/plugins/installed` 且 `cwds` 包含 workspace allowlist 外路径
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server `plugin/installed`

#### Scenario: Installed plugin cwds type error
- **WHEN** 已认证用户 POST `/api/codex/plugins/installed` 且 `cwds` 不是字符串数组
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server `plugin/installed`

