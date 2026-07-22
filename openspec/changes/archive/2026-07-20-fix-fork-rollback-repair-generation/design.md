## Context

`forkFromMessage` 会先创建新 thread，再在 forked thread 上执行 rollback，把目标消息之前的尾部删除并重建可见历史。当前 rollback 失败的 catch 路径会继续发起 repair，但它用的是原 thread 的 `rollbackMetadata.historyStamp.generation`，而不是 fork-local 的 `forkRollbackMetadata.historyStamp.generation`。

当 forked thread 的 generation 与原 thread 不同时，这会把 repair 请求挂到错误历史分段上。结果可能是 repair 去重 key 错误、retry 绑定到旧 generation，或者 forked thread 无法按正确窗口恢复。

## Goals / Non-Goals

**Goals:**

- 让 forked thread 的 rollback 失败恢复使用 fork-local generation 和 history stamp。
- 保留现有 fork 解析失败、rollback conflict 和 repair-required 的失败关闭行为。
- 用回归测试覆盖 forked thread generation 与原 thread 不一致的场景。

**Non-Goals:**

- 不修改 rollback/fork app-server 协议。
- 不改变普通 rewind、send 或 snapshot repair 的主流程。
- 不做与该缺陷无关的重构。

## Decisions

1. **repair 元数据跟随 fork-local rollback metadata。**

   选择：fork rollback 失败后，如果需要请求 repair，就使用 `forkRollbackMetadata.historyStamp.generation` 作为 generation，而不是原 thread 的 generation。

   原因：repair 的历史边界属于 forked thread 的当前历史，必须与 fork-local rollback 结果保持一致。

   备选：继续使用原 thread generation。该方案实现简单，但会把 repair 请求绑到错误历史窗口，和 fork-local 目标相冲突。

2. **回归测试覆盖 generation 不一致。**

   选择：构造原 thread 与 forked thread generation 不同的 fork 场景，触发 fork rollback 失败后断言 repair 请求带的是 fork-local generation。

   原因：这个缺陷不会在 generation 相同的常见路径里暴露，测试必须显式制造分歧。

## Risks / Trade-offs

- [Risk] fork-local generation 取值错误会导致 repair 请求继续落到旧窗口。→ Mitigation：测试直接断言 `requestSnapshotRepair` 的 generation，避免回归。
- [Risk] fork rollback failure 路径较少走到，容易被忽略。→ Mitigation：把这条路径纳入 `timeline-message-actions` 的规范场景。
- [Risk] 若 app-server 在某些 fork 情况下复用 generation，这个修复看起来“多余”。→ Mitigation：即使 generation 相同，使用 fork-local metadata 仍是正确的；不影响现有行为。

## Migration Plan

无需数据迁移。前端修复可随构建发布；如需回滚，恢复 catch 分支中的 repair generation 来源即可。

## Open Questions

- 无。
