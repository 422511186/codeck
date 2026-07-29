## Why

Timeline 流式期间与首屏/repair 路径存在多处已核实性能缺陷，导致移动端流式掉帧、首屏白屏、repair 期间 O(n²) 索引重建、服务端无分页全量返回 + 反复 JSON.stringify。根因集中在五处：

1. 前端派生链（presentation/blocks/layout/indexes）每 token 全量 O(n) 重算，无尾部 append 快速路径。
2. `ResizeObserver` effect 每 token 全量重订阅，触发 DOM 扫描与布局重排。
3. 服务端 `readThreadMetadata` 一次返回全量 timeline 无分页；`timelineThreadWithinBudget` 反复 JSON.stringify 全量最多 10 次。
4. 前端 `MAX_INITIAL_TIMELINE_ROWS = 80` 首屏挂载过多；`LazyAgentMarkdown` 长文本永不渲染 markdown；每个 `LazyAgentMarkdown` 实例独占 IntersectionObserver。
5. `replaceOrAddEntry` 每 token O(n) 索引重建导致 O(n²)；store `threads` 无 LRU；`withEntries` 每 token 整数组拷贝。

所有问题均已通过逐行核实确认存在（13 项中 12 项完全成立、1 项部分成立但核心结论成立）。

### 关键前置事实

- `threadDetailEntriesWithTurnItems`（`src/web/state/timeline-adapter.ts` L104-220）**当前未被生产代码调用**——生产 repair 流程走 `codex.readThread` + `threadDetailEntries(td)` 一次性全量转换。该函数仅在测试中引用，本变更不修改它。
- **关键差异**：`codex.readThread` 客户端调用对应服务端 `readThreadMetadata`（**无字节预算**），而非 `readThread`（有预算）。这意味着 repair/初始加载路径返回的 timeline 完全不受字节预算约束，是完整数组；`timelineThreadWithinBudget` 的 10 次 stringify 循环只在调用 `readThread` 的路径上触发，repair 路径不经过它。

## What Changes

### 前端派生链增量

- 为 `timelineEntriesForPresentation` 增加"尾部 append"快速路径：当新 entries 是旧 entries 的尾部追加时，复用上次的反向扫描结果，仅对新尾部做增量扫描。
- 为 `deriveTimelineRenderBlocks`、`createTimelineLayoutIndex` 增加 delta 增量：当 presentationEntries 是尾部追加时，仅对新尾部 blocks 做增量 dedupe 与 offset 累加。

### ResizeObserver 单例化

- 将 `Timeline.tsx` 的 `ResizeObserver` effect 从"依赖 allBlocks/layoutIndex/visibleBlocks 全量重订阅"改为"单例 observer + 元素注册表"：observer 只创建一次，所有 row 通过 register/unregister 加入/移除。

### 服务端分页 + 增量字节预算

- 为 `readThreadMetadata` 增加可选 `cursor`/`limit` 参数，支持分页返回 timeline。
- `timelineThreadWithinBudget` 改为增量字节累加：单次 stringify 每条 item，累加字节数，超 budget 时停止；不再全量重建 + 全量 stringify 最多 10 次。

### 首屏与 markdown 渲染优化

- `MAX_INITIAL_TIMELINE_ROWS` 从 80 降到 15-20。
- 修复 `LazyAgentMarkdown` 长文本永不渲染 markdown：移除 `text.length > LAZY_MARKDOWN_TEXT_LIMIT` 直接 return 的分支，改为 idle callback 分块解析或保留纯文本直到滚动接近。
- IntersectionObserver 共享：所有 `LazyAgentMarkdown` 共享一个全局 observer，通过 register/unregister 管理。

### 索引与内存优化

- `replaceOrAddEntry` 增量更新索引：仅更新受影响 entry 的 byId/byTurnId，不重建整个索引。
- store `threads` 增加 LRU 淘汰：超过阈值（如 5 个）时淘汰最久未访问 thread 的 entries + entryIndexes。
- `withEntries` 尾部 append 快速路径：当新 entries 是旧 entries 的尾部追加时，复用原数组前缀，仅新建尾部。

### 其他

- `createActivityPresentation` 的 `JSON.parse(entry.body.result)` 改为缓存或惰性解析；`allPhrases` 数组提升为模块常量。
- `findEntryIndexById` 索引未命中时保留线性扫描但增加诊断计数（已有 `timelineDiagnostics.linearEntryScans`），并优化常见路径避免触发。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`：明确服务端 timeline 读取应支持分页；明确派生链应支持尾部 append 增量；明确 observer 应单例化避免全量重订阅。
- `timeline-message-actions`：明确 store 应有 LRU 淘汰；明确索引更新应增量；明确首屏挂载行数应受限。

## Impact

- 前端渲染：`src/web/components/Timeline.tsx`（派生链 useMemo、ResizeObserver effect、MAX_INITIAL_TIMELINE_ROWS、LazyAgentMarkdown、IntersectionObserver）。
- 前端状态：`src/web/state/timeline-presentation.ts`（`timelineEntriesForPresentation`、`createActivityPresentation`、`allPhrases`）。
- 前端 store：`src/web/state/store.ts`（`replaceOrAddEntry`、`buildTimelineEntryIndexes`、`withEntries`、`threads` LRU、`findEntryIndexById`）。
- 前端适配器：`src/web/state/timeline-adapter.ts`（不修改 `threadDetailEntriesWithTurnItems`，仅注释标注未生产调用）。
- 服务端运行时：`src/server/app-server/runtime.ts`（`readThreadMetadata` 分页、`timelineThreadWithinBudget` 增量字节累加）。
- 服务端 API：`src/app/api/codex/threads/[threadId]/route.ts`（GET 支持 cursor/limit 参数）。
- 补充单元测试覆盖：尾部 append 增量、observer 单例、分页读取、增量字节预算、首屏行数、LazyAgentMarkdown 长文本、LRU 淘汰、增量索引。
- 不改变公开 API 语义（分页参数可选）；不引入新的全量 timeline 读取。
