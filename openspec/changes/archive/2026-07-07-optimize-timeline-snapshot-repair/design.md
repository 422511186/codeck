## Context

会话页的实时 timeline 主路径已经是 `/api/codex/events` 事件流，`/api/codex/threads/:threadId` 只应该承担首屏 snapshot 和缺口修复。当前实现中，`repairRequestedAt` effect 会调用 `codex.readThread(threadId)`，并在 repair 结果仍为 active 时再次调用 `scheduleStartedTurnRepair(td.lastTurnId, false)`。由于 `false` 会绕过“已有可见输出就停止”的检查，running thread 可能每 2.5 秒重复读取完整 thread detail。

该读取路径成本较高：服务端会读取 thread metadata、最近 turns、目标 turn items，并在上下文窗口进度功能中读取 rollout JSONL 恢复历史 token 用量。长会话和持续输出场景下，短周期重复 repair 会造成移动端渲染、服务端 IO 和 app-server 请求压力。

## Goals / Non-Goals

**Goals:**
- 正常 running 输出只由 timeline event stream 驱动，不再由短周期 full-detail polling 驱动。
- snapshot repair 保持可用，但必须由明确缺口、完成时缺少可见输出、或发送后短暂无输出等具体条件触发。
- repair 成功应用后即清除 repair 标记并回到 event stream 主路径；active 状态本身不得触发下一次 full-detail repair。
- 保留 epoch 串行化：旧 repair 返回时不能覆盖较新的本地 send/rewind/fork 状态，必要时可重新排队一次修复。
- 用测试覆盖当前回归点，防止再次把 active repair fallback 写成固定轮询。

**Non-Goals:**
- 不新增服务端轻量 status endpoint。
- 不重写 SSE/EventSource 重连协议。
- 不改变首屏 `readThread`、向上历史分页、turn item 补全和上下文窗口进度恢复的数据语义。
- 不处理独立的 timeline 渲染窗口化或 Markdown 性能问题。

## Decisions

1. **repair 成功后不因 active 状态自循环**

   当前 repair effect 在 `td.status` 仍 active 时调用 `scheduleStartedTurnRepair(td.lastTurnId, false)`。实现阶段应移除该自循环，或改为只在没有任何可见服务端输出且未对该 turn 执行过 fallback repair 时才允许一次性兜底。推荐直接移除 repair 后的 active follow-up，因为 running 输出应由事件流继续提供。

   备选方案是保留 timer 但做指数退避和最大次数限制。该方案复杂度更高，仍会在事件流正常但输出慢的场景制造 full-detail 请求，本轮不采用。

2. **保留发送后短暂无输出的一次性兜底**

   `startTurn` 返回没有 thread snapshot 时，页面仍可设置 2.5 秒 timer。如果该 turn 在 timer 触发前已经有 agent、reasoning、tool、command、diff 或 error 等可见服务端输出，则不发起 repair。如果没有可见输出，可发起一次 repair 用于恢复可能丢失的首个输出或状态。

   该兜底只用于“开始后长时间无任何可见服务端输出”的异常窗口，不应在 repair 结果 active 后自动延续。

3. **只由新证据重新排队 repair**

   `repairRequestedAt` 应继续由 `timeline-gap`、turn completed 但缺少可见输出、或 epoch mismatch 后的确认缺口触发。repair 成功应用后必须清除标记；后续只有新的 gap、完成缺输出或本地 mutation 导致的旧 repair 无法应用，才能重新设置 repair 标记。

   这保留了“confirmed snapshot repair is not lost across local mutations”的既有语义，同时避免 timer 自行生成无穷 repair 请求。

4. **测试以请求次数和 timer 行为作为契约**

   需要更新现有两个期望“active repair 后继续 fallback”的测试，改为验证不会继续调用 `requestSnapshotRepair`。新增测试覆盖：
   - repair 返回 active 且只有 user message 时，不安排下一次 full-detail repair；
   - repair 返回 active 且已有部分 agent 输出时，不安排下一次 full-detail repair；
   - startTurn 后没有可见输出时仍允许一次 repair；
   - startTurn 后已有可见输出时不 repair；
   - timeline-gap 仍触发一次 repair 并成功清理标记。

## Risks / Trade-offs

- **Risk: 某些 app-server 事件缺失时不再持续补全 running 输出** → 保留发送后一次性无输出兜底、turn completed 缺输出 repair、timeline-gap repair；如果事件流确实持续丢事件，应通过 gap/reconnect 机制暴露，而不是靠 full-detail 轮询掩盖。
- **Risk: active snapshot 仍无输出时用户短时间看不到进展** → UI 已有 running 状态和 pending reasoning；后续 live delta 或完成事件会更新。若完成后仍缺输出，会触发完成缺输出 repair。
- **Risk: 移除循环后隐藏真实 SSE 断线问题** → 离线 banner 和 EventSource reconnect 状态仍存在；后续可单独增加连接健康观测，但不在本 change 中扩大范围。
- **Trade-off: 不新增轻量接口** → 本轮实现成本低、风险小；如果后续仍需要运行中状态兜底，可以另起 change 设计只读 last-turn/status endpoint。

## Migration Plan

1. 先修改测试，确认当前 active repair 自循环会导致测试失败。
2. 移除或收紧 repair 后 active follow-up timer。
3. 保留原有 gap、完成缺输出和发送后无输出的一次性 repair 入口。
4. 跑会话页测试、store 事件测试、typecheck 和完整测试。
5. 部署后观察浏览器 Network：running 期间应只保留 `/api/codex/events` 和控制 API，请求 `/api/codex/threads/:threadId` 应限于首屏或明确 repair。

## Open Questions

- 是否需要在后续 change 中加入开发模式日志或测试 hook，直接统计每个 thread 的 repair 原因与次数？当前 change 先通过单元测试约束行为。
