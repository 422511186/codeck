## Why

长会话在 live、完成态 repair 与浏览器刷新之间仍不能稳定收敛：文件修改会在实时阶段重复显示，已持久化的 command/file activity 可能在刷新后集中移动到 assistant 消息末尾，同时首屏和 repair 会通过 `/turns` 触发高成本的完整 turn 展开与重复 rollout 扫描。现有回归测试只覆盖了预先排好序的快照，没有覆盖 canonical page 已把工具放到消息末尾的真实输入。

## What Changes

- 将 item 级 file change 作为实时文件活动的 canonical identity；`turn_diff_updated` 仅作为缺少 item 级事件时的临时 fallback，同一修改不得同时渲染为 diff 与 file tool 两条活动。
- 修正 bounded page 与 rollout supplement 的锚点对账：canonical tool 已存在但位置错误时，系统必须把该 canonical item 移动到唯一 message anchor 对应的位置，而不是只消费 supplement 后保留原末尾位置。
- activity block 第一层只描述发生了哪些操作，不显示成功、失败或运行状态；具体动作行和展开详情继续保留状态与错误信息。
- 让 `/api/codex/threads/:threadId/turns` 保持真正的 item 级有界读取：避免无条件读取最近 30 个完整 turns，并避免 metadata 与 page 对同一 rollout 文件执行重复全文件扫描。
- 增加基于真实错误形态的跨层回归：双 file event、canonical tools 位于消息末尾、长 rollout 首屏/repair、完成态重试和刷新后的 activity 分组一致性。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 强化 turn diff、item file change、canonical page 与 rollout supplement 的身份、来源优先级和 message anchor 重定位规则。
- `agent-output-rendering`: 文件活动只能显示一次，刷新前后保持真实 assistant/activity 交错顺序，并将顶层 activity 摘要改为中性动作描述。
- `thread-chat-view`: 首屏和 repair 的 latest-page 读取必须在 item、turn 展开和 rollout 扫描层面都保持有界，并复用同一次恢复所需的昂贵读取。

## Impact

- app-server timeline 读取与补充：`src/server/app-server/client.ts`、`src/server/app-server/runtime.ts`、`src/server/app-server/session-timeline.ts`。
- Web live event 与 timeline engine：`src/server/app-server/events.ts`、`src/web/state/store.ts`、`src/web/state/timeline-engine.ts`、`src/web/state/timeline-adapter.ts`。
- activity 展示：`src/web/state/timeline-presentation.ts`、`src/web/components/Timeline.tsx`。
- 会话首屏与 repair 编排：`src/app/threads/[threadId]/page.tsx`、`src/app/api/codex/threads/[threadId]/turns/route.ts`。
- 不修改公开 API 路径，不修改 `docs/generated/`，不引入完整 timeline 轮询。
