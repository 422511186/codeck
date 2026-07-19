## Why

app-server 在 Responses 上游短暂返回 503 时会发送 `error` 通知并设置 `willRetry=true`。当前 Web 同时把这类临时状态写入前端 timeline 和服务端 runtime overlay，但 turn 成功后没有清理。用户会看到已经成功的请求仍显示“操作失败”；刷新页面时，残留 overlay 因无法锚定为 inline activity 被追加到 timeline 最底部。

## What Changes

- 明确区分可重试中的临时 turn error 与最终 turn failure。
- `willRetry=true` 的错误只作为当前 turn 的临时状态，不得成为持久错误卡片。
- turn 成功完成后，前端 store 和服务端 runtime overlay 都必须清理该 turn 的临时错误。
- `willRetry=false` 的最终错误继续保留错误卡片、失败用户消息和显式重试路径。
- 增加实时事件、刷新恢复和最终失败的回归测试。
- 移除单元测试对宿主平台、固定临时目录、开发机环境变量和进程包装形式的依赖，确保验证可在不同电脑上复现。

## Capabilities

### Modified Capabilities

- `timeline-event-stream`：临时重试错误必须在成功终态收敛，不得污染刷新后的 timeline。
- `turn-interaction`：上游内部重试成功时不得把一次发送呈现为最终失败。

### New Capabilities

- `test-runtime-portability`：单元测试必须使用受控输入和跨平台不变量，不得绑定执行机器信息。

## Impact

- 影响 `src/server/app-server/runtime.ts` 的 timeline overlay 生命周期。
- 影响 `src/web/state/store.ts` 的 turn lifecycle 事件处理。
- 增加 `tests/unit/web-store-events.test.ts` 与服务端 runtime 相关回归测试。
- 不改变 app-server 503 重试策略，也不改变最终失败的显式重试语义。
- 影响测试脚本和三个既有跨平台断言，不改变对应生产行为。
