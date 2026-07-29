# Tasks

## 1. 派生链尾部 append 快速路径

- [ ] 1.1 `timelineEntriesForPresentation`（`src/web/state/timeline-presentation.ts` L37-71）增加 delta 检测：比较新 entries 与缓存的前次 entries 前缀引用，相等则仅对新尾部做反向扫描
- [ ] 1.2 `deriveTimelineRenderBlocks` 增加 delta 检测：前缀引用相等则仅对新尾部 blocks 做增量 dedupe（Map 复用）
- [ ] 1.3 `createTimelineLayoutIndex` 增加 delta 检测：前缀引用相等则仅对新尾部累加 offset
- [ ] 1.4 引用相等失败时 fallback 到全量重算
- [ ] 1.5 补充单元测试：尾部追加 1 条 → 复用前缀，仅增量计算尾部
- [ ] 1.6 补充单元测试：repair 替换中部 entry → fallback 全量重算

## 2. ResizeObserver 单例化

- [ ] 2.1 `src/web/components/Timeline.tsx` 将 `ResizeObserver` effect 改为 `useRef` 单例 + 懒初始化，移除 `[allBlocks, layoutIndex, virtualized, visibleBlocks]` 依赖
- [ ] 2.2 增加 `registerRow(id, el)` / `unregisterRow(id)` API，row mount/unmount 时调用
- [ ] 2.3 observer 回调通过 `entries.forEach` 更新对应 row 尺寸
- [ ] 2.4 补充单元测试：流式 token 变化时不触发 disconnect/querySelectorAll

## 3. 服务端 readThreadMetadata 分页

- [ ] 3.1 `src/server/app-server/runtime.ts` `readThreadMetadata`（L4398-4406）增加可选 `cursor`/`limit` 参数，有 cursor 时从 cursor 之后读取，返回 `nextCursor`
- [ ] 3.2 `src/app/api/codex/threads/[threadId]/route.ts` GET 透传 query 参数 `cursor`/`limit`
- [ ] 3.3 无参数时保持全量返回行为（向后兼容）
- [ ] 3.4 补充单元测试：无参数 → 全量返回；有 cursor+limit → 分页返回 nextCursor
- [ ] 3.5 验证 repair 流程能通过多次分页拉取或 fallback 全量获取完整 timeline

## 4. timelineThreadWithinBudget 增量字节累加

- [ ] 4.1 重写 `timelineThreadWithinBudget`（runtime.ts L4408-4466）为单趟增量累加：初始化 totalBytes=0，逐条 JSON.stringify 累加，超 budget 停止
- [ ] 4.2 返回截断后的 detail，带 `truncated: true` 与 `nextCursor`
- [ ] 4.3 不再全量 map 重建 + 全量 stringify 最多 10 次
- [ ] 4.4 补充单元测试：500 item 超 budget → 单趟累加停止，返回截断 + nextCursor

## 5. 首屏行数与 markdown 渲染优化

- [ ] 5.1 `MAX_INITIAL_TIMELINE_ROWS`（Timeline.tsx L44）从 80 改为 20
- [ ] 5.2 修复 `LazyAgentMarkdown`（L1481）：移除 `text.length > LAZY_MARKDOWN_TEXT_LIMIT` 直接 return 的分支，改为长文本先纯文本显示 + 滚动接近时 idle callback 解析 markdown
- [ ] 5.3 移除 `eagerMarkdown` 翻转导致 24KB 全量解析的卡顿（分块或保持纯文本直到接近）
- [ ] 5.4 IntersectionObserver 共享：模块级 `sharedLazyMarkdownObserver`，所有 LazyAgentMarkdown 通过 register/unregister 加入
- [ ] 5.5 补充单元测试：长文本（>24000）初始纯文本，滚动接近时解析 markdown
- [ ] 5.6 补充单元测试：30 个实例共享一个 IntersectionObserver

## 6. replaceOrAddEntry 增量索引

- [ ] 6.1 `replaceOrAddEntry`（store.ts L609-649）改为：byId 用 `new Map(prev.byId); newMap.set(id, entry)` O(1) 增量
- [ ] 6.2 byTurnId：entry.turnId 变化时从旧 turnId Set 删除并加入新 turnId Set，O(1) 增量
- [ ] 6.3 不再调用 `buildTimelineEntryIndexes` 全量重建
- [ ] 6.4 补充单元测试：流式 500 条 item → 索引更新总复杂度 O(n) 非 O(n²)
- [ ] 6.5 补充单元测试：entry.turnId 变化 → 旧 turnId Set 删除，新 turnId Set 加入

## 7. store threads LRU

- [ ] 7.1 `threads` 从 `Record<string, ThreadState>` 改为 `Map<string, ThreadState>` + `threadAccessOrder: string[]`
- [ ] 7.2 每次 access thread 时移到 threadAccessOrder 尾部
- [ ] 7.3 超过阈值（5 个）时淘汰头部 thread 的 entries + entryIndexes，保留元数据
- [ ] 7.4 切换 thread 时若已淘汰则重新 fetch
- [ ] 7.5 当前活跃 thread 不被淘汰
- [ ] 7.6 补充单元测试：打开 6 个 thread（阈值 5）→ 淘汰第 1 个的 entries，保留元数据
- [ ] 7.7 补充单元测试：切回已淘汰 thread → 重新 fetch

## 8. withEntries 尾部 append 快速路径

- [ ] 8.1 `withEntries`（store.ts L663-692）增加 delta 检测：若新 entries 是旧 entries 尾部追加（前 N 项引用相等），复用原数组前缀，仅新建尾部
- [ ] 8.2 引用相等失败时 fallback 到整体 spread
- [ ] 8.3 审计 withEntries 所有调用点，确认无 in-place 修改（splice/sort）破坏引用
- [ ] 8.4 补充单元测试：尾部追加 → 复用前缀，仅新建尾部

## 9. createActivityPresentation 优化

- [ ] 9.1 `allPhrases` 数组提升为模块级常量（timeline-presentation.ts L217-228）
- [ ] 9.2 `JSON.parse(entry.body.result)` 改为缓存：entry 上附加 `_parsedSubagentMeta`（非持久化）
- [ ] 9.3 `phrases.filter(phrase => items.some(...))` 改为提前构建 `itemIds: Set<string>`，filter 内 `itemIds.has(phrase.itemId)` O(1)
- [ ] 9.4 补充单元测试：多次访问同一 entry 的 result → JSON.parse 只执行一次
- [ ] 9.5 补充单元测试：allPhrases 复用模块常量，不每次重建

## 10. findEntryIndexById 优化

- [ ] 10.1 保留线性扫描 fallback（store.ts L1712-1719）与诊断计数 `timelineDiagnostics.linearEntryScans`
- [ ] 10.2 优化常见路径：repair 期间优先用 byId 索引命中，避免 fallback
- [ ] 10.3 补充单元测试：byId 命中 → O(1)；byId 未命中 → 线性扫描 + 诊断计数递增

## 11. 验证与回归

- [ ] 11.1 运行 `npm run typecheck`
- [ ] 11.2 运行 `npm run test`
- [ ] 11.3 运行 `npm run verify`
- [ ] 11.4 人工验证：长对话流式不卡顿；首屏白屏时间下降；多会话内存稳定
