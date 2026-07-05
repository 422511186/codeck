## ADDED Requirements

### Requirement: Proxy path inputs are validated before app-server calls
Web 代理层 SHALL 在调用 app-server 前校验所有代表本机路径或工作目录的浏览器输入。除已有 Open Questions 明确暂不覆盖的入口外，路径 MUST 在 `CODEX_WEB_WORKSPACE_ROOTS` 或该入口明确允许的额外根目录内。

#### Scenario: Terminal exec requires allowed cwd
- **WHEN** 已认证用户 POST `/api/codex/terminal/exec` 且 `cwd` 缺失、为空或不在 allowlist 内
- **THEN** 系统 MUST 拒绝请求，不得调用 app-server `command/exec`

#### Scenario: Feedback extra log files are constrained
- **WHEN** 已认证用户 POST `/api/codex/feedback/upload` 且 `extraLogFiles` 包含 workspace/upload allowlist 外路径
- **THEN** 系统 MUST 拒绝该路径，不得把任意本机路径透传给 app-server

#### Scenario: External agent config cwd is constrained
- **WHEN** external agent config detect/import 请求包含 repo-scoped `cwd`
- **THEN** 每个 `cwd` MUST 通过 workspace allowlist 校验后才可发送给 app-server

#### Scenario: Windows sandbox setup cwd is constrained
- **WHEN** Windows Sandbox setup 请求提供 `cwd`
- **THEN** 该 `cwd` MUST 通过 workspace allowlist 校验后才可发送给 app-server

### Requirement: Malformed JSON request bodies return client errors
Web 代理层 SHALL 将 JSON 解析失败、字段类型错误和必填字段缺失视为客户端请求错误。此类错误 MUST 返回 400，而不是伪装为 app-server 代理失败。

#### Scenario: Invalid JSON body
- **WHEN** 已认证用户向使用 JSON body 的 `/api/codex/*` route 发送 malformed JSON
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server
