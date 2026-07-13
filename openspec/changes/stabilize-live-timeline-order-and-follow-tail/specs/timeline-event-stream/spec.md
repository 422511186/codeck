## ADDED Requirements

### Requirement: File change item identity remains stable across sources
timeline engine SHALL 将同一 generation、turnId 和 itemId 的 file change live delta、completed item、snapshot item 与 repair item 归一化为同一 timeline entry。实时阶段的占位 `tool`、完成阶段的真实路径、status 和 diff 统计变化 MUST NOT 创建第二条 Files changed activity。

#### Scenario: Live file delta followed by completed snapshot
- **WHEN** 客户端先收到带稳定 itemId 的 `file_output_delta`
- **AND** 后续 snapshot 或 completed item 使用同一 generation、turnId 和 itemId，但 `tool` 从占位值变为真实文件路径
- **THEN** timeline MUST 原位合并为一条 file change entry
- **AND** Files changed MUST 保持在原事件位置
- **AND** timeline MUST NOT 在末尾追加重复 Files changed

#### Scenario: Different file item ids remain distinct
- **WHEN** 同一 turn 包含两个不同 itemId 的 file change items
- **THEN** timeline MUST 保留两条独立 file change entries
- **AND** 每条 entry MUST 使用各自完成态路径和 diff 统计

### Requirement: Cross-source repair preserves anchored event position
snapshot merge 和 bounded repair SHALL 使用稳定 identity 以及 `beforeEntryId`、`afterEntryId` 或等价 anchor 恢复条目位置。不同来源的局部 ordinal MUST NOT 因数值比较而覆盖原事件顺序。

#### Scenario: Repair fills file change between agent messages
- **WHEN** 当前 timeline 已包含同一 turn 的前后 agent messages
- **AND** bounded repair 返回位于两者之间的 file change item
- **THEN** repair 后 Files changed MUST 渲染在两个 agent messages 之间
- **AND** error 或 completion 事件 MUST NOT 将该 file change 移到 timeline 末尾
