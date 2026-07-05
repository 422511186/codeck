## ADDED Requirements

### Requirement: Project cwd validation uses backend allowlist
项目添加流程依赖的 `GET /api/codex/threads?cwd=...` SHALL 在读取或过滤 threads 前校验 `cwd`。workspace 外路径 MUST 被拒绝，不能作为合法项目路径加入 localStorage。

#### Scenario: Add project with outside cwd
- **WHEN** 用户在新增项目弹窗提交 workspace allowlist 外路径
- **THEN** 后端 validation route MUST 返回错误
- **AND** 前端 MUST NOT 把该路径加入项目列表

#### Scenario: Threads cwd filter uses normalized allowed path
- **WHEN** 已认证用户 GET `/api/codex/threads?cwd=<allowed path>`
- **THEN** route MUST 使用标准化后的 allowlist 内路径调用 app-server
