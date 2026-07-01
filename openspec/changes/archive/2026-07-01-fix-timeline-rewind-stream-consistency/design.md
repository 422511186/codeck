## Context

当前移动端会话页由 HTTP 控制动作、SSE timeline event stream、前端 Zustand store、服务端 app-server overlay 共同维护 timeline。问题出现在多个来源同时更新同一 thread 时：`turn/start` 只返回 `turnId`，本地 optimistic user message 没有回填 turn 元数据；snapshot repair 与补发 delta 没有统一 offset/revision 规则；rollback/fork 只按已删除 `turnId` 屏蔽 late event，没有完整的新旧历史 generation；输入框草稿由 `ChatInput` 内部 state 管理，父组件写 localStorage 不会即时反映到当前输入框。

本设计以“每个 timeline entry 必须有稳定身份、turn 归属和历史 generation”为核心，修复发送、流式输出、snapshot repair、rewind/fork 的一致性。

## Goals / Non-Goals

**Goals:**

- 新发送的 user message 在 `turn/start` 成功后立即获得 `turnId`，无需刷新即可 rewind/fork。
- rewind/fork 成功后当前页面 timeline、输入框草稿、事件去重状态、旧 overlay 状态保持一致。
- snapshot repair、SSE replay、completion item 和 live delta 之间幂等，不重复拼接文本。
- rollback/fork 后旧历史中的 late event、replay backlog 和 overlay 不会重新显示已删除尾部。
- 同一 turn 内 user message 先于 agent/reasoning/tool/diff 显示，补发或 completion 不改变语义顺序。

**Non-Goals:**

- 不回滚 agent 已写入本地工作区的文件变更。
- 不重做 app-server 协议，只在 Web adapter 层补充浏览器所需的稳定元数据。
- 不引入数据库或持久化事件存储，事件 backlog 仍是当前进程内存窗口。
- 不改变桌面布局；本项目仍只面向移动端 Web。

## Decisions

1. 使用 thread history generation 作为 rollback/fork 屏障。

   服务端 gateway 为每个 thread 维护 `timelineGeneration`。普通事件沿用当前 generation；rollback 成功、新 fork 初始化、repair 判定历史被替换时 generation 递增。浏览器事件携带 `generation`，前端 thread state 记录当前 generation。低于当前 generation 的可见事件 MUST 被忽略。

   备选方案是只用 `deletedTurnIds`。该方案已经存在，但只能处理携带旧 `turnId` 的事件；无法处理 backlog 重放、item id 复用、缺失 turnId 或新旧历史交错，因此不够可靠。

2. `turn/start` 成功后把 `turnId` 写回 optimistic user message。

   前端发送时继续先插入 local user entry。`startTurn` 返回后，按 `clientUserMessageId` 找到本地 entry，将其标记为 sent 并补上 `turnId`，同时记录该 turn 的本地 user entry id。后续 server user item 到达时，用该映射替换本地 entry 的 id/metadata，而不是删除后追加。

   备选方案是让 `turn/start` 返回完整 thread snapshot。该方案会引入额外 read、增加与 live delta 的竞态，并且文档已要求不依赖 full-timeline polling 作为实时主路径。

3. 将输入框草稿提升为受控或可命令更新状态。

   `ThreadPage` 在 rewind/fork 成功后需要即时设置当前输入框文本。实现上可给 `ChatInput` 增加 `draftOverride`/`draftVersion` 或 store action；关键是不能只写 localStorage。

   备选方案是刷新页面或重新挂载 `ChatInput`。这会破坏移动端连续编辑体验，也不符合“回滚后回填输入框”的需求。

4. snapshot repair 使用 replace 语义，并重建 delta suppression offset。

   repair 后 timeline 以服务端 snapshot 为准，清理旧尾部、旧 pending local entry、旧 item revision。对 snapshot 已包含的 item 文本，前端记录已覆盖文本和当前本地 item 文本长度；后到 delta 只有在能按 offset 证明是新尾部时才追加，否则忽略或触发下一次 repair。

   备选方案是继续用简单 prefix suppression。该方案在补发从中段开始时会重复拼接。

5. 同一 turn 的排序由 turn order + role rank + item order 决定。

   timeline entry 除 `createdAt` 外，需要保留 `turnIndex`、`turnId`、可选 `itemIndex` 或稳定 role rank。server user item 确认本地 user 时必须原位替换；agent/reasoning/tool/diff completion 也原位更新，不追加到错误位置。

   备选方案是完全按事件到达顺序追加。它会在 agent delta 先到、user item 后到时显示 agent 在用户之前。

## Risks / Trade-offs

- [Risk] app-server 不提供原生 generation。→ Mitigation: Web gateway 维护浏览器侧 generation，并在 rollback/fork/read repair 返回时明确推进。
- [Risk] 旧事件缺少 `turnId`，无法按 deleted turn 屏蔽。→ Mitigation: 低 generation 直接丢弃；缺少 turn 元数据的可见事件不得参与 message action。
- [Risk] repair replace 可能短暂移除尚未 materialized 的 live delta。→ Mitigation: 仅在 gap/rollback/fork 后使用 replace；正常 running snapshot 仍按受控 merge，但必须遵守 generation 和 offset 规则。
- [Risk] 本地 user 与服务端 user 文本相同但不是同一次发送。→ Mitigation: 优先使用 `clientUserMessageId` / turnId 映射；文本匹配只能作为最后 fallback，并且不得跨 turn 合并。
- [Risk] backlog 是内存窗口，长时间断线仍会 gap。→ Mitigation: gap 时执行 snapshot repair，并把 repair 结果作为新的 generation 基线。

