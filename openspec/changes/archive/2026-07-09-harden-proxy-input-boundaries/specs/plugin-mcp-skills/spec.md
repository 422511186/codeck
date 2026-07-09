## ADDED Requirements

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
