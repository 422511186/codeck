## MODIFIED Requirements

### Requirement: Skills management
系统 SHALL 支持列出技能、写入技能配置和设置额外根路径。返回给移动端的 `MobileSkillView` MUST 包含 `cwd`、`name`、`path`、`description`、`shortDescription`、`scope` 和 `enabled`，其中 `path` 用于构造 app-server `UserInput.skill`。Skills 加载、启用状态或 roots 变化通知 SHALL 使移动端 Skills picker 缓存失效，并在具备可靠 thread/turn 归属时作为 timeline 轻量活动展示。

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
- **AND** 移动端 MUST 使 Skills picker 缓存失效

#### Scenario: Set skills extra roots
- **WHEN** 已认证用户 POST `/api/codex/skills/extra-roots` 并提供 `extraRoots`
- **THEN** 调用 `gateway.setSkillsExtraRoots(extraRoots)`
- **AND** 移动端 MUST 使 Skills picker 缓存失效

#### Scenario: Skills changed notification refreshes picker cache
- **WHEN** app-server 通知 Skills 已加载、变更、启用状态变化或 roots 变化
- **THEN** 移动端 MUST 使已缓存的 chat picker Skills 列表失效
- **AND** 下一次打开 picker 或强制刷新时 MUST 重新请求 `/api/codex/skills`

#### Scenario: Runtime loaded Skills are distinct from selected Skill references
- **WHEN** 用户消息中包含用户主动选择的 Skill 引用
- **AND** 同一 turn 中 runtime 又发送 Skills 加载活动
- **THEN** 用户消息 MUST 继续以 chips 展示主动选择的 Skill 引用
- **AND** runtime 加载活动 MUST 作为 timeline activity 展示
- **AND** 两者 MUST NOT 互相覆盖或重复去重

### Requirement: Chat Skill 引用在 timeline 中保持可回放
通过聊天输入区选择的 Skill 引用 SHALL 作为结构化输入发送，并在后续 timeline 展示、历史分页、刷新修复中保持可识别。系统 SHALL 使用 Skill `name` 作为主要展示文案，使用 `path` 作为稳定标识和发送协议字段。发送失败后的重试 SHALL 保留原用户消息中的 Skill 引用。

#### Scenario: 发送结构化 Skill 引用
- **WHEN** 用户通过聊天输入区选择 Skill 后发送消息
- **THEN** start turn 请求 MUST 包含对应 Skill 的 `name` 和 `path`
- **AND** 用户消息 timeline item MUST 保留该 Skill 引用

#### Scenario: 历史消息恢复 Skill 引用
- **WHEN** 页面从服务端历史或 snapshot 中读取包含 `type: "skill"` 的用户消息内容
- **THEN** 系统 MUST 将其转换为结构化 Skill 引用
- **AND** MUST 不把该内容转换成 `[skill]` 文本

#### Scenario: 多个 Skill 引用
- **WHEN** 一条用户消息包含多个 Skill 引用
- **THEN** timeline MUST 展示每个 Skill 的名称
- **AND** 每个 Skill MUST 使用其 `name/path` 组合保持稳定去重和渲染 key

#### Scenario: 失败消息重试保留 Skill 引用
- **WHEN** 包含 Skill 引用的用户消息发送失败
- **AND** 用户从失败消息触发重试
- **THEN** 重试请求 MUST 继续携带原消息的 Skill 引用
- **AND** timeline 中的新用户消息 MUST 继续展示这些 Skill chips
