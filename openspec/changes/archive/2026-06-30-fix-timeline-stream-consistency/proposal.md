## Why

当前会话页在运行中同时依赖 WebSocket delta、`turn/start` 后立即 `readThread` snapshot、以及每 2 秒 `readThread` polling 来更新 timeline。长会话下这会反复拉取全量 timeline，性能开销高，并且 snapshot 与实时 delta 缺少幂等边界，已经导致 thinking/tool 输出重复、历史 thinking 消失、rewind/fork 后旧消息回流、发送后立刻 rewind 失败等问题。

本变更需要把运行中 timeline 从“高频全量读取 + 实时增量混合”收敛为“初始 snapshot + 单一增量事件流 + 必要时低频修复读取”，同时修复 rollback/fork 与 turn 元数据的一致性。

## What Changes

- 新增 timeline 增量事件流能力，使用 SSE 或等价单向事件流作为浏览器接收 agent/reasoning/tool/diff/system 事件的主路径。
- 运行中不再每 2 秒轮询 `/api/codex/threads/:threadId` 获取全量 timeline；`readThread` 降级为初始化、显式刷新、断线修复和 rollback/fork 返回详情使用。
- `turn/start` 不再依赖“启动 turn 后立即读取全量 thread”来驱动运行中输出；实时输出由事件流负责。
- 所有实时事件、overlay item、HTTP snapshot item 和前端 live entry 必须保留 `turnId`，必要时保留 `turnIndex` 或等价顺序信息。
- 增量事件必须具备幂等处理依据，前端重复收到同一事件或已被 snapshot 覆盖的事件时不得重复追加文本。
- rollback/fork 成功后必须 replace 服务端返回的 thread detail，并清理或忽略已删除 turns 的 overlay/live event，避免旧尾部重新出现。
- 修复 reasoning/thinking 历史与实时显示一致性，确保公开发送过的 reasoning summary/content/delta 不在刷新、完成或回滚边界中丢失。
- 保留运行中 WebSocket 能力作为实现细节选项时，行为必须满足同一事件流契约；优先实现 SSE 以降低移动端连接复杂度。

## Capabilities

### New Capabilities
- `timeline-event-stream`: 约束浏览器接收 timeline 增量事件的连接方式、事件幂等、断线恢复、snapshot 修复和旧 turn 事件忽略规则。

### Modified Capabilities
- `agent-output-rendering`: 修改 reasoning、agent message、tool、diff 等流式输出的显示一致性和重复事件处理要求。
- `thread-lifecycle`: 修改 `thread/read`、`turn/start`、rollback/fork 返回详情与 turn 元数据保留要求，限制运行中全量读取的使用场景。
- `timeline-message-actions`: 修改 rewind/fork 对实时事件、overlay 清理、可靠 turn 定位和 replace 语义的要求。
- `thread-chat-view`: 修改会话页运行中 timeline 更新策略，移除高频全量 polling，改为事件流主路径和断线修复路径。

## Impact

- 影响服务端 app-server gateway 的 notification normalize、timeline overlay、rollback/fork、readThread/startTurn API 组合方式。
- 影响前端 store 的 live entry 创建、delta 合并、幂等去重、turn 元数据保存、running 状态和 polling 策略。
- 影响 `/api/codex/turns/start`、`/api/codex/threads/:threadId`、新增或调整 `/api/codex/events` 类事件流路由。
- 影响 timeline 相关单元测试、页面测试和 app-server runtime 测试，需要补充 mixed snapshot/live/overlay、rewind/fork、重复 delta、断线恢复场景。
- 不引入桌面端布局；移动端 Web 仍是唯一目标。
