## MODIFIED Requirements

### Requirement: 头部右侧 ⋮ 菜单使用底部抽屉
⋮ 次级菜单 SHALL 以底部抽屉形式弹出，包含重命名、归档、压缩上下文三项。Fork SHALL 不在会话头部抽屉中出现。

#### Scenario: 打开菜单
- **WHEN** 用户点击 ⋮
- **THEN** 系统 MUST 从底部弹出抽屉
- **AND** 抽屉 MUST 包含「重命名」「归档」「压缩上下文」三项
- **AND** 抽屉 MUST 不包含「Fork」

#### Scenario: 不显示删除
- **WHEN** ⋮ 菜单展开
- **THEN** 抽屉 MUST 不包含「删除会话」入口

## REMOVED Requirements

### Requirement: Fork 点即创建并跳转
**Reason**: Fork 不再是会话级最新状态操作，而是基于用户长按的具体历史 user message 创建分支。

**Migration**: 使用 `timeline-message-actions` 中的「从这里 Fork」，从 user message 长按菜单触发。
