## MODIFIED Requirements

### Requirement: Fork rollback uses fork-local history metadata
消息级 fork SHALL 在 fork 后以新 thread 的服务端历史为准计算和标记 rollback 屏障，并在 forked thread 的 rollback 失败恢复中保留 fork-local `HistoryStamp` 和 generation。系统 MUST NOT 假设新 thread 的 turnId 与原 thread 完全相同，除非 app-server 明确保证；系统也 MUST NOT 用原 thread 的 generation 组装 forked thread 的 repair request。

#### Scenario: Forked thread has different turn ids
- **WHEN** 原 thread fork 后新 thread 的 turnId 与原 thread 不同
- **AND** 客户端需要在新 thread 上 rollback 到目标消息之前
- **THEN** 客户端 MUST 使用 fork 返回或新 thread read/resume 结果定位等价目标 turn
- **AND** MUST NOT 用原 thread 的 turnId 作为新 thread 的唯一删除屏障

#### Scenario: Fork rollback repair uses fork-local generation
- **WHEN** 原 thread generation 为 G1
- **AND** fork API 返回的 forked thread generation 为 G2
- **AND** 客户端在 forked thread 上执行 rollback 时遇到 conflict、repair-required 或等价可恢复失败
- **THEN** 客户端 MUST 为 forked thread 请求 repair
- **AND** repair request MUST 使用 forked thread 的 G2 generation
- **AND** MUST NOT 使用原 thread 的 G1 generation
