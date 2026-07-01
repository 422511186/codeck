## Why

回滚后重新发送消息时，timeline 仍可能出现同一 turn 的 reasoning 或 agent message 重复渲染；有时刷新后恢复正常，有时刷新后仍重复。这说明重复既可能来自前端 live event 与 completion/snapshot 的本地合并失败，也可能来自服务端 snapshot overlay 在刷新时重复暴露同一输出。

## What Changes

- 收紧同一 turn 内 agent/reasoning/tool 输出的稳定身份合并规则，避免 live delta、item completion、snapshot/overlay 各渲染一条。
- 修复前端 store 在 item id 不同但 turn、role、内容等价时的重复输出归并。
- 修复服务端 overlay 与 thread snapshot 合并时的等价输出去重，避免刷新后仍重复。
- 增加覆盖回滚后 resend、刷新前重复、刷新后重复的单元测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 明确同一 turn 的 live delta、completion replay 和 snapshot repair 必须合并为单一可见输出。
- `agent-output-rendering`: 明确 reasoning、tool output 和 agent message 在 item id 不完全一致但语义等价时不得重复显示。
- `timeline-message-actions`: 明确 rewind 后 resend 的新历史不能让同一 turn 的输出重复进入 timeline。

## Impact

- 影响 `src/web/state/store.ts` 的 timeline entry 归并和重复清理逻辑。
- 影响 `src/server/app-server/runtime.ts` 的 overlay 与 snapshot 合并逻辑。
- 需要补充 `web-store-events`、`app-server-runtime` 以及必要的页面/事件测试。
- 不改变用户 API，不引入新依赖。
