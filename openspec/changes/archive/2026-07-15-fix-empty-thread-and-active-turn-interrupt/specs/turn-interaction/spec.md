## ADDED Requirements

### Requirement: Interrupt resolves a known active turn without message reads
中断 route SHALL 优先使用请求中的显式 turnId；缺失时 SHALL 使用 gateway 已知 active turn identity。系统 MUST NOT 为解析中断目标读取完整 timeline、完整 rollout 或猜测历史 turn。

#### Scenario: Interrupt omits turnId after turn start
- **WHEN** gateway 已从 `turn/start` 或 `turn_started` 记录当前 active turnId
- **AND** 中断请求未显式提供 turnId
- **THEN** route MUST 中断该已知 active turn
- **AND** MUST 返回成功响应

#### Scenario: Active turn identity is unavailable
- **WHEN** 中断请求未提供 turnId 且 gateway 没有已知 active turn identity
- **THEN** route MUST 返回稳定 409
- **AND** MUST NOT 读取消息 timeline 解析目标
