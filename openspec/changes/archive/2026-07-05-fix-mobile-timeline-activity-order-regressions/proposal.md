## Why

移动端 timeline 在真实长会话中仍可能把工具、读取、搜索等活动渲染到最终 assistant 回复之后。已有修复只调整了 repair 阶段传入 store 的数组顺序，但真实 store 会按 `createdAt` 再排序，导致顺序可能被打回。

现在需要把同类入口一次性补齐：snapshot repair、首屏读取、历史分页和服务端 overlay 都必须遵守“无可靠锚点时活动在最终 assistant 前”的既有规范，同时保留真实穿插顺序。

## What Changes

- 修复 repaired turn item activity 的 `createdAt` 语义顺序，避免 store normalize 后回退到最终回复之后。
- 修复历史分页加载时的 fallback `createdAt` 方向，避免正常 `[user, activity, agent]` 被倒排为 `[user, agent, activity]`。
- 对首屏 snapshot、startTurn 返回 thread、rewind/fork 返回 thread 等普通 snapshot 路径应用同一尾部 activity 修复。
- 修复服务端 timeline overlay 未匹配项直接追加到整个 timeline 尾部的问题，保证同 turn overlay activity 有安全插入点。
- 增加覆盖真实 store normalize、分页、overlay 的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-output-rendering`: 补充 snapshot、pagination、overlay 等历史/修复来源的 activity 顺序约束。

## Impact

- 影响前端会话页 timeline 转换与分页加载：`src/app/threads/[threadId]/page.tsx`。
- 影响前端 store 顺序归一化相关测试：`tests/unit/web-store-events.test.ts`、`tests/unit/web-thread-page.test.tsx`。
- 影响 app-server runtime overlay 合并：`src/server/app-server/runtime.ts`。
- 影响 app-server runtime 单元测试：`tests/unit/app-server-runtime.test.ts`。
