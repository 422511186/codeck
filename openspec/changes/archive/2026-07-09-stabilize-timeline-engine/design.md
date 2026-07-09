## Context

当前会话页 timeline 的数据来源包括：

- `thread/read` 最近 turns snapshot。
- `thread/turns/list` 历史分页。
- `thread/turns/items/list` 对当前 turn 的补齐。
- SSE `/api/codex/events` 的 live event 和 replay。
- 服务端 `runtime.ts` 中的 timeline overlay。
- `session-timeline.ts` 从 rollout JSONL 补充 activity 和 context usage。
- 前端本地 optimistic user message、snapshot repair、rollback/fork replace。

这些路径分别执行去重、排序、合并或补齐，规则散在前端 store、会话页、服务端 runtime 和 session timeline supplement 中。结果是同一个用户可见条目可能被不同来源以不同 id、不同 item 形态、不同 createdAt 顺序写入，导致消息重复、压缩消息重复、同 turn 顺序错误、大会话卡顿和 live 输出无法自动收敛。

约束：

- 项目默认面向手机浏览器，主线程和 DOM 预算比桌面更紧。
- `thread/read` 首屏已经改为 `includeTurns: false` + 最近 turns 窗口，新的实现不能退回全量 turns。
- 仍需兼容 app-server 事件字段不完整的情况，但不能因为字段不完整就破坏 rewind/fork 的 turn 计算。
- OpenSpec 变更只定义实现目标；实际实现阶段需要按 TDD、调试和验证纪律推进。

## Goals / Non-Goals

**Goals:**

- 建立统一的 timeline engine，使所有来源都通过同一套 identity、generation、eventId、revision、snapshot suppression 和 deleted-turn barrier 规则进入 timeline。
- 消除用户消息回显、agent/reasoning/tool live 与 completed、压缩上下文消息、rollout supplement activity 的重复显示。
- 保持同一 turn 内真实顺序，尤其支持 steer 或多 user item 不被粗暴提前。
- 确保首屏、分页、repair、turn items 补齐和 rollout supplement 都是有界读取/有界解析，大会话不会因完整历史文件或完整 turns 进入卡顿。
- 让运行中输出在 SSE 正常、重连、listener 空窗和 completion 无可见输出场景下自动收敛，不要求用户手动刷新。
- 保持 timeline 渲染窗口化和长内容懒渲染，避免历史 Markdown、diff、工具长输出全量挂载。

**Non-Goals:**

- 不重做整体聊天页视觉设计。
- 不改变 app-server 协议本身；仅在 Web 适配层和前端 store 中建立更稳定的归一化。
- 不承诺对已经写入工作区的文件做历史回滚；消息级 rewind/fork 仍只操作 thread history。
- 不新增数据库或持久化服务端索引；若需要 rollout 文件索引，先采用进程内缓存或有界扫描策略。

## Decisions

### 1. 以统一 timeline engine 取代分散 merge 规则

新增或抽出 `src/web/state/timeline-engine.ts`，提供纯函数 reducer：

```ts
applyTimelineInput(state, input): TimelineEngineState
```

输入类型覆盖：

- snapshot window
- pagination page
- live event
- live event batch
- overlay item
- turn item detail
- rollout supplement item
- local optimistic user item
- rollback/fork replace

store action 只负责把外部数据转换为 `TimelineInput` 并提交给 engine，不再在多个 action 内分别做 `appendTextToEntry`、`replaceOrAddEntry`、`mergeThreadEntries` 的独立规则。

备选方案是继续在现有 action 内修补重复和排序规则。该方案改动小，但无法保证所有来源行为一致，后续仍会出现同类回归。

### 2. 稳定身份优先，文本相似只做 fallback

每个用户可见 entry 派生 `identityKey`：

- user：`clientUserMessageId` > `generation + turnId + user item id` > `generation + turnId + first-user-slot`。
- agent/reasoning/tool/diff：`generation + turnId + itemId`。
- tool fallback：`generation + turnId + toolKind + server + tool + callId/action identity`。
- context compact：`generation + turnId + context-compacted`，没有 turnId 时使用事件 id 或 snapshot item id。
- system/error：稳定 event id 或 server item id；无法归属 turn 的事件不得参与 rewind/fork turn 计算。

文本包含关系仅用于在缺少 itemId 的历史/rollout supplement 中识别等价输出，不能作为主要去重依据。

备选方案是增强当前 `equivalentText()`。它能覆盖一部分重复，但对空白规范化、raw response id 不一致、同工具多次调用和压缩消息多来源无法可靠。

### 3. 同 turn 顺序使用 orderKey 而不是 user phase

每个 entry 派生 `orderKey`：

- `turnIndex` 或分页/历史 turn 顺序用于 turn 间排序。
- 同 turn 内优先使用 server item order、event sequence、completedAt/createdAt、source order。
- 只有本地刚发送且尚未确认的 optimistic user message 可以临时放在 active turn 开头。
- steer 或同 turn 后续 user item 必须保留在真实 item 位置，不得被所有 user phase 统一提前。

备选方案是继续使用 `user-message = phase 0`。该方案能让普通 user prompt 在 turn 开头，但会破坏多 user item/steer 的真实顺序。

### 4. 服务端 supplement 必须窗口化

`session-timeline.ts` 不应在每次 `readThread`、分页或 repair 时读取并解析完整 rollout JSONL。实现策略：

- 首屏和 repair 只对当前 timeline window 的 turnId 做 supplement。
- 分页只对当前 page 的 turnId 做 supplement。
- context usage 可以使用尾部有界扫描、app-server summary 中可用字段或受控缓存，不得为了 header 百分比完整解析所有历史。
- rollout supplement 若无法在预算内可靠补齐，应跳过 supplement 而不是阻塞 timeline 主路径。

备选方案是保留完整 JSONL parse，因为实现简单且补充信息最完整。但大会话下会直接击穿移动端性能目标。

### 5. Live event 与 repair 的职责边界

SSE live event 是运行中输出主路径：

- 普通 `EventSource error` 只进入 reconnecting 状态，不立即 destructive replace。
- 服务端或客户端检测到归属明确的 gap 时，触发对应 thread 的 bounded repair。
- listener 空窗 buffer 溢出必须产生带 threadId 的 repair 信号；如果无法确定 thread，不得默认替换 active thread。
- turn completion 后若当前 turn 没有任何可见 agent/tool/activity 输出，触发当前 turn 或最近 window 的 repair。
- repair 完成后保留近期 processed event ids，防止 replay 重复追加。

备选方案是 completion 后固定 `readThread` replace。该方案能恢复内容，但在大会话和高频输出下会造成多余请求和闪烁。

### 6. 渲染层只消费 visible model

Timeline component 不再承载全量归一化责任。store 暴露：

- normalized entries 或按 turn 分组的结构。
- visible window selector。
- pending approvals selector。
- diagnostics hooks。

渲染层继续窗口化，只挂载可见 rows 和 buffer。长 Markdown、Mermaid、diff、tool result、reasoning detail 仍按可见/展开/空闲条件渲染。

备选方案是只优化 React memo。父组件与 store 更新粒度仍会让高频 delta 放大为页面级重渲染，收益有限。

## Risks / Trade-offs

- [Risk] 统一 engine 触及 store、事件流、会话页和服务端 supplement，改动面较大。→ Mitigation：先用纯函数测试锁住 identity、order、generation、repair、pagination，再迁移入口。
- [Risk] 某些 app-server 事件缺少 itemId 或 turnId，稳定身份无法完全构造。→ Mitigation：缺少 turnId 的可见事件只作为非 rewind/fork entry 或触发 bounded repair；缺少 itemId 时使用受限 semantic fallback。
- [Risk] 禁止完整 rollout parse 可能让部分历史 activity supplement 暂时缺失。→ Mitigation：优先保证主 timeline 可用和不卡顿；仅在当前 window 内补齐 activity。
- [Risk] orderKey 与现有 createdAt 排序差异可能改变部分历史显示顺序。→ Mitigation：以 server item order 和 turn order 为准新增测试，确认变更符合真实会话顺序。
- [Risk] repair 窗口过小可能无法覆盖缺失输出。→ Mitigation：repair 先覆盖 active turn 和最近 window；若仍无法确认，保留非破坏性错误/重试状态而不是全量加载。
- [Risk] 迁移过程中可能同时存在旧 action 和新 engine 双写。→ Mitigation：按入口逐步替换，测试中断言 store 更新路径只调用 engine reducer。

## Migration Plan

1. 新增 timeline engine 类型、identity/order/reducer 纯函数和诊断计数，不接入 UI。
2. 为重复消息、压缩消息、同 turn 顺序、generation 隔离、snapshot suppression、gap repair 和长会话预算补失败测试。
3. 将 `setThreadEntries`、`mergeThreadEntries`、`prependEntries`、`dispatchEvent` 等入口逐步改为构造 `TimelineInput`。
4. 将服务端 rollout supplement 改为按当前 window/page 的 turnId 有界解析或可跳过补齐。
5. 调整 `/threads/:threadId/turns` 默认 limit 和上限，保证分页请求有界。
6. 将 Timeline 渲染和会话页订阅保持在最小 slice，验证长会话 DOM 和 store 预算。
7. 若出现严重回归，可回退到旧 store action 实现；服务端有界 supplement 可通过保守跳过 supplement 降级，不影响主 timeline。

## Open Questions

- rollout JSONL 是否能从 app-server 获得尾部读取或按 offset 读取能力？如果没有，第一版使用进程内缓存和按 turnId 有界扫描。
- 对缺少 itemId 的 raw response / tool supplement，是否存在更可靠的 call id 可以从现有协议字段提取？
- context usage 是否应完全脱离 rollout parse，改为只依赖 app-server summary/live `token_usage_updated` 事件和本地缓存？
