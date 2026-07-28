## 1. 锁定失败回归

- [x] 1.1 在 `tests/unit/app-server-runtime.test.ts` 增加 `command A -> agent-mid -> overlay command B` 场景，先证明当前 overlay repair 会把 B 错误移动到 agent 之前，再断言修复后的 identity 顺序为 `cmd-a, agent-mid, cmd-b`。
- [x] 1.2 在 `tests/unit/app-server-session-timeline.test.ts` 增加 partial item page 与 whole-turn rollout supplement 场景，使 A/B 具有相同 tool metadata 但不同 `itemId/callId`，断言 A 不丢失且 canonical B 只出现一次。
- [x] 1.3 在 `tests/unit/web-store-events.test.ts` 增加已有 partial command/agent 输出时收到 completion event 的场景，断言仍创建 generation/turn scoped `turn-completed` repair，并覆盖 completion 与 summary idle 的去重语义。
- [x] 1.4 在 `tests/unit/web-thread-page.test.tsx` 增加 bounded repair page 场景，监测同一 payload 只能触发一次 latest-window timeline ingress，且 metadata 更新不能再次调用普通 merge。
- [x] 1.5 在 `tests/unit/web-timeline-presentation.test.ts` 与必要的 engine/adapter 邻近测试中固定可见 assistant 边界分组和 refresh 收敛断言，确保 metadata 相同但 identity 不同的 command 保持两段 activity。

## 2. 修正服务端身份与顺序归一化

- [x] 2.1 重构 `src/server/app-server/runtime.ts` 的 overlay 插入逻辑，移除“最后一条 agent 即最终回复”的 role 启发式，按强 identity、`streamSequence`、`sourceLocator` 或明确 anchor 原位更新和定位新 activity。
- [x] 2.2 为缺少可比较 anchor 的新 overlay item 实现非破坏性 fallback：保留来源内顺序且不得跨越已有可见 assistant message 搬移；保持 HistoryStamp、turn metadata 和 overlay watermark 语义。
- [x] 2.3 重构 `src/server/app-server/session-timeline.ts` 的 tool 消费逻辑，优先使用同 turn 的稳定 `item.id`、`callId`、`sourceLocator` 或唯一 message-anchor 区间做一对一匹配，移除 metadata-only 等价消费。
- [x] 2.4 对无法唯一消歧的 supplement candidates 保留独立 entries 或沿用 scoped repair-required 机制，验证 item 级 page 边界、supplement record budget 和 allowed turn window 行为不回归。
- [x] 2.5 运行 server 侧新增测试及现有 overlay、session supplement、bounded latest-page 测试，确认最终回复前 delayed activity、相同 identity 原位完成和不同 identity 独立保留均通过。

## 3. 修正完成态对账与 repair 提交

- [x] 3.1 修改 `src/web/state/store.ts` 的 completion event 处理，使当前 active turn 无论是否已有可见 partial output 都请求 `turn-completed` final reconcile，同时保留旧 turn、failed 和 interrupted 事件的归属防护。
- [x] 3.2 完善 generation/turn scoped final-reconcile 协调状态，使 completion event 与 summary idle 复用同一周期，并在成功、达到 materialization 重试上限、HistoryStamp 失效或 generation 迁移后记录终止，防止迟到信号重复启动。
- [x] 3.3 将 `src/app/threads/[threadId]/page.tsx` 的 thread metadata 应用与 timeline ingress 分离；成功 `replaceLatestWindow` 后只更新 detail/status/model/permission/context/manifest metadata，不再把同一 `page.items` 作为普通 merge 提交。
- [x] 3.4 保留现有 request token、mutation epoch、HistoryStamp、active repair token 和 materialization retry 防护，并增加断言证明 snapshot-window 后的 live `sourceOrder`、`streamSequence`、revision、suppression metadata 与 cursor 不被降级。
- [x] 3.5 运行 Web store 与 thread page 测试，确认 visible output 不再抑制 final reconcile、重复完成信号不会并发 repair、active repair 不形成轮询环。

## 4. 跨层收敛与验证

- [x] 4.1 用同一语义序列 `cmd-a -> agent-mid -> cmd-b` 串联 runtime overlay、partial page + supplement、completion reconcile、presentation 和 browser refresh 测试，断言每一层产生相同可见 identity 顺序。
- [x] 4.2 运行相关定向测试：`app-server-runtime`、`app-server-session-timeline`、`web-store-events`、`web-thread-page`、`web-timeline-engine`、`web-timeline-adapter` 和 `web-timeline-presentation`。
- [x] 4.3 运行 `npm run verify`，处理 TypeScript 严格检查和完整 Vitest 套件中的所有回归。
- [x] 4.4 运行 OpenSpec 严格校验并确认 change 为 apply-ready，检查 artifacts 未包含 `docs/generated/` 修改、完整 timeline 读取或固定短间隔 polling 方案。
