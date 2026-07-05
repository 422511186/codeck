## Context

当前移动端 timeline 的底层事实源是 `TimelineEntry[]`。渲染层只合并连续 activity，不会主动改写顺序；store 则会在 replace、prepend、append 和 merge 后按 turn 与 `createdAt` 归一化。

已发现的顺序问题不只来自单一 repair 分支。`threadDetailEntriesWithTurnItems` 可以把数组顺序调整成 activity 在最终 assistant 前，但如果 `createdAt` 仍保留原始 `[agent, activity]` 的时间关系，store normalize 会重新排回 `[agent, activity]`。历史分页、普通 snapshot 和 app-server overlay 也有类似入口。

约束来自现有规范：真实 interleaved activity 必须保留穿插顺序；只有 snapshot/JSONL/overlay 等缺少可靠文本锚点的补齐活动，才使用同 turn 内 user 之后、最终 assistant 之前的安全插入点。

## Goals / Non-Goals

**Goals:**

- 让 snapshot repair、普通 snapshot、历史分页和 overlay 的尾部 activity 在真实 store normalize 后仍位于最终 assistant 之前。
- 修正 fallback `createdAt` 的单调方向，让“数组顺序”与“store 排序语义”一致。
- 保持真实 assistant/activity/assistant 穿插顺序，不把所有 activity 统一提升到 user 后面。
- 用失败测试覆盖真实 store normalize 和 app-server overlay，而不只验证 mock 参数。

**Non-Goals:**

- 不重写 timeline store 的通用排序模型。
- 不改变 activity block 的视觉样式和摘要文案。
- 不新增 timeline item 类型。
- 不尝试伪造 app-server 未公开的工具活动。

## Decisions

1. 在 reconstruction 边界修复顺序，而不是在 store 全局排序中按类型硬编码。

   store 不能简单把所有 activity 放在 assistant 前，因为现有规范要求保留真实 interleaved 顺序。修复应限定在 snapshot、pagination、overlay 这些历史/补齐来源，并只移动位于最后一个 assistant 后面的 activity。

2. 调整 entry 顺序时同步重写同 turn 内 fallback `createdAt`。

   只改数组顺序不足以通过真实 store。安全做法是在 reconstruction helper 返回前，让同 turn 内 entry 的 `createdAt` 按返回数组顺序单调递增。这样 store normalize 不会把修复结果反向覆盖。

3. 普通 snapshot 也应用尾部 activity 修复。

   首屏 `readThread`、`startTurn` 返回 thread、rewind/fork 返回 thread 都可能拿到已经含有 overlay 或 JSONL supplement 的 timeline。它们不应该只依赖 snapshot repair effect 才能修正顺序。

4. app-server overlay 未匹配 item 按 turn 插入。

   overlay 中没有匹配到 snapshot item 的 activity 不应直接追加到整条 timeline 末尾。若 overlay item 有 `turnId`，应插入到同 turn chunk 的安全位置；没有 `turnId` 时才保留尾部追加。

## Risks / Trade-offs

- [Risk] 重写 `createdAt` 可能影响非常依赖精确时间的局部顺序 → Mitigation：只对 reconstruction 后的同 turn fallback 顺序做最小归一化，不改变 live delta 已稳定在 store 中的 `createdAt`。
- [Risk] 过度修复会把真实 interleaved activity 提前 → Mitigation：只移动最后一个 assistant 之后的 activity，不移动 assistant 之间已有的 activity。
- [Risk] overlay 没有可靠 turnId 时无法安全插入 → Mitigation：无 turnId overlay 继续追加，不伪造 turn 归属。
- [Risk] 历史分页中的多 turn page 可能共享接近时间戳 → Mitigation：按 page item 顺序生成单调 fallback 时间，store 的 turnOrder 仍由 entry 顺序确定。
