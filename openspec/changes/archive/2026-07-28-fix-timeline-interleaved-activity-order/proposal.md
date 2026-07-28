## Why

运行中的同一 turn 若出现“command 工具 / assistant 文字 / command 工具”的交错输出，后到工具可能被错误移动到前一个工具旁并在 activity 聚合后看似消失；完成态 repair 与刷新路径还可能无法把该错误状态稳定收敛为权威顺序。该缺陷会让用户误判工具是否执行、执行顺序和消息是否完整，需要统一 live、overlay、分页补全与最终对账的身份和顺序语义。

## What Changes

- 保留同一 turn 内工具与 assistant 文字的真实交错顺序，runtime overlay 不得把后到工具跨过中途 assistant 条目移动到前方。
- 使用强 identity 与明确位置 anchor 合并 bounded item page、runtime overlay 和 rollout supplement；不得仅凭 `turnId + tool metadata` 将两个不同工具视为同一项。
- 在收到 turn completion 或权威 summary 确认 active turn 进入 idle 后，为该 generation 执行一次 bounded final reconcile，即使 timeline 已存在 partial agent 或 tool 输出。
- 让一次 repair page 只经过一次权威窗口提交，保留已接收 live entry 的 stream metadata、watermark 与稳定顺序，避免随后重复 merge 降级状态。
- 增加覆盖 live 交错输出、partial page、overlay/supplement、completion reconcile 与浏览器刷新收敛结果的跨层回归 fixture。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 强化 live、overlay、pagination、supplement 与 repair 的跨来源身份、位置和最终对账要求。
- `agent-output-rendering`: 明确不同工具 identity 必须独立保留，并按真实 assistant/tool 交错顺序展示和聚合。
- `thread-chat-view`: 明确完成态 exactly-once bounded final reconcile 以及 repair 单次提交后的刷新收敛行为。

## Impact

- app-server timeline page 与 runtime overlay 修复：`src/server/app-server/runtime.ts`、`src/server/app-server/session-timeline.ts`、`src/server/app-server/client.ts`。
- Web timeline 对账与页面 repair 编排：`src/web/state/store.ts`、`src/app/threads/[threadId]/page.tsx`。
- Timeline adapter/presentation 仅需验证聚合结果，不通过展示层重排掩盖上游 identity 或 order 错误。
- 补充 server runtime、session timeline、Web store、页面 repair 和展示层的单元及跨层回归测试。
- 不改变公开 API，不引入新的全量 timeline 读取或固定短间隔轮询。
