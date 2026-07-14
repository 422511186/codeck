## ADDED Requirements

### Requirement: Latest legacy page fills across turns
legacy app-server 不支持 thread-wide items 接口时，服务端 SHALL 跨多个 turn 聚合最新 items，直到达到受控 page limit、字节预算或历史起点，MUST NOT 因最新 turn 只有一条消息而只返回一条可见内容。

#### Scenario: Latest turn contains one user item
- **WHEN** 最新 turn 只有一条 user item 且更早 turn 仍有内容
- **THEN** 首屏 MUST 同时包含该 user item 和更早 turn 的最近内容
- **AND** next cursor MUST 指向尚未返回的更早 item

#### Scenario: One turn exceeds page limit
- **WHEN** 单个 turn 的 items 超过 page limit
- **THEN** 服务端 MUST 只返回该 turn 最新的 limit 条 items
- **AND** 后续 cursor MUST 在同一 turn 内继续向前

### Requirement: Completed reply appears without refresh
用户发送消息后，最终 assistant/tool 输出 SHALL 通过 live event 或有界 repair 自动出现在当前页面，MUST NOT 要求用户刷新。

#### Scenario: Persistence lags turn completion
- **WHEN** turn 完成后的第一次 latest-page repair 只包含 user item
- **THEN** 客户端 MUST 延迟重试有界 latest-page repair
- **AND** assistant item 持久化后 MUST 自动合并到当前 timeline
