## ADDED Requirements

### Requirement: Remote control status read
系统 SHALL 支持读取远程控制状态（status、serverName、installationId、environmentId）。

#### Scenario: Read remote control status
- **WHEN** 已认证用户读取 settings 时
- **THEN** 作为 settings 聚合的一部分，并行请求 `remoteControl/status/read`

### Requirement: Remote control enable
系统 SHALL 支持启用远程控制。操作 MUST 记录审计日志。

#### Scenario: Enable remote control
- **WHEN** 已认证用户 POST `/api/codex/remote-control/enable`
- **THEN** 调用 `gateway.enableRemoteControl()`，记录审计日志，返回 `{ok: true, status}`

### Requirement: Remote control disable
系统 SHALL 支持禁用远程控制。操作 MUST 记录审计日志。

#### Scenario: Disable remote control
- **WHEN** 已认证用户 POST `/api/codex/remote-control/disable`
- **THEN** 调用 `gateway.disableRemoteControl()`，记录审计日志

### Requirement: Remote control pairing start
系统 SHALL 支持启动远程控制配对流程，返回 pairingCode、manualPairingCode、environmentId 和 expiresAt。操作 MUST 记录审计日志。

#### Scenario: Start pairing
- **WHEN** 已认证用户 POST `/api/codex/remote-control/pairing`
- **THEN** 调用 `gateway.startRemoteControlPairing()`，记录审计日志，返回配对信息

### Requirement: Remote control pairing status
系统 SHALL 支持查询配对状态（是否已被 claimed）。

#### Scenario: Check pairing status
- **WHEN** 已认证用户 GET `/api/codex/remote-control/pairing/status`
- **THEN** 调用 `gateway.readRemoteControlPairingStatus()`，返回 `{claimed: boolean}`

### Requirement: Remote control client list
系统 SHALL 支持列出已连接的远程控制客户端。

#### Scenario: List clients
- **WHEN** 已认证用户 GET `/api/codex/remote-control/clients`（通过 settings 聚合）
- **THEN** 如果有 environmentId，请求 `remoteControl/client/list`，返回客户端列表

### Requirement: Remote control client revoke
系统 SHALL 支持撤销指定远程控制客户端的访问权限。

#### Scenario: Revoke client
- **WHEN** 已认证用户 POST `/api/codex/remote-control/clients/{clientId}/revoke` 并提供 environmentId
- **THEN** 调用 `gateway.revokeRemoteControlClient(environmentId, clientId)`

### Requirement: Remote control event notifications
远程控制状态变更 SHALL 通过 `remoteControl/status/changed` 通知推送到浏览器，触发 settings 刷新。

#### Scenario: Status changed notification
- **WHEN** app-server 发送 `remoteControl/status/changed` 通知
- **THEN** `normalizeAppServerNotification` 将其转换为 `{kind: "settings_invalidated"}` 事件推送到浏览器 WebSocket

**Open Questions**

1. **远程控制启用无二次验证**：`remoteControl/enable` 直接启用，无需额外密码或确认。任何通过 cookie 认证的请求都可以启用。是否需要二次验证（如输入密码或确认码）？
2. **配对码明文传输**：pairing code 通过 HTTP 响应返回，底层依赖 TLS 保护。如果部署在无 TLS 的环境，配对码可被截获。是否需要端到端加密？
3. **客户端撤销仅凭 clientId**：撤销客户端只需要 clientId 和 environmentId，无额外验证。是否足够？
4. **远程控制通知转换为 settings_invalidated**：`remoteControl/status/changed` 被统一转为 `settings_invalidated`，丢失了具体的状态变更信息（如从 connected 变为 disabled）。前端只能重新拉取全部 settings，无法做差异化更新。
