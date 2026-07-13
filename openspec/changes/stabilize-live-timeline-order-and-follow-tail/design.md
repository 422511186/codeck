## Context

当前 timeline engine 已统一处理 snapshot、pagination 和 live event，但结构性合并仍存在两个边界缺口。第一，tool identity 包含 `server/tool/id`，file change 在实时 delta 阶段使用占位 `tool=file`，完成 snapshot 使用真实路径，导致同一 `itemId` 无法合并。第二，页面层根据 `lastEntry` 直接修改 `scrollTop`，而 Timeline 组件独立维护虚拟窗口与 spacer，长列表发送时可能先滚到底部、后更新窗口，从而短暂或持续显示空白。

约束包括：不得通过完整 timeline 读取修复；不得破坏用户阅读历史时的滚动位置；必须兼容非虚拟化短列表和现有 cursor 分页。

## Goals / Non-Goals

**Goals:**

- 同一 generation、turnId、itemId 的 file change live/completed/snapshot 输入只产生一条 entry。
- repair 或刷新后 file change 保持在原始 agent/tool 事件之间的位置。
- 长 timeline 发送 optimistic user、追加 error 或接收同 ID delta 时，虚拟窗口与滚动尾部同步更新，不出现空白。
- 用户不在底部时保持阅读位置，不强制 follow tail。

**Non-Goals:**

- 不重写整个 timeline engine 或虚拟列表。
- 不改变服务端分页协议、limit 或字节预算。
- 不处理本 change 之外的所有历史排序异常。

## Decisions

### 1. File change identity 继续优先使用 item identity

同一 turn 内的 file tool entry 已可通过相同 `itemId` fallback 合并；本 change 用回归测试锁定该语义。file change 的实时占位路径与完成路径属于同一 item 的属性演进，不得因工具名变化拆分。

备选方案是让 live event 提前携带真实路径，但 output delta 协议并不保证该字段，因此不能作为唯一修复。

### 2. Snapshot merge 通过 identity anchor 原位完成

完成态 file change 与已有 live item 合并后沿用当前 entry 的位置和 `createdAt`。对于没有 live counterpart 的 repair item，继续使用 `beforeEntryId`、`afterEntryId` 和来源内 ordinal 插入；不直接比较不同来源 ordinal 数值。

### 3. Follow-tail 由 Timeline 在 layout 阶段提交

页面层只维护用户是否希望跟随尾部，并将该意图传给 Timeline。Timeline 在 entries、layout index 和虚拟窗口更新后，于 layout effect 中同时选择尾部窗口并恢复 `scrollTop`。页面层不在 `lastEntry` effect 中提前滚动。

短列表仍可直接滚动到底部；长列表必须先保证尾部 block 已进入 render window。

### 4. 发送和断流使用同一尾部跟随规则

optimistic user、stream delta、turn error 和 bounded repair 都只触发一次 follow-tail 协调。用户正在阅读历史时只显示“跳到最新”，不得改变 anchor。

## Risks / Trade-offs

- [Risk] 放宽 tool identity 可能错误合并同 turn 中复用 itemId 的不同工具。→ identity 仍包含 generation、turnId 和 itemId，仅对稳定 itemId 生效，并增加不同 itemId 不合并测试。
- [Risk] layout effect 中同步调整窗口可能增加一次渲染。→ 仅在 follow-tail 为真且尾部不在当前窗口时更新 window range。
- [Risk] repair item 缺少 anchor 时仍可能追加到尾部。→ 保持非破坏性追加并通过测试覆盖 app-server 当前提供的 page source order。
- [Risk] 页面和 Timeline 双方仍可能同时控制滚动。→ 移除页面 `lastEntry` 自动滚动 effect，只保留显式跳到最新和 composer 高度处理入口。

## Migration Plan

1. 先增加 engine identity/order 回归测试和长列表发送空白测试。
2. 修改 identity 与 Timeline follow-tail 协调。
3. 运行完整验证与 release smoke。
4. 基于 `codex-web:local` 构建新镜像，替换 19899 容器。
5. 生产验证长会话发送、Files changed 顺序和至少四页 cursor 分页；异常时回滚到 `codex-web:12ffa95-progressive-pagination-fix`。

## Open Questions

无。当前先修复已复现的两个问题，其他跨来源排序风险另行评估。
