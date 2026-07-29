# timeline-message-actions Delta

## Modified Requirements

### Requirement: Store threads use LRU eviction

前端 store 的 `threads` 集合 SHALL 使用 LRU（最近最少使用）淘汰策略，超过阈值（默认 5 个）时 MUST 淘汰最久未访问 thread 的 entries 与 entryIndexes，保留元数据（threadId、title 等）。切换回已淘汰 thread 时 MUST 重新 fetch。

#### Scenario: Exceeding threshold evicts least recently used thread

- **WHEN** 用户依次打开 6 个 thread，LRU 阈值为 5
- **THEN** store MUST 淘汰第 1 个打开的 thread 的 entries 与 entryIndexes
- **AND** MUST 保留该 thread 的元数据（threadId、title）
- **AND** 用户切回第 1 个 thread 时 MUST 重新 fetch timeline

#### Scenario: Active thread is never evicted

- **WHEN** 当前活跃 thread 是最久未访问的
- **THEN** store MUST NOT 淘汰当前活跃 thread
- **AND** MUST 淘汰次久未访问的 thread

### Requirement: replaceOrAddEntry updates indexes incrementally

`replaceOrAddEntry` MUST 增量更新 byId/byTurnId 索引（O(1) per entry），MUST NOT 调用 `buildTimelineEntryIndexes` 全量重建索引（O(n)）。

#### Scenario: Streaming token updates single entry index in O(1)

- **WHEN** 流式期间收到一条 item.appended 或 item.updated
- **THEN** replaceOrAddEntry MUST 仅更新该 entry 的 byId 与 byTurnId
- **AND** MUST NOT 重建整个索引
- **AND** 500 条 item 的 turn 完成时索引更新总复杂度 MUST 为 O(n) 而非 O(n²)

### Requirement: Initial timeline mount is bounded

`MAX_INITIAL_TIMELINE_ROWS` MUST 限制首屏挂载行数（建议 15-20，移动端约 2 屏），MUST NOT 一次性挂载 80 行。

#### Scenario: First paint mounts at most 20 rows

- **WHEN** 用户打开一个含 100 条 item 的 thread
- **THEN** 首屏 MUST 最多挂载 20 个 TimelineRow
- **AND** 其余行 MUST 通过虚拟化在滚动时按需挂载

### Requirement: LazyAgentMarkdown renders long text via incremental parsing

`LazyAgentMarkdown` MUST NOT 对长文本（超过 LAZY_MARKDOWN_TEXT_LIMIT）永不渲染 markdown。长文本 MUST 先以纯文本显示，滚动接近时通过 idle callback 分块或全量解析 markdown。多个 `LazyAgentMarkdown` 实例 MUST 共享一个全局 IntersectionObserver。

#### Scenario: Long agent message renders markdown when scrolled near

- **WHEN** 某 agent 消息文本长度超过 LAZY_MARKDOWN_TEXT_LIMIT
- **AND** 该消息不在最后 2 行（非 eager）
- **THEN** 初始 MUST 以纯文本显示
- **AND** 当滚动接近该消息时 MUST 通过 idle callback 解析 markdown
- **AND** MUST NOT 永远保持纯文本

#### Scenario: LazyAgentMarkdown shares global IntersectionObserver

- **WHEN** 视口内有 30 个 LazyAgentMarkdown 实例
- **THEN** 系统 MUST 只创建一个 IntersectionObserver
- **AND** 所有实例 MUST 通过 register/unregister 加入该 observer
- **AND** MUST NOT 每个实例独占一个 IntersectionObserver

### Requirement: createActivityPresentation caches parsed metadata and uses constant phrases

`createActivityPresentation` MUST 将 `allPhrases` 提升为模块级常量避免每次重建，MUST 缓存 `JSON.parse(entry.body.result)` 的结果避免重复解析，MUST 将 `phrases.filter` 的 O(phrases×items) 优化为基于 Set 的 O(phrases)。

#### Scenario: Streaming token does not rebuild allPhrases array

- **WHEN** 流式期间 createActivityPresentation 被每 token 调用
- **THEN** allPhrases MUST 复用模块级常量
- **AND** MUST NOT 每次重建 10 元素数组

#### Scenario: subagentMetadata JSON.parse is cached per entry

- **WHEN** 同一 subagent tool entry 的 body.result 被多次访问
- **THEN** JSON.parse MUST 只执行一次
- **AND** 后续访问 MUST 复用缓存的解析结果
