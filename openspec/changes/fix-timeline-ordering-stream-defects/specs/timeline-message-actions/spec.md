# timeline-message-actions Delta

## Modified Requirements

### Requirement: Cross-sourceKind ordering uses unified ordinal

`orderEntries` 在同一 turnId 内排序时，当 leftOrder 与 rightOrder 都存在且 ordinal 不同时，MUST 直接比较 ordinal，MUST NOT 因 `sourceKind` 不一致而回退到插入序。pagination 的 ordinal 按其页内 ordinal + 偏移参与比较。

#### Scenario: Live delta is ordered by ordinal not insertion index

- **WHEN** 同一 turnId 内既有 snapshot 来源的 entries 又有 live 来源的 delta
- **AND** live delta 的 ordinal 应排在 turn 中部
- **THEN** orderEntries MUST 按 ordinal 将 live delta 排到正确位置
- **AND** MUST NOT 因 sourceKind 不一致把 live delta（追加在数组末尾）排到 turn 末尾

#### Scenario: Pagination entries participate in ordinal comparison

- **WHEN** 分页 prepend 的 entries 与现有 entries 属同一 turnId
- **THEN** orderEntries MUST 按 pagination 的 ordinal + 偏移参与比较
- **AND** MUST NOT 因 sourceKind === "pagination" 排除 ordinal 比较

### Requirement: Non-contiguous turnId does not duplicate or drop supplement records

`mergeSessionTimelineRecords` 处理 baseItems 时，当同一 turnId 出现在非连续的多段时，MUST 把所有同 turn 的 baseItems 合并到一个 chunk 再调用 `mergeTurnSessionRecords`，MUST NOT 形成多个 chunk 导致 supplement 工具记录重复插入。

#### Scenario: Non-contiguous turnId does not duplicate supplement tools

- **WHEN** baseItems 中 turnId=A 出现在 [A, B, A] 非连续两段
- **AND** turnA 的 supplement records 含 1 个工具调用
- **THEN** mergeSessionTimelineRecords MUST 把两段 A 合并到一个 chunk
- **AND** supplement 工具记录 MUST 只插入一次
- **AND** MUST NOT 因两个 chunk 各自插入导致工具调用出现两次

### Requirement: Base without turnId still inserts supplement records

`mergeSessionTimelineRecords` 当 base 全无 turnId 时，MUST 在循环结束后对未消费的 supplement records 提供 fallback 插入，MUST NOT 静默丢弃全部 supplement records。

#### Scenario: All-base-no-turnId inserts supplement via fallback

- **WHEN** baseItems 全部没有 turnId
- **AND** records 含工具/skill 引用补充
- **THEN** 循环结束后系统 MUST 通过 fallbackToolInsertIndex 兜底插入 supplement records
- **AND** MUST NOT 只透传 push base 而忽略 supplement records

### Requirement: Snapshot-window preserves higher-generation live entries

`mergeSnapshotEntriesWithExistingContent` 合并快照与现有 entries 时，MUST 保留 currentEntries 中 generation > snapshotGeneration 的 live entry，MUST NOT 用 `snapshotEntries.map` 丢弃所有不在快照中的现有 entry。

#### Scenario: Live reply is not erased by stale snapshot

- **WHEN** currentEntries 含刚流式出来的 agent-message（generation=2）
- **AND** 随后到达一个较旧或不完整的 snapshot-window（generation=1，未覆盖该 agent-message）
- **THEN** 合并后 MUST 保留 generation=2 的 live agent-message
- **AND** MUST NOT 用 snapshotEntries.map 丢弃该 entry
- **AND** 后续 repair MUST 能收敛到单一权威版本

#### Scenario: Same-generation snapshot replaces entries per existing semantics

- **WHEN** snapshot 的 generation 等于或高于 currentEntries
- **THEN** 合并行为 MUST 与现有 snapshot-window 语义保持一致
- **AND** 不得因保留逻辑引入双份 entry
