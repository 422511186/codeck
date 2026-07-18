## ADDED Requirements

### Requirement: Agent message source aliases reconcile safely
raw-response、live delta、completed item、snapshot 与 overlay 中指向同一 authored assistant reply 的 agent message SHALL 通过可证明的来源别名收敛为一个 normalized entry。别名判断 MUST 同时限定在同一 history generation、同一 turn、互补来源和唯一候选。provisional/raw 与 canonical MAY 使用相等或前缀兼容正文；completed-event overlay 与 authority history snapshot MUST 使用精确相等正文和唯一的一对一物化关系。系统 MUST NOT 仅凭正文相同合并同一来源中的两个正式 canonical item。

#### Scenario: Raw response with explicit ID keeps provenance
- **WHEN** `rawResponseItem/completed` 携带显式 item ID、response ID 和 absolute output index
- **THEN** 适配后的 agent item MUST 保留该显式 ID
- **AND** MUST 同时保留 `sourceLocator` 的 response 来源、response ID 和 absolute output index

#### Scenario: Live provisional reply converges to canonical completion
- **WHEN** 同一 generation 与 turn 的 agent reply 先通过 live delta 使用 provisional item ID 显示
- **AND** 后续 canonical completed item 使用不同 item ID 返回相等或完整扩展该前缀的正文
- **AND** 该 turn 中只有一个满足来源与正文约束的 provisional 候选
- **THEN** timeline MUST 原位收敛为一个 agent message
- **AND** 最终 entry MUST 使用 canonical item ID、最早可见位置和更完整的 completed 正文与状态

#### Scenario: Raw response overlay converges with canonical snapshot
- **WHEN** raw-response overlay 与 canonical snapshot item 属于同一 generation 与 turn
- **AND** 两者通过 response 来源定位与唯一候选规则可证明为同一 reply
- **THEN** server timeline 与 Web normalized timeline MUST 只暴露一个 agent message
- **AND** 刷新、repair 或重新分页 MUST 不恢复第二条 raw-response 消息

#### Scenario: Completed event overlay converges with materialized history item
- **WHEN** rollout 中只有一个正式 assistant item
- **AND** completed event overlay 与 authority history page 在同一 generation、同一 turn 使用不同 item ID 返回该完整正文
- **AND** 该精确正文在 history 与 completed overlay 两侧分别只有一个候选
- **THEN** 服务端 timeline page MUST 只返回 history item
- **AND** completed overlay item MUST 在该响应中被视为已物化并消费
- **AND** 刷新、repair 和重新分页 MUST 不再次暴露 completed overlay 的第二条消息

#### Scenario: Nested completion item inherits event identity metadata
- **WHEN** `item_updated` 或 `item.appended` 的嵌套 `item`/`entry` 只有 item ID、turn 和正文
- **AND** 外层事件携带 `bootId`、`generation` 或传输序列元数据
- **AND** 同一 item 的 live delta 使用相同的外层 `bootId` 与 generation
- **THEN** 事件适配后的完成 entry MUST 继承缺失的 envelope identity/provenance 元数据
- **AND** 完成 entry 与 live delta MUST 命中同一强 `identityKey` 并只保留一个 normalized entry
- **AND** 适配器 MUST 保留嵌套对象已有的更具体元数据，且 MUST NOT 通过正文相等合并不同 item ID

#### Scenario: Materialized user overlay uses client operation identity
- **WHEN** authority history page 与 completed overlay 中的 user item 具有相同 generation、turnId 和非空 `clientUserMessageId`
- **AND** 该 client identity 在双方分别唯一
- **THEN** 服务端 timeline page MUST 只返回 history user item
- **AND** Web 不得依赖展示层隐藏服务端重复 user item

#### Scenario: Two canonical messages remain distinct
- **WHEN** 同一 turn 的同一来源包含两个不同 canonical item ID 的 agent messages
- **AND** 两条正文完全相同或一条是另一条的前缀
- **THEN** normalized timeline MUST 保留两个独立 agent messages
- **AND** MUST NOT 将文本等价单独视为来源别名

#### Scenario: Ambiguous completed/history materialization fails closed
- **WHEN** 同一 generation 与 turn 的 history 或 completed overlay 任一侧存在多个精确同文 agent 候选
- **OR** completed overlay 与 history 正文仅为前缀关系而非精确相等
- **THEN** 系统 MUST 保留各自强身份而不猜测一对一映射
- **AND** MUST NOT 使用 `msg_*`、`item-*` 命名形状或数组位置消除歧义

#### Scenario: History overlay reconciliation remains linear
- **WHEN** authority history page 包含大量不同 turns 与 agent items，runtime overlay 同时达到其有界容量
- **THEN** completed/history 物化协调 MUST 通过 turn/generation 与精确正文或 client identity 索引完成
- **AND** 处理工作量 MUST 与 page items 数量加 overlay items 数量线性相关
- **AND** React 渲染层 MUST NOT 执行跨 entry 文本去重

#### Scenario: Identical replies across turns remain distinct
- **WHEN** 不同 turn 的 agent messages 具有相同正文
- **THEN** timeline MUST 保留每个 turn 的独立消息
- **AND** alias 协调 MUST NOT 跨 turn 匹配候选

#### Scenario: Ambiguous or conflicting alias fails closed
- **WHEN** 同一 turn 存在多个满足文本条件的 provisional/raw 候选
- **OR** provisional/raw 正文与 canonical 正文不满足相等或前缀兼容
- **THEN** 系统 MUST 保留各自强身份而不猜测合并
- **AND** MUST 记录 alias ambiguity 或 identity conflict 诊断，并在需要时请求有界 repair

#### Scenario: Non-agent identities are unchanged
- **WHEN** timeline 处理 reasoning、tool、diff、system 或 user entries
- **THEN** agent source alias 规则 MUST 不改变这些 entry 的身份、去重、排序或展示行为
