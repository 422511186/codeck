## ADDED Requirements

### Requirement: Overlay and supplement reconciliation is identity and anchor scoped
runtime overlay、bounded item page 与 rollout supplement SHALL 通过完整 HistoryStamp、turnId、稳定 item identity、显式 alias/source slot 和位置 anchor 进行一对一归一化。系统 MUST NOT 仅凭 `turnId`、tool kind、server、tool、command metadata 或“最后一条 assistant 即最终回复”的假设移动或消费候选；缺少唯一匹配证据时 MUST 保留不同候选及来源顺序，或返回 scoped repair-required，而不是静默丢弃或重排条目。

#### Scenario: Later overlay command stays after intermediate assistant text
- **WHEN** 权威 page 已包含 command A 和其后的 assistant message
- **AND** 同一 turn 的较新 runtime overlay 包含 command B
- **AND** 没有 anchor 或强 identity 证明 command B 位于该 assistant message 之前
- **THEN** 合并结果 MUST 保持 command A、assistant message、command B
- **AND** overlay repair MUST NOT 把 command B 插入 command A 与 assistant message 之间

#### Scenario: Partial page consumes only the matching supplemented command
- **WHEN** 完整 rollout supplement 的顺序为 command A、assistant message、command B
- **AND** bounded latest page 只覆盖 assistant message 与 command B
- **AND** command A 与 command B 的 tool metadata 相同但稳定 identity 不同
- **THEN** canonical command B MUST 只与 supplement 中的 command B 合并
- **AND** command A MUST 保留在 assistant message 之前，command B MUST 只出现一次且位于 assistant message 之后

#### Scenario: Ambiguous metadata match does not delete an execution
- **WHEN** partial page 与 whole-turn supplement 包含多个 metadata 相同且没有唯一 alias 的 command candidates
- **THEN** reconciler MUST NOT 按候选遍历顺序任意消费其中一项
- **AND** 系统 MUST 保留独立 entries 或标记 scoped repair-required，以便后续权威来源消歧
