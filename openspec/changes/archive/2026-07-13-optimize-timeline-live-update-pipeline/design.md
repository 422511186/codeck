## Context

当前前端已经有 `TimelineEngineState`、identity、generation、revision、snapshot suppression、deleted-turn barrier 和窗口化 Timeline，但 store 每次处理输入时会通过 `createTimelineEngineState(init)` 重建 engine state。常见 `agent_message_delta`、`reasoning_delta` 和 tool output delta 虽只改变一个 entry，仍可能重新归一化完整 entries、排序并重建 indexes。

`codex-event-batch` 到达 store 后目前按事件循环再次调用 `dispatchEvent`，协议层的 batch 因而退化为多次 Zustand `set` 和多次 React commit。Timeline 组件虽然只挂载窗口内 rows，但 `entries.slice()`、全量 row state 派生和未 memo 的 row 仍会让无关可见内容随每个 delta 重算。

首次实施后的独立架构复核发现，store 为实现单次提交而新增了 engine 外的 delta 拼接与临时索引，最终又以 `snapshot-window` 全量提交；事件客户端按 item key 的 Map flush 还会把 `A1, B1, A2` 重排为 `A1, A2, B1`。此外，timeline adapter 仍会把 trailing activity 移到 final assistant 之前并重写 `createdAt`。这些实现违反“统一 engine reducer”和实时/刷新顺序同源的目标，必须在归档前修正。

约束如下：

- 保留现有 app-server 事件协议、snapshot repair、rollback/fork、generation 和移动端滚动语义。
- 不以文本包含作为主要 identity，不允许批处理改变单事件接受/拒绝结果。
- 不新增数据库；优先使用现有 TypeScript、Zustand、React 和 Vitest 工具链。
- 性能验证以提交次数、全量扫描次数、派生次数和挂载 row 数等数量级指标为主，避免依赖脆弱的绝对毫秒阈值。

## Goals / Non-Goals

**Goals:**

- 一个服务端 event batch 对同一 thread 最多形成一次可见 timeline store 提交，控制事件在需要时作为 barrier 先 flush 或重新校验 pending delta。
- batch 内事件必须保持原始到达顺序，跨 item 分组不得改变 source order。
- 普通 live delta 通过持久化 indexes 定位 entry，并以结构共享更新单个条目，不执行全量 normalize、排序和 index rebuild。
- snapshot、pagination、repair、rollback/fork 等结构性输入继续使用统一 engine 全量路径，保证正确性优先。
- event/revision ledger 在 repair 后保持幂等，并在 generation 变化时既不抑制新历史，也能拒绝旧 generation late event。
- 缺少 itemId 的 live 输出 identity 必须限定到 thread、generation、turn 和 kind，不能跨 turn 复用。
- Timeline 渲染只重新派生和渲染受影响的可见 row；未变化长输出继续复用缓存。
- snapshot、pagination、turn item detail、overlay、supplement 和 live event 使用同一个 engine source-order 模型；adapter/page helper 只做数据映射，不做可见顺序修复。

**Non-Goals:**

- 不重写 WebSocket/SSE 服务端协议或 app-server 数据模型。
- 不重新设计 timeline 视觉、活动聚合文案、消息操作或滚动交互。
- 不替换现有窗口化方案或引入新的虚拟列表依赖，除非实施中证明现有窗口无法满足规格。
- 不保证每个 delta 都立即产生独立 React commit；可见文本允许在短窗口内合并。

## Decisions

### 1. 每个 thread 持久化 TimelineEngineState

`ThreadState` 将持有 engine state 或等价的持久化 entries、indexes、generation、deleted-turn barrier、processed event ledger 和 revision ledger。store action 不再为每次输入重新调用 `createTimelineEngineState`，而是把现有 state 交给 `applyTimelineInput` 并保存返回结果。

普通 entry update 使用 `indexes.byIdentity` 或 `byEntryId` 定位，并只复制 entries 数组和目标 entry；只有 identity/order 元数据变化时才进入结构性归一化。snapshot window、pagination page、repair replace、rollback/fork replace 仍可全量 normalize 和 rebuild indexes。

备选方案是在 store 外继续维护独立 indexes。该方案会让 engine 与 store 再次形成双轨状态，容易出现索引和 entries 不一致，因此不采用。

### 2. 事件客户端按 thread 保留原始事件队列

事件客户端不再以 item key Map 作为 flush 顺序来源。短窗口内事件按 thread 写入有序队列，队列元素保留到达序号、eventId、generation、turnId、itemId、kind、revision 和 sequence。同 item 可在 engine 内合并文本，但客户端发出的 `codex-event-batch.events` MUST 保持原始到达顺序。

turn lifecycle、timeline gap、repair completion、rollback/fork 和审批类控制事件是 barrier：它们必须先 flush，或使 pending queue 在提交前重新校验。duplicate eventId 可在队列入口拒绝，但不能通过按 item regroup 改变剩余事件的顺序。

batching owner 唯一确定为 `TimelineEventStreamClient`。store 不实现计时窗口、跨调用聚合或第二层 batch；store 只处理 client 已输出的单事件或单 thread 有序 batch。

备选方案只在 React 层 debounce。该方案仍会让 store 和 engine逐事件做全量工作，无法解决主要 CPU 成本，因此不采用。

### 3. Engine 原生处理 live delta，store 只转换输入

`TimelineInput` 增加 `live-delta` 或等价原生输入，包含 entry identity 元数据、delta body、eventId、revision、sequence、generation 和 sourceOrder。store 对每个事件只做协议字段校验和输入转换，然后把有序 inputs 作为一次 `live-event-batch` 交给持久化 engine。

`live-delta.delta` 明确定义为 append fragment，不是累计全文。engine 使用以下确定规则：重复 eventId 丢弃；revision 小于等于已接受 revision 时丢弃；相同 revision 但内容或 eventId 冲突时记录 conflict 并请求 bounded repair；sequence 连续时追加，旧 sequence 丢弃，sequence gap 不追加并请求 repair；sequence 缺失时只按当前 generation 的 delivery order 追加。completed item 的非空文本是权威全文并替换 partial，空 completed 文本保留 partial，明显分叉时采用 completed 文本并记录 conflict diagnostics。

engine 负责 duplicate suppression、snapshot suppression、deleted-turn barrier、revision/generation 判断、文本追加、首次 materialize、identity upsert、indexes 和 diagnostics。store MUST NOT 为 batch 手工复制 entries、建立临时 entry index、拼接文本或提交完整 `snapshot-window`。

备选方案是在 store 中预聚合完整 entry。该方案会形成第二套 identity/revision/suppression 逻辑，并使真实 batch 每次全量 normalize，因此明确禁止。

### 4. 快路径不得改变身份、顺序和合并语义

快路径仅适用于 identity 已存在且不会改变 turn/order 的文本追加或状态更新。若输入新增 entry、补齐 turnId、改变 generation、确认 optimistic user、合并 live/completed item 或可能影响同 turn 顺序，则回退统一结构性 upsert/normalize 路径。

engine diagnostics 增加 fast-path commits、structural normalizations、visited entries、index rebuild entries 和 fallback/repair 计数。测试以这些计数证明高频 delta 不退化为每次全量扫描。

### 5. sourceOrder 由 engine 统一解释

source order 不定义为跨来源直接比较的单一数字。engine 使用结构化 `TimelineOrderOrigin`：`generation`、`turnId`、`sourceKind`、来源内 ordinal/sequence、可选前后 identity anchor。live event 使用 delivery ordinal 与 event sequence；snapshot/pagination 使用服务端数组位置和 turn/page anchor；turn item detail 使用跨页累计 ordinal；session supplement 使用 JSONL sequence 和同 turn identity anchors。

不同坐标系的 ordinal MUST NOT 直接数值比较。engine 按以下规则收敛：同 identity upsert 保留首次 materialize 位置；权威 `snapshot-window` 按 snapshot 数组顺序建立窗口基线；pagination 只 prepend 到 cursor 历史边界；detail/supplement 新 identity 按同 turn 前后 identity anchor 插入；缺少可靠 anchor 时保留来源数组顺序并产生 completeness/repair 诊断，不允许 adapter 猜测移动位置。

同一 identity 的后续 delta 只更新原 entry，不移动首次 materialize 的相对位置。adapter 可以补齐 sourceOrder，但 MUST NOT 移动 entries、按 role rank 重排或改写 `createdAt` 来表达顺序。实时流和刷新 snapshot 对同一 fixture 进入 engine 后必须得到相同的可见 identity 顺序。

### 6. barrier 使用显式 thread delivery epoch

事件客户端和 store 共享 thread-local `deliveryEpoch`。client 输出的单事件或 batch envelope 携带捕获 epoch；store 在 reduce 前比较当前 epoch，不匹配则整批丢弃。repair/mutation coordinator 负责同时调用 client invalidate 与 store epoch bump。

- approval、settings 和普通非破坏性控制事件：先按原顺序 flush，再发送控制事件，epoch 不变。
- turn lifecycle：先 flush 该 thread，再发送 lifecycle event，epoch 不变。
- `timeline-gap`：丢弃该 thread pending queue并递增 epoch，再启动 bounded repair。
- snapshot repair 开始或权威 replace：coordinator 先 invalidate queue并递增 epoch；repair completion 不再 flush 旧 queue。
- rewind、rollback、fork：API 调用前 invalidate queue并递增 epoch；失败时重新订阅并 repair。
- generation bump 与 deleted-turn barrier：engine reduce 时逐事件复核，旧 generation 或 deleted turn 输入丢弃。

### 7. fallback live identity 必须限定到 turn

当服务端缺少 itemId 时，agent/reasoning/tool live entry 使用包含 `threadId`、generation、turnId 和 kind 的 fallback identity；同一 turn 同 kind 如确实可能存在多个 item，则必须由 sequence/revision 或 bounded repair 解决，不能使用 `${threadId}-agent-live` 这类跨 turn id。

缺少 turnId 的可见输出不得直接归入当前 active turn。客户端保守触发归属明确的 bounded repair，或在已有事件上下文可证明归属时补齐 turnId。

### 8. ledger 按 generation 分段并保留 repair 幂等性

snapshot repair 不清空当前 generation 的 processed event 和 revision ledger。rollback/fork 推进 generation 时创建新分段，旧分段在有界保留窗口内用于拒绝 late event；新 generation 的同名 itemId/revision 不受旧分段抑制。

淘汰策略按 generation 和最近访问/插入时间维护有界分段，不使用会无差别丢失活跃 generation 旧 eventId 的单一 FIFO Set。具体容量可沿用当前数量级，但必须由测试验证当前 generation repair/replay 场景。

### 9. 渲染缓存以 entry 引用和稳定派生 key 为边界

`TimelineRow`、inline activity block 和昂贵内容组件使用 memo 或等价选择器。Timeline 只对当前窗口生成 render blocks 和 row state；未变化 entry 保持对象引用，确保其他 entry 的 delta 不使其 Markdown、diff、tool preview 或 activity section cache 失效。

回调引用应稳定，但不能为了 memo 将 stale running/action 状态封闭在旧 closure 中。activity block 的 key 必须包含其成员 entry 的稳定派生版本，成员未变时复用，任一成员变化时只重算该 block。

## Risks / Trade-offs

- [Risk] 持久化 engine state 增加 ThreadState 迁移复杂度，旧 helper 可能继续直接修改 entries。→ Mitigation：先补 state invariant 测试，所有写入口逐步改为 TimelineInput；开发环境对 indexes 与 entries 做抽样一致性检查。
- [Risk] 合并 delta 会改变中间帧数量。→ Mitigation：规格只要求文本顺序与最终内容一致，并为控制事件设置 barrier；移动端以一帧级短窗口为默认。
- [Risk] 快路径错误判断可能破坏顺序或漏合并 completed item。→ Mitigation：快路径条件保持保守，任何 identity/order 元数据变化都回退结构性路径，并对 live→completed、optimistic→confirmed、repair overlap 建回归测试。
- [Risk] ledger 分段保留增加内存。→ Mitigation：按 thread/generation 设置有界容量和淘汰，线程释放时整体释放； diagnostics 暴露 ledger size。
- [Risk] React memo 比较过粗可能展示旧内容。→ Mitigation：依赖 entry 对象引用和明确的 revision/text/status 派生 key，不使用只比较 id 的 memo。
- [Risk] 批处理与 repair/rollback 并发可能提交旧尾部。→ Mitigation：barrier 推进 thread epoch，flush 前比较捕获 epoch/generation，并重新执行 suppression/deleted-turn 判断。
- [Risk] sourceOrder 字段在旧 snapshot 中缺失。→ Mitigation：engine 使用来源内稳定数组顺序作为 fallback；缺少可靠跨来源顺序时触发 bounded repair，而不是 adapter 猜测并改写时间。

## Migration Plan

1. 先增加 diagnostics 与红灯测试，固定当前逐 batch 多提交、逐 delta 全量 normalize、跨 turn fallback id 和 repair 后 replay 行为。
2. 将 ThreadState 迁移为持久化 engine state，保留现有 action 外部接口，并先让结构性输入走新持久化路径。
3. 实现单 entry 快路径和索引增量更新，再迁移 agent/reasoning/tool delta。
4. 将事件客户端改为按 thread 的有序 pending queue，加入 control barrier 与 pending batch epoch。
5. 为 engine 增加原生 live delta 输入；store 只提交有序 `live-event-batch`，删除手工 batch merge 和 snapshot fallback。
6. 引入统一 sourceOrder/orderKey，移除 timeline adapter 的 activity 移动和 `createdAt` 重写。
7. 增加同一 fixture 的 realtime event 与 refreshed snapshot 差分顺序测试，以及真实 client→store→engine 复杂度测试。
8. 改造 fallback identity 与分代 ledger，验证 rollback/fork、repair、reconnect replay 和 optimistic user 确认。
9. 对 Timeline row、activity block 和可见窗口派生增加引用稳定性与 memo 测试。
10. 运行 timeline 定向测试、`npm run typecheck`、`npm run test` 和 OpenSpec 校验，并再次执行独立架构复核。

回滚时可以先关闭短窗口合并但保留持久化 engine；快路径可通过统一开关回退结构性 reducer；渲染 memo 可独立回退，不影响数据正确性。

## Open Questions

- 当前 generation 的 event ledger 容量应按事件数量、时间还是两者组合淘汰，需要通过真实长 turn 事件量和测试 fixture 选择默认值。
- tool output 缺少 itemId 且同 turn 存在多个同 kind tool 时，是否能从 app-server 参数稳定提取 call id；若不能，应优先触发 repair 而不是扩大文本 fallback。
