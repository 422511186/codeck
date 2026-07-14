## ADDED Requirements

### Requirement: Completion repair tolerates persistence lag
turn completion repair SHALL 区分“请求成功”和“目标输出已 materialize”。只有目标 turn 已出现非 user 可见输出时才能视为恢复完成；否则 MUST 在固定上限内延迟重试。

#### Scenario: First repair is incomplete
- **WHEN** completion repair 成功返回但目标 turn 没有 assistant、reasoning、tool、diff、system 或 error 输出
- **THEN** repair MUST 保持 pending 并延迟重试
- **AND** MUST NOT 全量读取历史

#### Scenario: Retry limit reached
- **WHEN** 固定次数 repair 后目标输出仍未出现
- **THEN** 客户端 MUST 停止自动请求
- **AND** 页面 MUST 保留已有消息与正常手动刷新能力
