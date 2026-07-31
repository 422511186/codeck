## ADDED Requirements

### Requirement: Historical user metadata survives pagination and refresh

历史 turns 分页和 thread 刷新 SHALL 保持用户消息已经公开或可安全恢复的 Skill、图片和普通文件 metadata。分页 item 缺少 `turnId` 时，系统 MUST 在当前页面用户正文存在唯一匹配的情况下恢复对应 Skill；已有结构化 `skillReferences` MUST 优先于 rollout 回退结果。无法唯一匹配时 MUST 保持未绑定，且 MUST NOT 把 Skill 绑定到重复正文的任意一条消息。

#### Scenario: Historical page recovers Skill without turn ID

- **WHEN** turns 分页返回一条缺少 `turnId` 的用户消息
- **AND** rollout supplement 包含与该消息正文唯一匹配的隐藏 Skill 输入
- **THEN** 分页 item MUST 包含对应的 `skillReferences`
- **AND** Skill 隐藏正文 MUST NOT 出现在 timeline 正文中

#### Scenario: Duplicate user text fails closed

- **WHEN** 当前分页中有两条正文相同的用户消息
- **AND** rollout supplement 只有一个与该正文匹配的 Skill 引用
- **THEN** 系统 MUST 不把该 Skill 绑定到任意一条用户消息

#### Scenario: Structured Skill metadata stays authoritative

- **WHEN** 用户消息已经携带结构化 `skillReferences`
- **AND** rollout supplement 同时发现一个或多个 Skill 引用
- **THEN** 系统 MUST 保留结构化 `skillReferences`
- **AND** MUST NOT 用 rollout 回退结果覆盖或替换已有结构化引用

#### Scenario: Refresh preserves detail metadata over sparse page items

- **WHEN** 刷新得到的详情 item 含有 Skill、图片或普通文件 metadata
- **AND** 同一消息的 initial page item 缺少部分或全部这些 metadata
- **THEN** 刷新后的 timeline MUST 保留详情中的缺失 metadata
- **AND** MUST 保留 page item 的消息 identity、正文和显示顺序

#### Scenario: Ambiguous refresh candidates are not merged

- **WHEN** page item 只能通过重复的正文匹配到多个详情 item
- **THEN** 刷新合并 MUST 不猜测候选
- **AND** MUST 保留 page item 当前 metadata，不错误附加详情 metadata
