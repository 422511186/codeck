## ADDED Requirements

### Requirement: Unmaterialized empty thread has a successful timeline page
thread timeline page 适配层 SHALL 将 app-server 明确报告的“未 materialized、未加载或首条用户消息前不可分页”归一化为成功空页。该空页 MUST 保持标准分页形状和有界语义。

#### Scenario: Legacy turns page is unavailable before first message
- **WHEN** `thread/turns/list` 对刚创建的空 thread 返回首条消息前不可用错误
- **THEN** Web timeline page MUST 返回 `items: []` 和 `nextCursor: null`
- **AND** HTTP route MUST NOT 返回 502

#### Scenario: Empty-page normalization is narrow
- **WHEN** app-server 返回不属于未 materialized 空 thread 的错误
- **THEN** 适配层 MUST 继续传播该错误
- **AND** MUST NOT 返回伪造的空页
