## Why

当前会话页存在多套线程状态来源：app-server 真实 `ThreadStatus`、前端 store 的 `running`、页面本地 `detail.status`。当压缩上下文失败、SSE 漏掉状态变化或 summary 轮询停止后，UI 会出现“刷新后才恢复”“当前状态不可压缩”“仍显示正在处理”等状态卡死问题，影响会话继续使用。

## What Changes

- 将 app-server 的 `thread/status/changed` 通知纳入浏览器 event stream，作为线程运行状态、可压缩性和输入/停止态判断的实时状态来源。
- 统一会话页状态模型，避免 `detail.status` 与 store `running` 分裂；summary 兜底读取和 status 事件都必须能同步当前页面状态。
- 修复手动压缩上下文生命周期：请求 pending、成功启动、失败、完成事件、非 idle 拒绝、`notLoaded/systemError` 恢复路径都需要明确 UI 反馈和状态收尾。
- 保留 `readThread` 作为初始化和 repair snapshot，不把完整 timeline polling 重新引入运行中主路径。
- 保留并使用 JSON-RPC/app-server 结构化错误信息，避免 compact 失败分类依赖错误消息正则。
- 补充覆盖上述状态链路的单元测试和必要集成测试，防止再次退化为刷新兜底。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `timeline-event-stream`: 增加 thread status changed 事件语义，并要求客户端实时应用状态事件。
- `thread-chat-view`: 修正会话页 compact 入口、进行中状态、失败反馈和本地状态同步要求。
- `thread-controls`: 修正头部抽屉中的压缩上下文控制语义，覆盖非 idle、恢复后重试和完成状态。
- `thread-lifecycle`: 修正 compact 后端错误分类、非 idle 拒绝、结构化错误保留和审计/诊断要求。

## Impact

- 前端：`src/app/threads/[threadId]/page.tsx`、`src/web/state/store.ts`、`src/web/events/client.ts`、相关 timeline/compact 测试。
- 服务端：`src/server/app-server/events.ts`、`src/server/app-server/runtime.ts`、`src/server/app-server/json-rpc.ts`、`src/app/api/codex/threads/[threadId]/compact/route.ts`。
- API/协议：浏览器事件流新增或恢复 `thread_status_changed` 等价事件；compact route 应继续返回现有 HTTP 形状，但错误分类更稳定。
- 测试：需要补充事件映射、store 状态、会话页 compact 生命周期、compact route 结构化错误映射测试。
