## Context

`TimelineRow` 对 truncated/partial entry 提供「读取完整内容」按钮。当前实现按 `contentRef` 读取所有 chunks 后，直接调用 `setFullContent` 并通过 `store.replaceOrAddEntry(threadId, timelineEntryWithFullText(entry, text))` 写回 store。

这个异步过程没有记录并校验发起时的 thread、entry identity 和 `contentRef`。如果请求 pending 期间同一 row 收到 snapshot/repair/live 更新，或父组件切换到新的 `contentRef`，旧请求完成后仍会用旧闭包中的 `entry` 写回。结果是过期正文可能覆盖当前 preview 或 continuation，并错误标记为 complete。

## Goals / Non-Goals

**Goals:**

- full-content 读取结果只应用到发起时仍匹配的 thread、entry id、turnId 和 `contentRef`。
- stale full-content 响应不更新本地 row state，也不写回 store。
- 保持正常多 chunk 读取和完整内容写回行为不变。

**Non-Goals:**

- 不修改后端 full-content API、cursor 格式或鉴权逻辑。
- 不调整 timeline engine 的主体合并算法。
- 不改变长文本预览、Markdown 渲染或按钮文案。

## Decisions

1. **用 ref 维护当前 row identity 快照。**

   选择：在 `TimelineRow` 中维护当前 `{threadId, entryId, turnId, contentRef}` ref；发起读取时捕获同一快照，所有 chunks 完成后只有仍匹配才应用结果。

   原因：React props 会随 timeline update 改变，异步闭包不能代表当前 row 状态。ref 校验可以覆盖 contentRef 变化、entry identity 变化、thread 切换和组件卸载后的晚到结果。

   备选：只在 `useEffect([contentRef])` 中清空 `fullContent`。该方案只能清理当前状态，不能阻止旧 promise resolve 后再次写回 store。

2. **store 写回前再次确认当前 entry 仍匹配。**

   选择：除了 row ref，还检查 `useStore.getState().threads[threadId]?.entries` 中仍有同 id、同 turnId、同 `contentRef` 的 entry 后再 `replaceOrAddEntry`。

   原因：父组件可能尚未重新渲染但 store 已被 repair 更新。写回 store 前确认目标仍有效，能避免把旧内容重新插入或覆盖当前条目。

## Risks / Trade-offs

- [Risk] 过严匹配可能丢弃仍可用的旧请求结果。→ Mitigation：full-content 结果必须绑定 contentRef/revision；如果 contentRef 已变化，继续应用旧结果是不安全的。
- [Risk] 当前 entries 中暂时找不到 entry 会导致结果不写回 store。→ Mitigation：这种情况下 row 可见状态也已不可靠，丢弃比覆盖/插入旧 entry 更安全；用户可对当前 contentRef 重新读取。
- [Risk] 多 chunk 请求中途 contentRef 变化仍会继续读完后才丢弃。→ Mitigation：本变更先保证不会写错；取消网络请求可作为后续优化，不影响 correctness。

## Migration Plan

无需数据迁移。前端修复随构建发布；如需回滚，恢复 `TimelineRow.loadFullContent` 的应用逻辑即可。

## Open Questions

- 无。
