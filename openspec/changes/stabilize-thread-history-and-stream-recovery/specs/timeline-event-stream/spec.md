## ADDED Requirements

### Requirement: Timeline timestamps remain consistent across sources
snapshot、pagination 和 live timeline 输入 SHALL 使用相同的毫秒时间约定。缺少 item 时间时，系统 MUST 使用稳定 turn 时间或明确的历史 fallback，不得使用接收事件的当前时间覆盖历史语义。

#### Scenario: Same turn arrives from pagination and live sources
- **WHEN** 同一 turn 的条目分别来自 pagination 与 live event
- **THEN** 两种来源的时间 MUST 使用同一单位
- **AND** snapshot merge MUST NOT 将历史条目时间重置为当前时间

#### Scenario: Turn id is not a UUIDv7 identifier
- **WHEN** 历史 item 没有时间且 turnId 不能解析为 UUIDv7
- **THEN** adapter SHALL 使用经过单位规范化的调用方 fallback
- **AND** 系统 MUST 保持条目顺序稳定
