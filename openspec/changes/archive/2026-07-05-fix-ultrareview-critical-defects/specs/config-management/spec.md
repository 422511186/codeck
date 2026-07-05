## ADDED Requirements

### Requirement: Config value read route is implemented
系统 SHALL 支持已认证用户通过 `GET /api/codex/config/value` 读取当前配置对象。该 route MUST 调用 app-server `config/read` 对应 gateway 方法。

#### Scenario: Read config value route
- **WHEN** 已认证用户 GET `/api/codex/config/value`
- **THEN** 系统 MUST 返回当前配置对象
- **AND** 未认证用户 MUST 返回 401
