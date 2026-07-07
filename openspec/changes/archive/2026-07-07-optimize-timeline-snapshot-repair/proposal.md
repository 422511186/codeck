## Why

当前会话页在 snapshot repair 后如果 thread 仍处于 running，可能继续以 2.5 秒短间隔请求 `/api/codex/threads/:threadId`。该接口会读取最近 turns、补充 turn items，并可能读取 rollout JSONL 恢复上下文用量；在长会话或持续输出场景中，这会把兜底修复变成高成本全量 timeline 轮询。

本变更用于把 timeline 更新重新收敛到 event stream 主路径，只在确认缺口或必要兜底时执行有界、非循环的 snapshot repair，避免移动端和服务端在 running 期间反复处理完整 thread detail。

## What Changes

- 移除 repaired snapshot 仍为 active 时自动重新安排全量 `readThread` repair 的短周期循环。
- 保留初始 snapshot、明确 `timeline-gap`、完成事件缺少可见输出等必要修复入口，但每次修复完成后必须回到 event stream 主路径。
- 为 snapshot repair 引入更明确的触发边界、去重和重试限制，避免同一 running turn 在事件流正常时反复读取完整 timeline。
- 补充测试，验证 running 期间不会因为 active snapshot 或已有部分输出而重复全量读取 `/api/codex/threads/:threadId`。
- 保持现有首屏、重连缺口、epoch 串行化、turn item 补全和上下文窗口百分比恢复能力。

## Capabilities

### New Capabilities
- 无。

### Modified Capabilities
- `thread-chat-view`: 收紧会话页 running timeline 与 snapshot repair 行为，禁止把 repair 兜底变成固定短周期全量 detail 轮询。

## Impact

- 前端会话页：`src/app/threads/[threadId]/page.tsx` 的 repair timer、`repairRequestedAt` effect、发送后兜底和相关 helper。
- 前端状态：可能需要调整 `src/web/state/store.ts` 中 repair 标记的触发/清理语义，确保 gap repair 仍可恢复且不会被静默丢失。
- API 使用模式：正常 running 输出继续依赖 `/api/codex/events`，`/api/codex/threads/:threadId` 仅用于初始 snapshot 和确认缺口后的有界 repair。
- 测试：更新 `tests/unit/web-thread-page.test.tsx` 中当前要求继续 repair fallback 的用例，增加防止重复 full-detail polling 的回归测试。
- OpenSpec：修改 `thread-chat-view` 需求，明确 repair 不得在事件流正常时形成周期性全量读取。
