## Why

同一条 assistant 回复可能通过 live/raw-response、completed event overlay 与 history snapshot 多条来源到达 timeline，并因来源使用不同 `itemId` 而重复显示。e3 真实会话进一步证明，rollout 中唯一的 `msg_*` assistant item 会同时以 history page 的 `item-*` 重建身份和 runtime overlay 的原始身份返回；刷新后 `/turns` 响应本身已经重复。必须在不按文本误删合法消息的前提下，为可证明的跨来源别名建立安全收敛规则。

## What Changes

- 为 raw-response agent item 保留明确的来源定位信息，即使上游已经提供显式 ID。
- 仅在同一 history generation、同一 turn 中，将唯一的 provisional/raw agent 候选与 canonical completed agent 协调为一个 logical item。
- 在权威 history page 与同一 runtime 的 completed-event overlay 之间建立独立的物化协调：仅当互补来源、turn/generation 一致、正文精确一致且双方候选唯一时，history item 消费 overlay item。
- 使用 `clientUserMessageId` 消费已由 history page 物化的 user overlay，避免服务端继续返回重复 user item。
- alias 协调要求来源类型明确、候选唯一且正文相等或前缀兼容；冲突或歧义时保留两条并触发诊断/修复语义。
- raw/live 与 canonical completed 协调时由 canonical completed ID 胜出；completed overlay 已被 authority history page 物化时由 history item ID 胜出，同时保留权威顺序、完整正文、状态和元数据。
- 保持同一来源内两个 canonical item、跨 turn 相同正文以及 reasoning、tool、diff 的现有强身份规则不变；不同来源只有在显式物化关系可唯一证明时才允许收敛。
- history/overlay 协调按 turn 与精确正文指纹一次建索引，避免按全量 timeline 两两比较；额外工作量 SHALL 与 page items 加有界 overlay items 线性相关。
- 增加 live、raw-response、completed、snapshot/overlay、歧义候选和合法同文消息的回归测试。
- 事件 envelope 携带的 `bootId`、`generation` 与传输序列元数据必须传递到嵌套的 `item_updated`/`entry`，使完成事件与同一 item 的 live delta 使用同一强身份。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-output-rendering`: 补充 agent message 跨来源显式 alias 的证明、收敛、冲突降级与稳定身份要求。

## Impact

- 影响 app-server 事件适配、raw-response 来源元数据、runtime overlay/history page 合并和 Web timeline engine 的 agent entry 归一化；事件嵌套 item 继承 envelope 身份元数据。
- 影响相关协议类型与 server/Web 单元测试；除消除同一 `clientUserMessageId` 的双来源 user overlay 外，不改变用户消息内容、工具活动、reasoning 展示或跨 turn 排序。
- history/overlay 新增路径使用线性索引且不进入 React 渲染层，长会话分页不会引入全量文本两两比较。
- 不新增外部依赖，不迁移持久化会话数据；刷新或 repair 后可重新按来源证据收敛历史窗口。
