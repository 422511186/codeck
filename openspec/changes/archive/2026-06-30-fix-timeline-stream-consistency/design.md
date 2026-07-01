## Context

当前移动 Web 会话页存在三条并行 timeline 更新路径：

- 首屏或显式进入会话时调用 `readThread` 获取完整 snapshot。
- `turn/start` API 在启动 turn 后立即再次 `readThread`，把 thread detail 返回给前端。
- thread 处于 running 时，前端每隔一段时间继续 `readThread` 并 merge；同时 WebSocket 也在推送 delta。

这种结构把“历史快照”和“运行中增量”混在一起。它可以短期避免实时事件丢失，但在长会话中会反复传输全量 timeline，并且在 snapshot 与 delta 乱序时缺少幂等边界。实际问题包括：agent/reasoning/tool 文本重复追加、历史 thinking 刷新后消失、rollback 后旧 overlay 回流、发送后立刻 rewind 因缺少 turn 元数据失败。

本项目只面向移动端 Web，因此实时链路应优先考虑移动浏览器的连接稳定性、自动重连和低流量。SSE 适合 server-to-browser 的 timeline 增量推送；用户发送、审批、interrupt、rewind/fork 仍继续走 HTTP POST。

## Goals / Non-Goals

**Goals:**

- 用单一 timeline 增量事件流承载运行中 agent/reasoning/tool/diff/system 输出。
- 移除运行中高频全量 `readThread` polling，降低长会话网络和服务端转换开销。
- 让所有实时事件、overlay、snapshot、前端 live entry 都携带可靠 turn 元数据。
- 为增量事件引入幂等处理依据，避免 snapshot 与 delta 或重连补发造成重复文本。
- rollback/fork 后彻底切断已删除 turns 的旧 overlay 和 late event，确保 UI 与服务端 history 一致。
- 保持 `readThread` 作为初始化、显式修复、断线缺口恢复、rollback/fork 返回详情的 snapshot API。

**Non-Goals:**

- 不实现桌面端布局。
- 不实现工作区文件变更回滚；thread rollback 仍只回滚对话 history。
- 不引入完整分支树 UI。
- 不要求一次性删除 WebSocket 基础设施；如果保留 WebSocket，也必须服从同一事件流契约。
- 不伪造模型未公开发送的隐藏 reasoning，只展示 app-server 公开发送的 summary/content/delta。

## Decisions

### 1. 事件流作为运行中主路径，snapshot 作为初始化和修复路径

选择：运行中 timeline 不再通过定时 `readThread` 获取完整 snapshot。页面进入时读取一次 snapshot，之后由事件流更新；只有事件流断线、发现事件缺口、显式刷新、rollback/fork 返回详情时才使用 snapshot replace。

理由：全量 timeline 越长成本越高，且与 delta 并行时天然存在重复和乱序。把 snapshot 降级为修复路径后，数据流更容易推理。

替代方案：保留 polling 并优化 merge。该方案仍会持续传输全量 timeline，且需要复杂 merge 才能避免旧尾部残留，不适合作为主路径。

### 2. 优先使用 SSE，但规范约束的是事件契约

选择：新增 `/api/codex/events` 类 SSE endpoint，浏览器通过 `EventSource` 接收 timeline event。事件流实现必须支持 `Last-Event-ID` 或等价恢复机制。

理由：timeline 输出是单向 server-to-browser，SSE 自带重连和 last event id，移动浏览器实现简单。用户输入和控制命令本来就适合 HTTP POST。

替代方案：继续使用 WebSocket。WebSocket 仍可作为底层实现，但必须补齐 event id、turn 元数据、幂等和断线恢复；否则只是保留现有问题。

### 3. 每个可见事件都携带稳定身份和 turn 元数据

选择：事件至少包含 `eventId`、`threadId`、`turnId`、`itemId`、`kind`、`createdAt` 或等价顺序字段。delta 事件还应有 `seq`、`offset`、`revision` 或可验证的幂等身份。

理由：rewind/fork 依赖 turn 定位；重复输出的根因是同一内容缺少幂等边界。只靠 `itemId` 和字符串追加不足以处理重连补发、HTTP snapshot 覆盖、late delta。

替代方案：只在前端按文本长度去重。该方案对相同前缀、编辑型更新、工具输出重复片段不可靠。

### 4. overlay 必须和 thread history 同步生命周期

选择：服务端 overlay item 本体必须带 `turnId`，替换 base item 时保留 base 元数据；rollback/fork/interrupt 等删除或终止 turn 的操作必须清理对应 overlay，或记录 tombstone 使后续 late event 被忽略。

理由：overlay 是 read snapshot 的补丁层。如果它的生命周期长于 thread history，就会把已删除的旧 turn 重新追加回来。

替代方案：只在前端过滤旧 entry。该方案无法阻止后续 `readThread` 或新页面再次收到污染后的 snapshot。

### 5. rollback/fork 后严格 replace，不使用回滚前本地 entries 兜底

选择：消息级 rollback/fork 成功后，前端必须直接用服务端返回的 thread detail replace。目标 user message 文本只用于回填 draft，不得把回滚前本地 timeline 切片写回当前 thread。

理由：回滚前本地 entries 可能已经混入重复 delta、旧 overlay 或缺失 turn 元数据。把它作为 fallback 会破坏服务端 history 的权威性。

替代方案：本地按 turn 截断以获得更快 UI。该方案要求本地 turn 元数据完全可靠，而当前缺陷正来自元数据不可靠。

## Risks / Trade-offs

- [Risk] SSE 在部分代理或部署环境被缓冲，导致增量不实时。→ Mitigation：事件 endpoint 设置 `text/event-stream`、禁用缓存和代理 buffering，并保留断线 snapshot 修复。
- [Risk] 事件补发缓存过小导致断线后无法完整恢复。→ Mitigation：服务端返回 gap 信号或前端检测 `Last-Event-ID` 不可恢复时执行一次 `readThread` replace。
- [Risk] 事件 id/seq 设计不当仍会重复或丢事件。→ Mitigation：以单元测试覆盖重复事件、乱序事件、snapshot 后 late delta、重连补发。
- [Risk] 移除 polling 后实时事件归一化缺口会更明显。→ Mitigation：补齐 agent/reasoning/tool/diff/raw response 事件规范化测试，未知可见事件必须落到 generic card。
- [Risk] rollback 后 late event 仍可能从 app-server 到达。→ Mitigation：服务端和前端都维护 per-thread deleted turn tombstone/revision，旧 turn event 必须被忽略。

## Migration Plan

1. 先补测试描述当前缺陷：live/overlay item 缺 turnId、重复 delta、rollback 后 overlay 回流、running polling 全量读取。
2. 增加事件流契约和 SSE endpoint，同时保留现有 WebSocket 作为过渡。
3. 调整前端 store，使 live entries 持久保留 turn 元数据并按 event id/seq 幂等处理。
4. 调整 `turn/start` 和会话页 running 更新策略，停止依赖运行中高频 `readThread`。
5. 调整 overlay 与 rollback/fork 生命周期，确保已删除 turns 不再通过 overlay 或 late event 回流。
6. 在测试确认 SSE 主路径稳定后，移除或降级旧 polling fallback。

## Open Questions

- 事件补发缓存保存在 app-server gateway 内存即可，还是需要持久化到 thread detail 附近以跨进程恢复？
- `eventId` 是否直接使用 app-server notification id；若上游没有稳定 id，是否由 gateway 按 thread 生成单调 revision？
- 是否保留 WebSocket endpoint 供开发工具或兼容旧客户端使用，还是在本次变更中完全切到 SSE？
