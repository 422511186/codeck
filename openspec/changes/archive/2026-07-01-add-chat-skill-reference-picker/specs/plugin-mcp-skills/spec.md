## MODIFIED Requirements

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
