## Context

timeline 当前由三类数据源共同更新：首屏/repair `readThread` snapshot、浏览器 SSE event stream、用户 send/rewind/fork 等 HTTP 控制动作。最近的修复已经移除了 running polling，并引入 generation、deleted turn barrier、snapshot delta suppression 和本地 mutation epoch，但这些机制仍有边界竞态：

- `EventSource` 是全局 singleton，页面 effect cleanup 只取消 listener，不关闭连接；listener 空窗中浏览器仍会消费消息。
- `timeline-gap` 只携带 `lastEventId`，store 无法确定应修复哪个 thread。
- repair 请求返回时如果本地 epoch 已变化，会被忽略并清掉 repair 标记，导致已确认缺口不再修。
- item revision / snapshot suppression 以 item id 为主键，generation 切换后仍可能沿用旧历史状态。
- rollback barrier 接收客户端 `expectedDeletedTurnIds`，服务端没有验证这些 turn 是否真被 rollback 删除。

## Goals / Non-Goals

**Goals:**

- 事件流订阅切换期间不静默丢弃可见 timeline event。
- gap repair 精确作用到缺口所属 thread；无法确定时采用显式安全策略。
- repair 与本地 mutation 串行化时，不覆盖新状态，也不丢弃已确认的 repair 需求。
- generation 切换后，新历史的同 item id 输出不会被旧 revision/suppression 误抑制。
- rollback deleted turn barrier 只来自服务端验证后的实际删除尾部范围。
- 为上述场景补充可回归的单元测试。

**Non-Goals:**

- 不恢复 running 状态下的完整 thread polling。
- 不改变移动端 UI 布局或新增桌面端布局。
- 不引入新传输协议；SSE 仍是浏览器主事件流。
- 不改变用户可见的 rewind/fork 交互入口。

## Decisions

1. **EventSource listener 空窗使用客户端缓冲，而不是每次 cleanup 都关闭底层连接。**  
   现有 singleton 的价值是跨页面共享同一条 SSE 连接，减少重连抖动。实现上在 `TimelineEventStreamClient` 内部维护有限大小的 pending event buffer：当收到 message 但没有 listener 时先缓存；新增 listener 时同步 flush。这样不会依赖 React effect 的订阅时序，也不会因为短暂 pathname 切换产生连接风暴。若缓冲溢出，客户端必须发出 `timeline-gap` 或等价 repair 信号。

2. **gap 事件增加 threadId，客户端只在 threadId 明确时修对应 thread。**  
   服务端可以从 backlog 中缺失的 `lastEventId` 或事件 id 前缀解析 thread id；解析失败时发送不带 threadId 的 gap。客户端收到无 threadId gap 时不得默认修 active thread；应触发全局安全降级，例如只标记连接状态或为 active thread 以外不做破坏性 replace。当前实现优先修复可解析 thread。

3. **repair stale 时保留 repair 请求，等待下一轮稳定 epoch。**  
   mutation epoch 仍用于阻止旧 snapshot 覆盖新状态。但当 repair 已由 confirmed gap 触发，旧 repair 返回时如果 epoch 已变化，应重新标记 repair 或保持 `repairRequestedAt`，由 effect 在新 epoch 下再读一次。只有成功应用 snapshot 或明确不再需要时才清除 repair。

4. **幂等状态按 generation 隔离。**  
   `itemRevisions` 需要记录 item id 对应 generation 下的最高 revision；generation 切换后旧 generation 的 revision 不能压制新 generation 的 delta。snapshot suppression 同样应只抑制 snapshotSequence 覆盖的旧事件，遇到 generation 不匹配或 sequence 超出覆盖窗口时移除 suppression。

5. **服务端校验 rollback expectedDeletedTurnIds。**  
   `expectedDeletedTurnIds` 只能作为客户端提供的“live overlay tail 提示”，不能直接信任。服务端应读取 rollback 前后 timeline 的 turn 集合，并只接受实际在 rollback 后不存在、且属于 rollback 尾部范围或 before snapshot 不可见但在 overlay/deleted hint 中可验证的 turn。非法 id 不得进入 deleted barrier。

6. **mutation epoch bump 延后到实际 mutation 边界。**  
   rewind/fork 先做本地 target 解析；解析失败只显示错误，不 bump epoch。只有即将调用 rollback/fork rollback 或追加 send optimistic entry 时才 bump，减少误杀首屏/repair snapshot 的窗口。

## Risks / Trade-offs

- [Risk] listener 空窗缓冲可能增长。→ Mitigation：限制缓冲大小，溢出时触发 gap repair；只缓存解析成功的 timeline event。
- [Risk] 从 eventId 解析 threadId 依赖当前 fallback id 格式。→ Mitigation：优先使用事件自身 `threadId`；缺失时才解析 fallback id，解析失败不盲目 repair。
- [Risk] 保留 stale repair 可能造成连续 readThread。→ Mitigation：用 request token/epoch 控制同一 repair 只并发一个请求，stale 后仅重新排队一次当前缺口。
- [Risk] generation-scoped revision 可能让同一 generation 的旧 delta 保护不足。→ Mitigation：同 generation 内仍保留现有 revision 和 eventId 幂等规则。
- [Risk] 服务端严格校验 expected ids 可能不再屏蔽某些未 materialized live turn。→ Mitigation：结合 overlay 中已知 turn id 作为可验证来源，保留 live turn rollback barrier。
