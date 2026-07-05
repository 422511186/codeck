## ADDED Requirements

### Requirement: Thread turns pages are exposed in chronological order
移动端 Web 适配层 SHALL 保证返回给前端 store 的 thread timeline items 按会话时间正序排列，即使 app-server 底层分页使用 `sortDirection: "desc"` 读取最新 turns。

#### Scenario: Resume with initial turns page
- **WHEN** `thread/resume` 返回 `initialTurnsPage` 且该页为 desc 顺序
- **THEN** Web 适配层 MUST 在构造 `MobileThreadDetail.timeline` 和 `lastTurnId` 前把 turns 转为会话正序

#### Scenario: Load older turns page
- **WHEN** 前端调用历史 turns 分页加载更早消息
- **THEN** Web 适配层 MUST 返回页内正序 timeline items
- **AND** 前端 prepend 后整体 timeline 顺序 MUST 保持稳定
