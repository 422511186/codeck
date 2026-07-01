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
系统 SHALL 支持列出技能、写入技能配置和设置额外根路径。返回给移动端的 `MobileSkillView` MUST 包含 `cwd`、`name`、`path`、`description`、`shortDescription`、`scope` 和 `enabled`，其中 `path` 用于构造 app-server `UserInput.skill`。

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

#### Scenario: Set skills extra roots
- **WHEN** 已认证用户 POST `/api/codex/skills/extra-roots` 并提供 `extraRoots`
- **THEN** 调用 `gateway.setSkillsExtraRoots(extraRoots)`

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

**Open Questions**

1. **插件安装/卸载无审计记录**：`plugin/install` 和 `plugin/uninstall` 路由不记录审计日志。插件可能引入新的代码执行能力（hooks、MCP servers），是否需要审计？
2. **MCP 资源读取无路径校验**：`readMcpResource` 接收 server 和 uri 参数，但不做路径校验或内容审查。MCP 服务器可能返回敏感数据。是否需要限制？
3. **MCP OAuth login 无审计**：`mcpServer/oauth/login` 不记录审计日志。OAuth 流程可能涉及外部认证。是否需要记录？
4. **Skills extra roots 无校验**：`setSkillsExtraRoots` 接收 extraRoots 数组，但不校验这些路径是否在工作区范围内。是否应该校验？
5. **Windows sandbox readiness 无审计**：sandbox 操作不记录审计日志。
6. **Mock experimental method 无安全限制**：`mock/experimentalMethod` 是一个调试端点，在生产模式（spawn/external）下仍然可访问。是否应该仅在 mock 模式下可用？
