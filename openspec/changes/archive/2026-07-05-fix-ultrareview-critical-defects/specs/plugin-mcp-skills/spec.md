## ADDED Requirements

### Requirement: Skills config write validates boolean semantics
`/api/codex/skills/config` SHALL 要求 `enabled` 为真实 boolean。缺失、字符串或其他类型 MUST 被拒绝，不能通过 `Boolean(value)` 改变语义。

#### Scenario: String false is rejected
- **WHEN** 已认证用户 POST `/api/codex/skills/config` 且 `enabled` 为字符串 `"false"`
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server

#### Scenario: Boolean false is preserved
- **WHEN** 已认证用户 POST `/api/codex/skills/config` 且 `enabled` 为 boolean `false`
- **THEN** route MUST 调用 app-server 并保留 `enabled: false`
