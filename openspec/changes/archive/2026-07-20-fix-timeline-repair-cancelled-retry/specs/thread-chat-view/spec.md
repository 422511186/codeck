## MODIFIED Requirements

### Requirement: Repair replace is serialized with local mutations
snapshot repair、rollback replace、fork initialization、本地 send mutation 和 SSE/live 提交 SHALL 通过 thread-local mutation/delivery epoch、`HistoryStamp` 与 request token 串行化。旧请求完成后 MUST NOT 回退较新的本地或实时 timeline 状态；旧 generation 请求的清理 MUST NOT 清除新 generation 的 repair 标记。已取消、已卸载或 route/thread 已切换的 repair attempt MUST NOT 安排 completion retry、清理当前 thread repair 标记或把旧 thread 的 repair 需求转移到新 thread。

#### Scenario: Repair finishes after a new send
- **WHEN** 客户端因 gap 发起 snapshot repair
- **AND** 用户随后基于当前可用输入发送新消息
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 掉新发送的 optimistic entry
- **AND** 后续 timeline MUST 以新 turn 的事件流为准

#### Scenario: Repair finishes after a live delivery
- **WHEN** 客户端发起 latest-page repair
- **AND** repair pending 期间同一 thread 的 SSE/live event 已提交更新并推进 delivery barrier
- **AND** repair 响应没有通过同 generation overlay 或 watermark 覆盖该更新
- **THEN** 客户端 MUST NOT 用该响应删除或回退已提交 live entry
- **AND** repair 需求 MUST 保留或以当前 barrier 重新排队

#### Scenario: Cancelled repair failure does not retry
- **WHEN** 会话页为 thread A 发起 latest-page repair
- **AND** repair pending 期间页面卸载，或路由切换到 thread B
- **AND** thread A 的旧 repair 请求随后以非 abort 错误失败
- **THEN** 客户端 MUST 将该 repair attempt 视为已取消，并且 MUST NOT 为 thread A 或 thread B 安排 completion retry
- **AND** 该旧 attempt MUST NOT 清理或覆盖当前 thread 的 repair 标记
