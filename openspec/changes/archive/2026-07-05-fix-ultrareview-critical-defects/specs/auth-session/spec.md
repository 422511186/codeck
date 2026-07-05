## ADDED Requirements

### Requirement: Login return target is same-origin path
登录页 SHALL 只接受站内绝对路径作为登录成功后的返回目标。系统 MUST 支持规格中的 `return` 参数，并可兼容历史 `next` 参数；任何外部 URL、scheme URL、protocol-relative URL 或非法路径都 MUST 回退到项目页。

#### Scenario: External next is rejected
- **WHEN** 用户访问 `/login?next=https://example.com`
- **THEN** 登录成功后系统 MUST 跳转到项目页
- **AND** MUST NOT 跳转到外部站点

#### Scenario: Return path is honored
- **WHEN** 用户访问 `/login?return=/threads/abc`
- **THEN** 登录成功后系统 MUST 跳转到 `/threads/abc`
