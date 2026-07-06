## ADDED Requirements

### Requirement: Login navigation refreshes session state
登录页在确认用户已认证后跳转到返回目标时 SHALL 使用同源文档级 replace 导航，使新写入或已存在的 `codex_web_session` cookie 能被目标页面立即使用。该行为 MUST 同时适用于提交 Token 登录成功和访问登录页时发现已有有效 session 的自动跳转。

#### Scenario: Successful login refreshes target route state
- **WHEN** 用户在登录页提交正确 Token 且 `/api/auth/login` 成功写入 session cookie
- **THEN** 客户端 SHALL 跳转到安全返回目标
- **AND** 客户端 MUST 使用文档级 replace 导航，目标页面无需手动刷新即可读取最新认证状态

#### Scenario: Already authenticated login page visit refreshes target route state
- **WHEN** 用户访问登录页且 `/api/auth/session` 返回已认证
- **THEN** 客户端 SHALL 跳转到安全返回目标
- **AND** 客户端 MUST 使用文档级 replace 导航，避免继续使用登录前缓存状态
