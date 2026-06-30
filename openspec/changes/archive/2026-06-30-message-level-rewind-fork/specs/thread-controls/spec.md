## MODIFIED Requirements

### Requirement: `⋮` 底部抽屉菜单
点击 `⋮` SHALL 弹出底部抽屉，包含以下会话级操作：重命名、归档、压缩上下文。

#### Scenario: 弹出抽屉
- **WHEN** 用户点击会话头部 `⋮`
- **THEN** 系统 MUST 弹出底部抽屉
- **AND** 抽屉 MUST 包含「重命名、归档、压缩上下文」三项
- **AND** MUST 不包含「Fork」
- **AND** MUST 不包含「删除」

## REMOVED Requirements

### Requirement: Fork 即建即跳
**Reason**: 会话级 Fork 总是从当前最新状态分支，无法表达从某条历史用户消息创建分支，和消息级时间线操作模型冲突。

**Migration**: 使用 `timeline-message-actions` 中的「从这里 Fork」。用户必须从具体 user message 的长按菜单触发 Fork。
