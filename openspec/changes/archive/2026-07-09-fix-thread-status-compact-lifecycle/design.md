## Context

当前会话页的运行状态由多处共同推断：

- app-server 持有真实 `ThreadStatus`，协议包含 `thread/status/changed` 通知。
- 服务端事件归一化目前没有把 `thread/status/changed` 转成浏览器事件。
- 前端 store 只保存 `running` 和 `activeTurnId`，页面本地 `detail.status` 又单独参与 UI 判断。
- summary 轮询只同步 `running`，不会更新页面本地 `detail.status`。
- 手动 compact 失败后只清理 `compactPending` 并追加错误，没有刷新真实线程状态。

这些分裂导致 compact 失败、turn 结束、SSE 重连或 summary 兜底后，UI 可能继续显示旧状态，需要刷新页面才能恢复。

## Goals / Non-Goals

**Goals:**

- 将 app-server `ThreadStatus` 作为前端线程运行态和 compact 可用性的唯一语义来源。
- 让 `thread/status/changed` 通过 SSE 到达 store，并能实时更新会话页。
- 修复 compact 生命周期：发起、pending、成功启动、失败、完成、非 idle 拒绝、恢复后重试都必须有确定状态收尾。
- 保持运行中 timeline 输出继续走 SSE 增量路径，避免重新引入高频完整 `readThread` polling。
- 保留 JSON-RPC/app-server 结构化错误信息，用结构化错误分类 compact 的 409/502。

**Non-Goals:**

- 不重做 timeline 渲染卡片、diff view、reasoning/file change 展示结构。
- 不改变 app-server 原生 compact 协议方法名或生成协议文件。
- 不把 active 线程强制允许 compact；真实 active 仍必须拒绝。
- 不通过无限轮询完整 timeline 解决状态同步。

## Decisions

1. **线程状态事件优先于 summary 轮询**

   浏览器事件流应新增 `thread_status_changed` 等价事件，携带 `threadId`、归一化后的 `status`、可选 `activeTurnId` 或 active flags。store 收到事件后同步线程状态。summary 轮询仅作为事件流断开、compact pending 或确认状态缺口时的兜底。

   备选方案是继续只用 summary 轮询修状态。该方案会引入轮询窗口延迟，并且当轮询停止条件误判时仍会卡住，因此不采用。

2. **store 保存真实 thread status，页面不再以本地 detail 为状态真源**

   store 应保存当前 thread 的 `status`，并从 status 推导 `running`。页面可以保留 `detail` 作为 snapshot 数据，但 compact 可用性、composer processing、interrupt/stop 展示应优先使用 store 中的当前状态。`detail.status` 只能作为初始化 fallback，不能长期压过实时状态。

   备选方案是每次 summary 轮询都 `setDetail({ ...detail, status })`。这能缓解局部问题，但仍保留两套状态源，后续容易再次分裂。

3. **compact 使用显式生命周期状态**

   前端 compact 应区分：

   - `idle`: 可打开确认并发起 compact。
   - `active`: 禁用并展示运行中不可压缩。
   - `notLoaded/systemError`: 禁用直接 compact，但提供恢复会话后再判断的路径或明确错误。
   - `compactPending`: 请求已提交但 app-server 尚未确认完成，页面显示进行中。
   - `compactFailed`: 追加错误消息并立即刷新 summary/status，确保入口不会被 stale 状态锁死。
   - `compactCompleted`: 由 app-server live item 或 `thread/compacted` 事件插入完成消息，并结束 pending。

   compact 失败后不得仅清 local pending；必须触发状态 refresh 或使用后端返回的当前状态。

4. **JSON-RPC 保留结构化错误**

   `JsonRpcPeer` 抛出的错误应保留 JSON-RPC `error.data`，特别是 app-server 的 `codexErrorInfo`。compact route 应优先识别 `activeTurnNotSteerable` 和相关状态错误，再退回 message 正则。这样 message 文案变化不会把可预期的 409 误判成 502。

5. **诊断要覆盖失败路径**

   compact route 应记录成功启动、非 idle 拒绝和 app-server 异常分类。审计日志不应只记录“开始”，否则无法区分请求被接受、被预检拒绝或 app-server 失败。

## Risks / Trade-offs

- **状态事件乱序** → 使用现有 `eventId/revision/generation` 幂等规则；状态事件不覆盖更高 generation 的可见 timeline，但可以更新 thread-level 状态。
- **store 增加 status 字段影响已有测试** → 先写失败测试覆盖当前 bug，再调整 mock thread state 工具，避免只改实现不改契约。
- **compact 完成事件和 status idle 事件顺序不固定** → pending 结束条件应接受任一可信完成信号，但 timeline 完成消息仍只由 app-server item/compact 事件产生。
- **notLoaded 恢复可能失败** → UI 必须展示恢复失败错误，并保持可重试，不得把入口永久锁死。
- **JSON-RPC 错误 data 形状可能变动** → 类型守卫应保守实现，无法识别时保留原有 message fallback。

## Migration Plan

1. 增加事件映射和 store 状态字段，保持旧 `running` selector 兼容。
2. 调整会话页从 store current status 派生 running/compactAllowed。
3. 修复 compact route 结构化错误和诊断记录。
4. 补齐单元测试与现有验证。
5. 部署后通过一个 active 线程、一个 idle 线程、一个 notLoaded 线程分别验证 compact 入口、失败反馈和恢复路径。

## Open Questions

- `notLoaded/systemError` 时 compact 面板是否自动执行 resume，还是展示“恢复会话”按钮后由用户确认？建议实现阶段采用显式按钮，避免用户点击 compact 时隐式加载大量历史。
- compact route 是否应在 409 响应体中返回当前 thread summary，供前端直接同步状态？建议实现阶段评估；若成本低，可减少一次额外 summary 请求。
