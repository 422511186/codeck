## ADDED Requirements

### Requirement: Incomplete permission state is pending, not failed

当权限三元组包含未返回的字段时，前端 MUST 显示低干扰的“权限状态待确认”状态，不得将其解释为权限失败，也不得阻止用户发送消息。

#### Scenario: Partial permission payload arrives
- **WHEN** `permissions`、`approvalPolicy`、`reviewer` 任一字段为 `undefined`
- **THEN** composer 显示待确认状态，保留发送能力，并说明正在等待完整后端状态

#### Scenario: Complete local selection wins
- **WHEN** 本地缓存包含完整三元组，即使 detail 暂时不完整
- **THEN** 页面立即显示本地选择对应的真实权限模式，而不是待确认

#### Scenario: Complete backend payload restores mode
- **WHEN** websocket 或 detail 返回完整三元组（允许显式 `null`）
- **THEN** 页面切换到对应的真实权限模式并移除待确认文案
