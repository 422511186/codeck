## Context

当前消息级 rewind/fork 的客户端入口依赖 timeline entry 的 `id`、`turnId` 和当前 entries 中的有序 distinct turns 计算 `numTurns`。如果目标 entry 被旧渲染候选、文本 fallback 或不完整分页窗口误解析，`numTurns` 会扩大到从更早 turn 到尾部的范围，app-server 会按该数量真实回滚历史。

会话页刷新时没有持久化的本地 timeline 缓存；手机端新建会话后刷新，首个 `readThread` 失败就会进入错误页。桌面端常因同一 tab 内 store 尚有缓存或稍后访问而看起来正常。

## Goals / Non-Goals

**Goals:**

- rewind/fork 只在目标 entry 身份稳定、当前尾部范围可证明时调用 rollback。
- rollback 成功后使用服务端返回结果替换 timeline，但不能把有限窗口误标记为完整历史。
- 手机端刷新刚创建或未 materialized 的 thread 时，提供有限恢复路径，避免一次瞬时读取失败直接显示不可用页面。
- 用邻近单元测试锁住上述行为。

**Non-Goals:**

- 不改变 app-server `thread/rollback` 协议的 `numTurns` 语义。
- 不引入长期本地 timeline 持久化缓存。
- 不重做整个 timeline engine 架构。
- 不改变桌面布局或新增桌面端适配。

## Decisions

### 1. 回滚入口基于可靠 metadata 失败关闭

`rollbackMetadataForEntry` 需要知道当前 thread 是否已经到达历史开头，或者至少能证明目标 turn 到当前尾部的范围完整。若 target 不在当前 normalized entries 中，或者当前窗口缺少更早 cursor 且目标处在窗口头部附近，入口 MUST 不调用 rollback。

备选方案是继续使用当前 entries 猜测 `numTurns` 并依赖服务端删除屏障校验；这无法防止 `numTurns` 本身过大，因此不能解决“真实删除过多 turns”的根因。

### 2. 删除文本 fallback 作为回滚目标来源

`resolveCurrentUserMessage` 对 rewind/fork 应只接受当前 entries 中同 id、同 turn/item 稳定身份的 user entry。纯文本唯一匹配可以用于展示或普通确认，但不能作为破坏性历史操作的目标。

### 3. rollback 返回窗口保留分页语义

`CodexAppServerClient.rollbackThread()` 返回的 `ThreadRollbackResponse.thread` 没有 `nextCursor` 字段。客户端应在 rollback 后通过有界读取补齐最近 turns 与 cursor，或至少保留“仍可能存在更早历史”的状态，避免前端把窗口当完整历史。

### 4. 手机刷新读取做有限恢复

`readThread` 对刚创建空会话的未 materialized 错误已能返回空 timeline，但实际错误文案可能变化。会话页初始读取应对可恢复错误做有限重试或调用 `resumeThread/readThread` fallback；若恢复后仍失败，再显示错误。

## Risks / Trade-offs

- [Risk] 更严格的 rewind/fork 校验会让部分历史消息暂时不可回滚。→ Mitigation：提示刷新或加载更多历史；这是比误删历史更安全的失败方式。
- [Risk] rollback 后额外读取详情会增加一次 app-server 请求。→ Mitigation：仅在 rollback 成功路径执行，且换来正确 cursor 和完整替换语义。
- [Risk] 放宽未 materialized 错误识别可能吞掉真实错误。→ Mitigation：只对明确的 transient/未加载/未 materialized 类错误做有限重试，仍保留最终错误展示。

## Migration Plan

1. 先补失败测试覆盖回滚目标误定位、窗口不完整和手机刷新恢复。
2. 最小实现可靠 metadata 校验、移除破坏性操作文本 fallback。
3. 调整 rollback 后详情读取/分页语义。
4. 调整会话页初始读取恢复逻辑。
5. 运行相关单元测试、类型检查和 OpenSpec 校验。
