# timeline-event-stream Delta

## Modified Requirements

### Requirement: Server timeline read supports pagination

服务端 timeline 读取接口（`readThreadMetadata` 及对应 GET route）SHALL 支持可选 `cursor` 与 `limit` 参数实现分页返回。无参数时 MUST 保持现有全量返回行为以保证向后兼容。有 `cursor` 时 MUST 从 cursor 之后读取，并返回 `nextCursor`（null 表示无更多）。

#### Scenario: Full read without cursor stays backward compatible

- **WHEN** 客户端调用 timeline 读取接口且不提供 cursor/limit
- **THEN** 服务端 MUST 返回完整 timeline
- **AND** 响应 MUST 不包含 nextCursor（或 nextCursor 为 null）

#### Scenario: Paginated read returns nextCursor

- **WHEN** 客户端提供 cursor 与 limit
- **THEN** 服务端 MUST 从 cursor 之后读取最多 limit 条
- **AND** 响应 MUST 携带 nextCursor（若有更多）或 null（若无更多）
- **AND** repair 流程 MUST 能通过多次分页拉取或 fallback 全量获取完整 timeline

### Requirement: timelineThreadWithinBudget uses incremental byte accumulation

`timelineThreadWithinBudget` MUST 使用单趟增量字节累加（逐条 stringify 累加字节数，超 budget 停止），MUST NOT 全量重建 timeline + 全量 stringify 最多 10 次。

#### Scenario: Large timeline is budgeted in single pass

- **WHEN** timeline 含 500 条 item 且总字节超过 budget
- **THEN** timelineThreadWithinBudget MUST 单趟遍历累加字节
- **AND** 超过 budget 时 MUST 停止并返回截断后的 detail
- **AND** MUST NOT 对全量 timeline 反复 map + stringify

### Requirement: Derivation chain supports tail-append incremental fast path

`timelineEntriesForPresentation`、`deriveTimelineRenderBlocks`、`createTimelineLayoutIndex` SHALL 支持"尾部 append"快速路径：当新 entries 是旧 entries 的尾部追加（前 N 项引用相等）时，MUST 复用上次结果仅对尾部追加项做增量计算。引用相等失败时 MUST fallback 到全量重算。

#### Scenario: Streaming token appends tail entry reuses prefix

- **WHEN** 流式期间新 entries 仅在旧 entries 尾部追加 1 条
- **THEN** 派生函数 MUST 复用上次结果
- **AND** MUST 仅对新尾部追加项做增量扫描/dedupe/offset 累加
- **AND** MUST NOT 对前 N-1 项做全量重算

#### Scenario: Non-tail update falls back to full recompute

- **WHEN** 新 entries 不是旧 entries 的尾部追加（如 repair 替换了中部 entry）
- **THEN** 派生函数 MUST fallback 到全量重算
- **AND** 不得因快速路径假设失效而产生错误结果

### Requirement: ResizeObserver is singleton not per-render resubscribe

`Timeline.tsx` 的 `ResizeObserver` MUST 单例化（observer 只创建一次），所有 row 通过 register/unregister 管理。MUST NOT 依赖 `allBlocks`/`layoutIndex`/`visibleBlocks` 全量重订阅。

#### Scenario: Streaming token does not trigger observer resubscribe

- **WHEN** 流式期间 entries 每 token 变化导致 allBlocks/layoutIndex 更新
- **THEN** ResizeObserver MUST NOT disconnect 并重新 observe 所有 row
- **AND** MUST NOT 触发 querySelectorAll O(n) DOM 扫描
- **AND** 已注册的 row MUST 保持 observe 状态

### Requirement: deliveryEpoch is always transmitted

注：此条与 fix-timeline-ordering-stream-defects 决策 10 一致，本变更不重复实现，仅声明依赖。实际实现归入 ordering-stream 变更。
