## ADDED Requirements

### Requirement: Oversize visible events preserve identity and continuation
timeline event stream SHALL 在发送前检查序列化 UTF-8 bytes。超过 event budget 的可见事件 MUST 转换为保留 threadId、turnId、itemId、eventId、revision、sequence、generation、sourceOrder、preview 和 contentRef 的引用事件，MUST NOT 静默丢弃或仅断开连接。

#### Scenario: Tool output event exceeds budget
- **WHEN** tool output 可见事件序列化后超过 256 KiB 默认 event budget
- **THEN** 浏览器 MUST 收到同 identity/order 的 truncated reference event
- **AND** 客户端 MUST 能按 contentRef 读取完整 output

#### Scenario: Reference event still exceeds budget
- **WHEN** reference event 加上 preview、metadata 和 contentRef 后仍超过 event budget
- **THEN** 服务端 MUST 继续缩减 preview 和可选 metadata，直到最小 identity/order/completeness envelope 在预算内
- **AND** 若无法生成安全 contentRef，MUST 发送 scoped repair-required envelope，禁止丢事件或断连

#### Scenario: Oversize event replay
- **WHEN** reference event 因重连被 replay
- **THEN** eventId/revision ledger MUST 继续去重
- **AND** MUST 不创建第二条 preview 或重复 full-content 请求

### Requirement: Realtime and refreshed completeness converge
同一 item 的 realtime preview/reference、completed item、snapshot item、turn detail 和 full-content chunks SHALL 通过 timeline engine 产生一致 identity、可见顺序、正文前缀和 completeness 状态。

#### Scenario: Realtime reference then complete snapshot
- **WHEN** realtime 先收到 truncated reference event
- **AND** refresh snapshot 后续返回完整同 identity item
- **THEN** snapshot MUST 原位完成该 item
- **AND** MUST 不保留重复 preview entry

#### Scenario: Complete realtime then partial refresh
- **WHEN** realtime 已接收完整正文
- **AND** refresh response 因 page budget 只返回 partial/truncated item
- **THEN** engine MUST 保留完整 realtime 正文
- **AND** visible order MUST 与完整 refresh fixture 一致

### Requirement: Timeline gaps include completeness scope
当 backlog、pagination 或 content source 无法恢复时，timeline gap/repair signal SHALL 包含受影响 thread、可选 turn/item identity 和 completeness reason。客户端 MUST 只 repair 受影响范围。

#### Scenario: Content cursor expires
- **WHEN** full-content cursor 无法继续读取
- **THEN** 服务端 MUST 返回 item-scoped repair-required
- **AND** 客户端 MUST 不覆盖其他完整 timeline entries
