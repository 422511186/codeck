## Context

`fix-thread-status-compact-lifecycle` 已把 app-server `thread/status/changed` 接入浏览器事件流，并让 store 用真实 thread status 更新 `running` 和 compact 可用性。当前 `idle` status 事件会清理 `activeTurnId`，但不会调用 turn lifecycle 的 timeline 收尾逻辑。

这会留下一个边界缺陷：如果 `turn_completed` 丢失、延迟或被重连窗口跳过，而 `thread_status_changed: idle` 先到达，页面会停止 processing，但 timeline 内的 pending reasoning、running tool 或 command entry 仍保持未完成状态。用户看到的 thread 状态和 timeline 活动状态不一致。

## Goals / Non-Goals

**Goals:**

- 让可信 `thread_status_changed: idle` 在存在已知 active turn 时收尾该 turn 的 live timeline activity。
- 复用现有 `finishLiveTurnEntries` 和 `removeEmptyPendingReasoningEntry` 语义，避免新增并行状态机。
- 保持 status event 仍为 thread-level 事件，不追加可见 timeline item，不参与 rewind/fork turn 计数。
- 避免仅因 status event 触发完整 timeline repair；缺内容 repair 仍由 turn completion、summary idle 或明确 gap 负责。

**Non-Goals:**

- 不重做 timeline entry 归并、排序或渲染组件。
- 不修改 app-server 事件协议。
- 不把未知 active turn 的 idle status 猜测成某个 turn completion。
- 不改变 compact 完成消息来源。

## Decisions

1. **status idle 对已知 active turn 执行轻量收尾**

   store 在处理 `thread_status_changed` 前读取当前 `activeTurnId`。当新状态为 `idle` 且存在 active turn 时，先对该 turn 调用 `finishLiveTurnEntries(threadId, activeTurnId, "completed")`，再移除空 pending reasoning，最后更新 thread status 为 `idle`。

   备选方案是只清 `running`，保留 timeline 活动等待后续 `turn_completed`。该方案正是当前缺陷来源，无法覆盖 status 先到或 completion 缺失。

2. **不为 status idle 触发 snapshot repair**

   status event 只证明 thread 已空闲，不证明某个 turn 的完整输出已可用。若没有可见 assistant 输出，是否需要 repair 仍交给已有 `turn_completed` 和 summary idle 路径。这样避免一个频繁 thread-level 状态事件重新引入完整 timeline polling。

   备选方案是 status idle 直接 request repair。该方案恢复内容更激进，但会扩大行为面并违反前一变更“不因 status event 做完整 timeline repair”的约束。

3. **未知 active turn 不猜测收尾**

   如果 store 没有 active turn id，`idle` status 只更新 thread status。没有 turn id 时强行结束某个 entry 会污染 rewind/fork 元数据，也可能错误结束非当前 turn 的活动。

## Risks / Trade-offs

- [Risk] `idle` status 早于最后一个 visible completion 到达，先把 running tool 标成 completed，后续 completion 又更新同一 entry。→ Mitigation：复用现有 item revision、entry merge 和 event id 幂等规则；状态从 running 到 completed 后仍允许同 item 内容合并。
- [Risk] active turn id 丢失时仍可能有 running entry 残留。→ Mitigation：不猜测 turn；该情况保留给 summary idle repair 或后续 turn lifecycle event。
- [Risk] 将 interrupted 或 failed turn 统一标 completed 可能不够精确。→ Mitigation：`thread/status/changed` 只携带 thread status，不携带 turn 结束原因；本修复只表示 live activity 已结束，不替代有明确状态的 turn lifecycle event。
