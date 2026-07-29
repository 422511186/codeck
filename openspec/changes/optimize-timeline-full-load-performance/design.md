## Context

Timeline 性能问题分布在三处：前端派生链与 observer（流式期间每 token 全量重算 + 重订阅）、前端 store 索引与内存（O(n²) 索引重建 + 无 LRU）、服务端读取（全量返回 + 反复 stringify）。核心矛盾是"流式期间 entries 每 token 换引用"与"派生/索引无增量快速路径"。

## Goals / Non-Goals

**Goals**
- 流式期间派生链与索引支持尾部 append 增量，避免每 token O(n) 全量重算。
- ResizeObserver 单例化，避免每 token DOM 扫描。
- 服务端 timeline 读取支持分页。
- `timelineThreadWithinBudget` 改为增量字节累加，避免反复全量 stringify。
- 首屏挂载行数受限（15-20），LazyAgentMarkdown 长文本可渲染，IntersectionObserver 共享。
- store `threads` LRU 淘汰，索引增量更新。

**Non-Goals**
- 不重写虚拟化框架（保留现有 visible window + IntersectionObserver 方案）。
- 不修改 `threadDetailEntriesWithTurnItems`（当前未生产调用）。
- 不处理 Command 合并与顺序流问题（归入另两个变更）。
- 不引入新依赖。

## Decisions

### 决策 1：派生链尾部 append 快速路径

为 `timelineEntriesForPresentation`、`deriveTimelineRenderBlocks`、`createTimelineLayoutIndex` 增加 delta 检测：比较新 entries 与上次 entries 的前缀，若新 entries 是旧 entries 的尾部追加（前 N 项引用相等），则复用上次结果，仅对尾部追加项做增量扫描/dedupe/offset 累加。

**实现要点**：
- `timelineEntriesForPresentation`：缓存上次 entries 引用与反向扫描结果，若前缀引用相等则仅对新尾部做反向扫描。
- `deriveTimelineRenderBlocks`：缓存上次 presentationEntries 与 allBlocks，若前缀引用相等则仅对新尾部 blocks 做增量 dedupe（Map 复用）。
- `createTimelineLayoutIndex`：缓存上次 allBlocks 与 layoutIndex，若前缀引用相等则仅对新尾部累加 offset。

**理由**：流式期间每 token 通常只在尾部追加 1 条 entry，前 N-1 项引用不变。当前代码无增量路径，每 token 跑 5-6 趟 O(n)。

### 决策 2：ResizeObserver 单例化

将 `Timeline.tsx` 的 `ResizeObserver` effect 重构为"单例 observer + 元素注册表"：
- observer 只创建一次（`useRef` + 懒初始化），不依赖 allBlocks/layoutIndex/visibleBlocks。
- 每个 row mount 时通过 `registerRow(id, el)` 加入 observer，unmount 时 `unregisterRow(id)`。
- observer 回调通过 `entries.forEach` 更新对应 row 的尺寸到 store。

**理由**：当前 effect 依赖 `[allBlocks, layoutIndex, virtualized, visibleBlocks]`，流式每 token 触发 disconnect → `querySelectorAll` O(n) DOM 扫描 → 重新 observe 80 个 row → 浏览器布局重排。

### 决策 3：服务端 readThreadMetadata 分页

为 `readThreadMetadata` 增加可选 `cursor`（最后已读 itemId 或 turnId）与 `limit` 参数：
- 无参数时保持现有行为（全量返回），保证向后兼容。
- 有 cursor 时从 cursor 之后读取，返回 `nextCursor`（null 表示无更多）。
- GET route 透传 query 参数。

**理由**：当前 GET 直接整体 JSON 返回，长对话压缩后仍接近 2MB，移动端 JSON.parse 阻塞 100-300ms。repair 流程在多种原因下反复触发，每次重拉全量。

### 决策 4：timelineThreadWithinBudget 增量字节累加

重写 `timelineThreadWithinBudget`（runtime.ts L4408-4466）为单趟增量累加：
- 初始化 `totalBytes = 0`。
- 遍历 timeline，对每条 item `JSON.stringify(item)` 累加到 totalBytes。
- 超过 budget 时停止，返回截断后的 detail（带 `truncated: true` 标记与 `nextCursor`）。
- 不再全量 `detail.timeline.map(...)` 重建 + 全量 `JSON.stringify(result)` 最多 10 次。

**理由**：当前每次循环全量 map 重建 + 全量 stringify + TextEncoder.encode 测字节，500 item × 10 次 ≈ 服务端 CPU 几十到上百毫秒。单趟增量累加 O(n) 一次完成。

### 决策 5：首屏行数与 markdown 渲染优化

- `MAX_INITIAL_TIMELINE_ROWS` 从 80 降到 20（移动端约 2 屏）。
- `LazyAgentMarkdown` 修复长文本永不渲染 markdown：移除 `text.length > LAZY_MARKDOWN_TEXT_LIMIT` 直接 return 的分支（L1481）。改为：
  - 短文本（< LAZY_MARKDOWN_TEXT_LIMIT）：立即渲染 markdown。
  - 长文本：先用 `PlainAgentText` 显示，滚动接近时通过 idle callback 分块解析 markdown。
  - 移除 `eagerMarkdown` 翻转导致 24KB markdown 全量解析的卡顿。
- IntersectionObserver 共享：模块级单例 `sharedLazyMarkdownObserver`，所有 `LazyAgentMarkdown` 通过 register/unregister 加入。

**理由**：80 行首屏挂载过多导致白屏；长文本永不渲染 markdown 是正确性 + 性能双 bug；30 个独占 IntersectionObserver 挤满 idle 期。

### 决策 6：replaceOrAddEntry 增量索引

`replaceOrAddEntry`（store.ts L609-649）改为：
- byId：`new Map(prev.byId); newMap.set(id, entry)` —— O(1) 增量。
- byTurnId：若 entry.turnId 变化，从旧 turnId 的 Set 删除并加入新 turnId 的 Set —— O(1) 增量。
- 不再调用 `buildTimelineEntryIndexes` 全量重建。

**理由**：当前每个 item.appended/item.updated 触发一次全量 O(n) 重建，repair 期间 500 item 的 turn 完成时索引重建累计 25 万次操作。

### 决策 7：store threads LRU

`threads: Record<string, ThreadState>` 改为 `Map<string, ThreadState>` + LRU 淘汰：
- 维护 `threadAccessOrder: string[]`（最近访问在尾）。
- 每次访问 thread 时移到尾部。
- 超过阈值（如 5 个）时淘汰头部 thread 的 entries + entryIndexes，保留元数据（threadId、title 等）。
- 切换 thread 时若已淘汰则重新 fetch。

**理由**：移动端多会话后 JS heap 持续增长，可能触发 OOM 杀页。

### 决策 8：withEntries 尾部 append 快速路径

`withEntries`（store.ts L663-692）增加 delta 检测：若新 entries 是旧 entries 的尾部追加（前 N 项引用相等），则复用原数组前缀，仅新建尾部（`[...prev.slice(0, n), ...newTail]`），避免整体 spread。

**理由**：当前每 token 整数组拷贝 O(n)，n=500 时每秒几万次拷贝，持续 GC 压力。

### 决策 9：createActivityPresentation 优化

- `allPhrases` 数组提升为模块级常量，避免每次重建。
- `JSON.parse(entry.body.result)` 改为缓存：在 entry 上附加 `_parsedSubagentMeta`（非持久化字段），重复访问时复用。
- `phrases.filter(phrase => items.some(...))` 改为提前构建 `itemIds: Set<string>`，filter 内 `itemIds.has(phrase.itemId)` O(1)。

**理由**：流式时每 token 重建 10 元素数组 + JSON.parse + O(phrases×items) filter。

## Risks / Trade-offs

- **尾部 append 快速路径的引用相等检测**：需保证 entries 数组的不可变性，否则前缀引用相等假设失效。当前 store 的 withEntries 每次新建数组，前缀引用应保持相等，但需验证。
- **LRU 淘汰可能导致切回 thread 时重新 fetch**：阈值需平衡内存与体验，5 个对移动端合理。
- **分页参数引入可能改变 repair 行为**：需保证 repair 仍能获取完整 timeline（可多次分页拉取或 fallback 全量）。
- **LazyAgentMarkdown 长文本分块解析可能引入渲染不一致**：需保证分块边界不破坏 markdown 语法（如代码块）。

## Migration Plan

- 所有改动向后兼容：分页参数可选，无参数时走原路径。
- 增量快速路径在引用相等失败时 fallback 到全量重算，不影响正确性。
- LRU 淘汰不影响当前活跃 thread。
- 无数据迁移。

## Open Questions

- 尾部 append 检测的"前缀引用相等"是否在所有 store 更新路径上成立？需审计 `withEntries` 的所有调用点，确认是否有 in-place 修改（splice/sort）破坏引用。
- LazyAgentMarkdown 长文本分块解析的边界策略（按行？按字符数？）需实测确定。
- 服务端分页的 cursor 设计：itemId（不稳定，可能被 repair 改变）还是 turnId（稳定但粒度粗）？倾向 turnId + 页内 offset。
