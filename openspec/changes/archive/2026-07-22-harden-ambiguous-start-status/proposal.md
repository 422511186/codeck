# 收紧未知发送结果期间的线程状态

## Why

页面在 `turn/start` 已发出但响应结果未知时，会把 optimistic 消息标记为 `ambiguous`，随后却无条件将线程状态改为 `idle`。如果 app-server 实际已经创建 turn，输入区会在权威状态收敛前重新开放，用户可以用新的消息身份再次发送，造成并发 turn、重复执行或 Timeline 与真实任务状态短暂分叉。

## What Changes

- 未知结果的发送失败保留线程的 active/running 状态，不立即切换为 idle。
- 只有确认没有调用 `turn/start` 的 rejection，或权威 summary/事件确认线程已 idle，才能开放新的发送。
- 保留 ambiguous 消息原有 identity，使用户可以继续重试同一发送动作；现有 summary 轮询负责最终收敛。
- 增加页面回归测试，覆盖 ambiguous 与 confirmed rejection 的状态差异。

## Capabilities

### Modified Capabilities

- `turn-interaction`: 明确未知 start 结果期间客户端必须 fail-closed，不能以 idle 状态允许新的发送动作。

## Impact

- `src/app/threads/[threadId]/page.tsx` 的发送错误状态处理。
- `tests/unit/web-thread-page.test.tsx` 的发送状态回归测试。
- 不改变 API、app-server 协议或已确认拒绝的重试 identity 规则。
