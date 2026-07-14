## Why

发送消息时，尚未 materialize 的会话会调用 `thread/resume`；当上游未返回 `initialTurnsPage` 或分页协议失败时，当前兼容 fallback 会直接采用 `response.thread.turns`，使完整历史替换前端分页窗口。相同的完整 timeline 旁路还存在于首屏恢复、rollback、steer、review、重命名和 interrupt 等路径，因此必须在服务端契约和前端状态入口同时封死，而不能继续依赖上游遵守 `includeTurns: false` 或 `excludeTurns: true`。

## What Changes

- **BREAKING**：会话 metadata、resume 和 mutation API 不再返回可直接写入页面的完整 `timeline`；需要消息的调用方必须显式请求受条数与字节预算约束的 cursor 页。
- 删除 `metadataThread.turns`、`response.thread.turns` 和分页失败后的完整历史 fallback；非兼容上游返回的 turns 必须被丢弃。
- 发送、恢复和 repair 只更新 metadata 或合并最新一页，不得 replace 已加载分页窗口，也不得把分页失败转换为完整详情读取。
- rollback、steer、review、rename、interrupt、unarchive 和 fork 等 mutation 仅返回操作结果、metadata 或显式有界消息页。
- 为上游忽略分页参数、缺失 `initialTurnsPage`、分页报错和 mutation 携带完整 turns 的场景增加回归测试，并统一校验响应条数与字节预算。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 明确发送、恢复、回滚和其他 mutation 只能维护当前分页窗口，任何响应均不得隐式扩展为完整历史。
- `frontend-request-deduplication`: 分页或 metadata 失败时必须失败关闭，不得通过 resume、detail 或 mutation fallback 获取完整 timeline。
- `timeline-event-stream`: repair、steer、interrupt 和 review 等事件相关恢复路径只能返回 metadata 或有界消息页。

## Impact

- 服务端 app-server client 与 gateway：`src/server/app-server/client.ts`、`src/server/app-server/runtime.ts`。
- Next API routes：resume、rollback、steer、review、name、interrupt、fork、unarchive 和 thread metadata 路由。
- Web API 类型与会话页面：`src/web/api/`、`src/app/threads/[threadId]/page.tsx`。
- 单元与集成测试：client、runtime、routes、Web thread page 和发布分页检查。
- 不新增第三方依赖；接口返回结构会收紧，前后端必须随同一 Docker 镜像发布。
