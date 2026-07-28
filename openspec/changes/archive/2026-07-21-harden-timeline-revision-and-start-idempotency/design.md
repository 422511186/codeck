## Context

消息发送使用 `clientUserMessageId` 作为 Web 到 app-server 的幂等身份。当前 route 只在进程内保存 10 分钟 operation cache：缓存结果存在时即使 gateway boot 已改变也会直接返回旧 `turnId`；缓存因 Web 重启或 TTL 消失后，客户端又没有声明这是 ambiguous retry，route 会再次执行 `turn/start`。此外，Timeline 的“重试”入口不区分 start 结果未知和已知 turn 最终失败，二者都会复用旧 identity，导致前者可能重复执行、后者反而无法创建应有的新 turn。

full-content 的 `contentRef` 记录 `sourceRevision`，但 app-server item resolver 目前只比较 generation。第一次 chunk 后 item 在相同 generation 内更新时，后续 chunk 会从新正文继续按旧 offset 读取，客户端最终拼出不存在于任何 revision 的混合文本。source 上限只在 session 注册路径执行，app-server source 与 cursor 没有统一回收，持续产生截断事件或 1-byte continuation 可使缓存无界增长。

## Goals / Non-Goals

**Goals:**

- ambiguous start 重试在 Web/gateway 重启、cache miss、cache hit 和并发情况下都不得重复启动 turn。
- 跨 boot 的已完成缓存必须先从有界历史唯一确认，不能直接返回旧 `turnId`。
- 已知 turn 的最终失败或明确拒绝重试必须使用新 identity，并保留原失败消息。
- app-server item full-content 的所有 continuation chunks 必须来自同一正文 revision。
- full-content source/cursor 必须有统一过期清理和硬上限，且不得留下指向已淘汰 source 的 cursor。

**Non-Goals:**

- 不把幂等记录持久化到外部数据库，也不改变 app-server 原生协议。
- 不改变用户主动发送两条相同正文时应创建两个 turn 的语义。
- 不重构 Timeline engine 的常规排序、归一化或展示逻辑。
- 不改变 full-content 的公开响应 schema、chunk 大小或 cursor 格式。

## Decisions

1. **客户端显式区分 ambiguous retry 与新动作。**

   `StartTurnInput` 增加只供 Web route 使用的 `startBootId` 和 `retryAmbiguousStart`。失败 entry 已记录的 `sendOperation.bootId` 在 ambiguous retry 时原样发送；route 在该标志为真时只查询 bounded latest history，找不到唯一 turn 就返回 `ambiguous-start-unresolved`，绝不调用 app-server `turn/start`。

   已知 turn 最终失败或明确拒绝的重试生成新的 `clientUserMessageId` 并追加新的 optimistic entry。原失败 entry 保留，符合“显式重试创建新发送动作”的现有规范。

   ambiguous retry 恢复成功后，通过 timeline engine 的按 id 删除输入移除 `${entry.id}-error` 临时错误；该操作不影响已知终态失败的新动作及其原错误卡。

2. **所有缓存结果受 gateway boot 边界约束。**

   operation 的 `bootId` 与当前 boot 一致时才允许直接返回 resolved/in-flight 结果。boot 改变后统一进入 bounded recovery；恢复成功后将 operation 迁移到当前 boot，失败则保持 unresolved。

   operation 的异步完成回调只在自身 promise 仍是当前 `inFlight` 时提交状态，避免旧 boot 的迟到 promise 覆盖新 boot recovery。若它已被新 boot recovery 取代，旧 waiter 转发到当前 in-flight/result；当前 recovery 已失败时同样失败关闭，不返回 stale `turnId`。

   route 先完成纯结构规范化并计算 payload fingerprint，再进入 operation cache/recovery。只有 cache miss 且确实创建新 turn 的 start closure 才执行附件存在性、Skill 可用性、thread/model readiness 等可变前置校验；缓存命中与 ambiguous history recovery 不受这些事后状态影响。

   start closure 将审计、附件、Skill、模型 readiness 等 app-server 调用前异常标记为 confirmed rejection。operation cache 在该异常下删除当前 pending 记录而不是转为 ambiguous；route 返回 `START_REJECTED`（模型恢复阻塞继续携带原结构信息），客户端按 response code 而不是单看 5xx 分类。Web 仅在已经进入 `codex.startTurn` 后才允许把网络/5xx 归类为 ambiguous；此前的 `resumeThread` 失败是明确未发送，必须标记为 rejected。

3. **用正文 revision 指纹锁定 app-server content source。**

   对 snapshot/page 和完整 item event，在创建 `contentRef` 时计算正文 UTF-8 内容指纹作为已知 revision；对无法在注册时获得完整正文的 delta source，在第一次成功解析时锁定指纹。每次读取（包括相同 cursor 重试和 continuation）都重新解析并比较指纹；不一致返回 `repair-required/source-revision`，不返回任何新 revision chunk。

   cursor 绑定包含已锁定正文指纹的 effective revision，防止旧 cursor 在 source 状态迁移后继续使用。指纹只保存固定长度摘要，不保留另一份超长正文。

4. **统一约束 full-content source 与 cursor 生命周期。**

   session 和 app-server 两类 source 注册后都执行过期清理并保留至多 2,000 个 source；cursor 保留至多 10,000 个。淘汰 source 时同步删除所有关联 cursor 及反向位置索引，淘汰单个 cursor 时也同步删除反向索引。被淘汰引用继续通过现有 `repair-required/invalid-content-ref` 失败关闭，不回退到不受约束的正文读取。

## Risks / Trade-offs

- [Risk] ambiguous retry 在历史持久化仍延迟时会失败关闭，用户暂时不能继续。→ Mitigation：保留原失败 entry 和相同 identity，用户稍后可再次重试 bounded recovery；正确性优先于可能重复执行。
- [Risk] 旧客户端不发送 `retryAmbiguousStart`。→ Mitigation：保留现有 cache-window 去重；新字段为可选，升级后的客户端获得重启后的 fail-closed 保证。
- [Risk] 对长正文重复计算哈希增加 CPU 开销。→ Mitigation：仅在用户显式读取截断正文时计算，内存只保存固定长度摘要，且 chunk/source 已受既有预算约束。
- [Risk] delta source 首次读取前已更新时只能锁定读取时 revision。→ Mitigation：首次读取后所有 continuation 严格一致；完整 item/page source从注册时即校验。未来 app-server 若暴露原生 item revision，可直接替换该指纹来源。
- [Risk] 极端长正文的旧 cursor 可能因硬上限被淘汰。→ Mitigation：10,000 cursor 明显高于正常移动端读取需要；淘汰后返回 scoped repair-required，避免静默错读。

## Migration Plan

无需数据迁移。新增请求字段向后兼容；部署后旧缓存自然过期。回滚时可同时移除可选请求字段、boot-aware cache 分支和正文指纹校验，不影响已持久化 thread 数据。

## Open Questions

无。
