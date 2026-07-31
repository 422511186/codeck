## MODIFIED Requirements

### Requirement: File change item identity remains stable across sources
timeline engine SHALL 将同一 generation、turnId 和 itemId 的 file change live delta、completed item、snapshot item 与 repair item 归一化为同一 timeline entry。实时阶段的占位 `tool`、完成阶段的真实路径、status 和 diff 统计变化 MUST NOT 创建第二条 Files changed activity。没有 itemId 的 `turn_diff_updated` 只能作为同 turn 尚无 item-scoped file activity 时的 provisional fallback，并 MUST 在 canonical item 出现后退出可见 timeline。

#### Scenario: Live file delta followed by completed snapshot
- **WHEN** 客户端先收到带稳定 itemId 的 `file_output_delta`
- **AND** 后续 snapshot 或 completed item 使用同一 generation、turnId 和 itemId，但 `tool` 从占位值变为真实文件路径
- **THEN** timeline MUST 原位合并为一条 file change entry
- **AND** Files changed MUST 保持在原事件位置
- **AND** timeline MUST NOT 在末尾追加重复 Files changed

#### Scenario: Turn diff precedes canonical file item
- **WHEN** 客户端先收到没有 itemId 的 `turn_diff_updated`
- **AND** 随后同一 generation 和 turn 收到一个或多个 item-scoped file activities
- **THEN** engine MUST 移除或抑制 provisional turn diff entry
- **AND** MUST 只保留带稳定 itemId 的 canonical file entries

#### Scenario: Canonical file item precedes turn diff
- **WHEN** 同一 generation 和 turn 已包含 item-scoped file activity
- **AND** 随后收到 `turn_diff_updated`
- **THEN** engine MUST NOT 添加新的 turn-level diff entry
- **AND** MUST NOT 改变已有 canonical file entries 的 identity 或顺序

#### Scenario: Different file item ids remain distinct
- **WHEN** 同一 turn 包含两个不同 itemId 的 file change items
- **THEN** timeline MUST 保留两条独立 file change entries
- **AND** 每条 entry MUST 使用各自完成态路径和 diff 统计
- **AND** turn-level fallback 的退场 MUST NOT 合并这两个 itemId

### Requirement: Overlay and supplement reconciliation is identity and anchor scoped
runtime overlay、bounded item page 与 rollout supplement SHALL 通过完整 HistoryStamp、turnId、稳定 item identity、显式 alias/source slot 和位置 anchor 进行一对一归一化。系统 MUST NOT 仅凭 `turnId`、tool kind、server、tool、command metadata 或“最后一条 assistant 即最终回复”的假设移动或消费候选。强 identity 命中已有 canonical item 且存在唯一 message-anchor interval 时，reconciler MUST 在该 anchor 位置输出 canonical item，并跳过其错误的 base 原位置；缺少唯一匹配证据时 MUST 保留不同候选及来源顺序，或返回 scoped repair-required。

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

#### Scenario: Misplaced canonical commands move to supplemented anchors
- **WHEN** canonical page 的同一 turn 顺序为 assistant A、assistant B、command A、command B
- **AND** rollout supplement 以稳定 item identity 和唯一 message anchors 证明真实顺序为 command A、assistant A、command B、assistant B
- **THEN** reconciler MUST 输出 command A、assistant A、command B、assistant B
- **AND** command A 与 command B MUST 使用 canonical page 的 body、status 和 metadata
- **AND** 两个 command 的 base 末尾位置 MUST 被跳过，不能再次输出

#### Scenario: Ambiguous metadata match does not delete an execution
- **WHEN** partial page 与 whole-turn supplement 包含多个 metadata 相同且没有唯一 alias 的 command candidates
- **THEN** reconciler MUST NOT 按候选遍历顺序任意消费或移动其中一项
- **AND** 系统 MUST 保留独立 entries 或标记 scoped repair-required，以便后续权威来源消歧
