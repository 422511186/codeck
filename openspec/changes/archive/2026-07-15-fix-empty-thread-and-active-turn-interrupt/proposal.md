## Why

刚创建且尚未 materialized 的空会话会在首屏分页请求中返回 502，导致用户无法进入会话发送第一条消息；运行中会话在 metadata 缺少 `lastTurnId` 时又会丢失 active turn identity，导致中断请求返回 409。生产复测还发现 `thread/read includeTurns=false` 可能在最新 turn 已终态后继续返回 `active`，使前端永久显示“正在处理”。这些问题都来自 Web 适配层把协议允许的缺失或滞后状态当成可直接使用的权威身份。

## What Changes

- 将 app-server 对未 materialized、未加载或首条用户消息前不可分页的明确错误归一化为空的有界 timeline page。
- 新建空会话进入聊天页时保持输入区可用，不显示分页 502，也不回退到完整 timeline 读取。
- 在 gateway 中记录 `turn/start` 响应和 `turn/started` 事件提供的 active turn identity，并在完成、失败或中断后清理。
- metadata 不携带 turn identity 时保留客户端已知 active turn，禁止用 `null` 覆盖有效身份。
- 未显式传入 `turnId` 的中断请求使用 gateway 已知 active turn identity，找不到时返回稳定 409，且不得读取完整消息 timeline。
- metadata 或 summary 报告 active 时，以 `limit=1`、`itemsView=notLoaded` 的最新 turn 状态进行有界校正；终态 turn 必须停止前端运行态，`inProgress` turn 必须恢复 active identity。
- 增加真实协议形状的回归测试，覆盖空会话分页错误和 active metadata 的空 `lastTurnId`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 新建空会话的首屏分页错误必须归一化为空 timeline，输入区立即可用。
- `thread-lifecycle`: timeline 分页接口必须把明确的未 materialized 空会话表示为空页，而不是 502。
- `timeline-event-stream`: metadata 缺少 turn identity 时必须保留或解析已知 active turn，且不得全量读取消息。
- `turn-interaction`: 中断请求必须可靠解析当前 active turn，并区分无可中断 turn 的稳定冲突响应。

## Impact

- `src/server/app-server/client.ts` 的 thread timeline page 适配。
- `src/server/app-server/runtime.ts` 的 active turn identity 生命周期。
- `src/app/api/codex/turns/[threadId]/interrupt/route.ts` 的中断目标解析。
- `src/app/threads/[threadId]/page.tsx` 的 metadata 状态合并。
- client、runtime、route 和 thread page 单元测试。
