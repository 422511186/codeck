# timeline-event-stream Delta

## Modified Requirements

### Requirement: Timeline events carry stable identity and turn metadata

每个会影响 timeline 可见内容的事件 SHALL 携带稳定身份，至少包括 `bootId`、`eventId`、`kind` 和进程内全局单调的 `streamSequence`。浏览器事件的幂等身份 MUST 使用 `{bootId, eventId}`；`streamSequence` MUST 只用于全局 backlog 定位和来源事件总顺序，MUST NOT 被解释为单 item fragment 的连续序号。可追加正文事件在能够证明 fragment 顺序时 SHALL 额外携带按 `{threadId, generation, turnId, itemId, field}` 隔离的 `fragmentSequence`。属于某个 thread 的事件 MUST 携带 `threadId` 和 history generation。属于某个 turn 或 item 的事件 MUST 额外携带 `turnId` 和 `itemId`；非 turn-scoped 的 thread/global 事件 MUST 明确标记为不参与 rewind/fork turn 计数。

命令类输出事件（`command_output_delta`）SHALL 额外携带 `sourceChannel` 字段标识来源通道（`item-commandExecution` / `command-exec` / `process` / `terminalInteraction`），用于区分同一 itemId 来自不同 app-server 通道的输出流。当 app-server 能够为同一 `(itemId, sourceChannel)` 提供单调序号时，`command_output_delta` 事件 SHALL 携带 `streamSequence` 或 `fragmentSequence`，以支持乱序重排与重放去重。未携带 `sourceChannel` 的事件 MUST 回退到现有 identity 与去重路径，不得因字段缺失而拒绝合并。

#### Scenario: Multi-source command output is distinguished by sourceChannel

- **WHEN** 同一 itemId 的命令输出通过 `item/commandExecution/outputDelta` 与 `command/exec/outputDelta` 两个通道先后到达
- **THEN** 前端 MUST 按 `(itemId, sourceChannel)` 维护独立的输出缓冲
- **AND** 两条通道的输出 MUST NOT 串接成同一 entry 的双倍文本
- **AND** 当两通道实际指向同一逻辑进程时，前端 MUST 通过 authoritative `item_updated` 事件做最终收敛

#### Scenario: command_output_delta carries sequence for ordering

- **WHEN** app-server 为 `command_output_delta` 提供按 `(itemId, sourceChannel)` 单调递增的 `fragmentSequence`
- **THEN** 前端 MUST 对该 itemId 的 delta 链执行 fragmentSequence 顺序校验
- **AND** 乱序到达的 delta MUST 触发 repair 而非被静默追加
- **AND** 当事件未携带 `fragmentSequence` 时，前端 MUST 回退到现有无序号合并路径，不得因字段缺失丢弃输出

#### Scenario: Legacy command_output_delta without sourceChannel still merges

- **WHEN** 前端收到未携带 `sourceChannel` 与 `fragmentSequence` 的 `command_output_delta`（旧 app-server 或未支持通道）
- **THEN** 前端 MUST 按现有 identity 规则合并该 delta
- **AND** MUST NOT 因字段缺失而拒绝输出或触发 repair

### Requirement: Authoritative truncated content must not regress visible delta text

当 authoritative 事件（`item_updated` / `completed-item`）因超过 `TIMELINE_ITEM_INLINE_BYTE_BUDGET` 被截断并改走 `contentRef` 时，合并层 MUST NOT 用截断后的短文本覆盖已通过 delta 流累积的更长文本。

#### Scenario: Truncated authoritative result preserves longer delta text

- **WHEN** 某 tool/command entry 已通过 delta 流累积了较长 `result` 文本
- **AND** 随后收到 authoritative `item_updated` 事件，其 `result` 被截断且携带 `completeness.contentRef`
- **THEN** 合并层 MUST 保留 current 的更长 `result` 文本
- **AND** MUST 采纳 authoritative 事件的 `status` 与 `contentRef`
- **AND** MUST NOT 用截断后的短文本替换可见输出

#### Scenario: Non-truncated authoritative result still wins

- **WHEN** authoritative 事件的 `result` 未被截断（无 `contentRef`）且非空
- **THEN** 合并层 MAY 用 authoritative `result` 替换 current 文本
- **AND** 此行为 MUST 与现有 authoritative 胜出语义保持一致
