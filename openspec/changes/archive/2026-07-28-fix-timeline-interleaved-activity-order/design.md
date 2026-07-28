## Context

timeline 的同一 turn 可能同时由五类输入构成：app-server item page、运行中 event/overlay、完成态 item、rollout JSONL supplement，以及页面触发的 bounded latest-page repair。当前展示层按 normalized entry 的相邻关系聚合 activity，因此上游只要把 `command B` 移到 `command A` 旁边，UI 就会合理地把二者合成一个 activity block，造成“下面工具消失并合到上面”的表象。

已定位的四个缺口如下：

1. `repairOverlayTurnItems` 无条件把同 turn 最后一条 agent item 当作最终答复，并把其后的 activity 搬到该 agent 之前。对于 `command A -> assistant message -> command B`，这会得到 `command A -> command B -> assistant message`。
2. `mergeTurnSessionRecords` 的 `equivalentTool` 只比较 turn 和 tool metadata。item 级 latest page 与 whole-turn supplement 边界不一致时，metadata 相同的早期 command A 可能错误消费 page 中的 canonical command B，导致 A 丢失、B 重复。
3. completion event 只有在 turn 没有任何可见输出时才请求 repair；已有 partial agent/tool 输出会让 final reconcile 被跳过，而 summary poll 可能在 running 状态被清除后停止。
4. 页面先执行 `replaceLatestWindow`，随后又通过 `applyThreadDetail(..., "merge")` 提交同一 page。第二次低权威 merge 可能丢失 live `streamSequence`、`sourceOrder` 和 watermark 相关状态。

现有 presentation 的“只聚合连续 activity entries”原则不需要改写。修复应发生在 source normalization、timeline engine ingress 和页面 repair 编排层，避免通过 UI 排序掩盖身份或位置错误。

```text
event / item page / rollout JSONL
                |
                v
     server identity + source order
                |
                v
       bounded repair response
                |
                v
 timeline engine single window commit
                |
                v
 presentation groups adjacent activity only
```

约束包括：继续使用 item 级有界分页；不得回退到完整 timeline 读取或固定短间隔轮询；不得修改 `docs/generated/` 协议产物；所有输入仍需通过 HistoryStamp、generation、request token 和 watermark 防护。

## Goals / Non-Goals

**Goals:**

- 对运行中的 `command A -> assistant message -> command B` 保持真实交错顺序，并在 refresh 后收敛到相同 identity 顺序。
- partial item page 与 whole-turn supplement 只按强 identity、显式 alias/source slot 或唯一位置 anchor 一对一合并。
- completion event 与 summary idle 信号为同一 generation/turn 合并触发一个 bounded final-reconcile 协调周期，即使已有 partial output。
- 每个成功 repair page 只提交一次权威 latest window，并保留 page watermark 之后的 live metadata。
- 用跨 server、store、page 和 presentation 的同构场景覆盖 live、repair、completion 与 refresh。

**Non-Goals:**

- 不改变 activity 的视觉样式、折叠交互或移动端布局。
- 不改变完成态 reasoning 的隐藏规则，也不在本 change 调整 Skill/Subagent 的名称级展示折叠。
- 不为缺少稳定 identity 的所有历史数据发明基于文本或 metadata 的全局猜测算法。
- 不新增公开 API、数据库迁移或第三方依赖。

## Decisions

### 1. Overlay 顺序不得由 agent role 推断

`repairOverlayTurnItems` 不再通过“最后一条 agent item”推断最终答复。已有 identity 的 overlay 继续原位更新；新 overlay item 优先使用完整 HistoryStamp、turnId、`streamSequence`、`sourceLocator` 或 before/after anchor 定位。只有当权威来源明确证明某 assistant item 是终态锚点时，activity 才能被放到其前方。

若缺少可比较顺序和唯一 anchor，系统采用非破坏性策略：保留 overlay 的来源内顺序并等待后续 bounded repair，而不是跨越已有可见 assistant message 搬移条目。该策略可能暂时显示一个位置不够精确的 activity，但不会静默丢失或把两个工具错误聚合。

备选方案是继续使用 role 启发式并尝试通过 `done` 或文本长度识别最终回复。中途 assistant message 同样可能是完成 item，无法提供可靠区分，因此不采用。

### 2. Supplement 匹配采用强 identity 与一对一边界消费

session supplement 的 tool 匹配按以下优先级解析：

1. 同 HistoryStamp/generation、turnId 和相同稳定 `item.id` 或 `callId`。
2. 可验证相同的 `sourceLocator` 或显式 source slot/alias。
3. 位于相同 message anchors 之间且候选唯一的一对一位置匹配。
4. 无法唯一证明时不合并，保留独立项或标记 scoped repair-required。

`toolKind/server/tool/path/arguments` 仅用于展示或在强 identity 已确认后的属性合并，不能单独建立等价关系。消费集合应绑定 supplement record identity，而不是让较早 metadata 相同的 record 抢先消费 partial page 中较晚的 canonical item。

备选方案是为 metadata key 建立 FIFO 队列。item page 可能从 turn 中间开始，FIFO 的左边界与 whole-turn supplement 不同，仍会把 command A 匹配到 canonical command B，因此不采用。

### 3. Final reconcile 使用 generation/turn 协调键

store 在完成当前 active turn 时，无论是否已有可见输出，都请求 `turn-completed` repair。summary idle 继续作为完成事件缺失时的权威 fallback。两种信号沿用统一的 `turn-completed:<turnId>:<generation>` 协调键，使并发信号复用同一 pending 周期。

页面保留现有有界 materialization retry：第一次 page 尚未出现目标 turn 输出时，可在固定上限内重试；这里的“一个 final-reconcile 周期”指同一协调键的一次状态机，不等同于只能发出一次 HTTP 请求。成功 materialize、达到重试上限、HistoryStamp 失效或 generation 迁移后，周期终止。实现需要记录已终止的协调键，防止较晚的重复 completion/summary 信号重新启动同一周期。

备选方案是只修 summary poll，让它在 running 清除后继续一次。completion event 是更直接的终态信号，且页面可能在下一次 summary poll 前停止 effect，因此该方案不能覆盖全部现场。

### 4. Repair page 只有一个 timeline 提交入口

页面取得 metadata 与 bounded latest page 后，先校验 request guard、HistoryStamp 和 repair window，再将 `page.items` 转换一次并调用 `replaceLatestWindow`。该调用是 repair entries、cursor、generation、window anchors 和 watermark 的唯一 timeline 提交。

随后页面只应用 thread metadata，例如 detail、status、model state、permission state、context usage 和 turn manifest；不得把 `page.items` 再交给 `mergeThreadEntries`。实现可将 `applyThreadDetail` 拆成 metadata 与 timeline 两部分，或增加明确的 metadata-only 模式，但不能使用空 timeline 伪装普通 merge。

`snapshot-window` reducer 继续负责用强 identity 合并 page 内 canonical body 与 page watermark 之后的 live entry，并保留相容的 `streamSequence`、revision、source order 和 suppression metadata。

备选方案是在第二次 merge 中提高 snapshot authority。重复 ingress 仍会让同一 payload 经过两套 reducer 语义，增加 cursor、suppression 和排序分歧，因此直接移除重复提交更清晰。

### 5. Presentation 只验证相邻分组，不承担修复

presentation 继续把连续 activity entries 聚合为 disclosure；可见 assistant entry 自然切断分组。新增测试确保输入顺序为 `command A, agent message, command B` 时输出两个 activity 段，并确保 metadata 相同但 identity 不同的 command 不被名称级折叠。

如果仅有完成态 reasoning 位于两个工具之间，reasoning 被隐藏后两侧工具变为相邻仍属于现有展示规则。本 change 不将该情况误判为数据丢失。

### 6. 回归场景使用同一语义序列贯穿各层

各邻近测试使用同一组稳定 identity 和顺序：`cmd-a -> agent-mid -> cmd-b`，其中两个 command 可共享相同 metadata，但 itemId/callId 不同。测试分别覆盖：

- runtime page 加后到 overlay；
- whole-turn rollout supplement 加从中间开始的 item page；
- store completion event 与 summary idle 的协调；
- page `replace-latest-window` 单次提交及 post-watermark live metadata；
- presentation 分组；
- final reconcile 后再以 refresh snapshot 重建的 identity 顺序。

测试数据放在邻近测试 helper 中，除非实现时发现已有可复用 fixture 约定；不为单一场景新增生产抽象。

## Risks / Trade-offs

- [Risk] 移除最终 assistant role 启发式后，极少数缺少任何 anchor 的旧 delayed activity 可能暂时出现在终态回复之后。→ 优先使用 sequence/sourceLocator/anchor；歧义时保留内容并触发有界 repair，避免静默丢失。
- [Risk] 强 identity 规则会让历史协议中无法消歧的重复工具暂时显示两次。→ 重复可见比错误删除更可恢复；记录 scoped repair-required，并只在唯一 alias 成立时合并。
- [Risk] 每个完成 turn 增加一次 bounded latest-page reconcile。→ 仅 active-to-idle 每 generation/turn 一次，不恢复完整 timeline 轮询，并复用已有请求去重与重试上限。
- [Risk] metadata-only 应用与 timeline 提交拆分后可能遗漏 status/model/permission 更新。→ 为 metadata-only 路径增加页面级测试，逐项复用现有 `applyThreadDetail` 副作用而不是复制业务逻辑。
- [Risk] completion event 与 generation bump 竞态可能把旧 repair 提交到新历史。→ 保留现有 HistoryStamp、mutation epoch、request token 和 active repair token 校验，已终止键也必须带 generation。

## Migration Plan

1. 先增加四个根因对应的失败回归测试，确认当前实现分别出现重排、错误消费、缺少 final reconcile 和重复 repair ingress。
2. 修正 server overlay 与 supplement identity/order 归一化，不改变外部响应结构。
3. 修正 store completion 协调与页面 metadata-only repair 应用。
4. 运行相关 server、timeline engine/store、thread page、adapter 和 presentation 测试，再执行 `npm run typecheck` 与完整 `npm run test`。
5. 无数据迁移；若出现回归，可整体回滚该代码变更，现有分页协议和持久化数据不受影响。

## Open Questions

无阻塞问题。真实受影响 threadId 和截图仍可用于验证线上表现，但当前四个缺口均可由确定性 fixture 复现和验收。
