## Context

真实会话截图显示一条 assistant 回复连续渲染两次。对应 rollout 只包含一条正式 assistant `response_item`，说明模型并未重复生成内容；第一类重复来自同一 authored reply 同时经过 live/raw-response 与 canonical completed/snapshot 路径。

e3 部署验收又暴露第二类重复：Codex `0.144.5` 的 rollout 中只有 `msg_02cf...`、`msg_0571...`、`msg_0844...` 各一条正式 assistant item，但 `thread/turns/list` history page 分别以 `item-6`、`item-8`、`item-10` 返回相同 turn 与正文；runtime overlay 同时保留原 `msg_*` completed item。`applyTimelineOverlayItems` 因双方 ID 不同、都不是 provisional 而无法建立 alias，随后把未消费 overlay 再次插入 page。user item 也存在双来源，但 Web 依靠相同 `clientUserMessageId` 隐藏了可见重复。浏览器刷新仍会复现，因为错误已经存在于服务端 `/turns` 响应。

现有强身份规则刻意禁止通用文本去重，因为同一 turn 可以合法包含两个正文相同的正式 agent messages。本设计必须补充“显式来源别名”而不是削弱该原则，并覆盖 server overlay 与 Web event/snapshot 两条收敛路径。

HAR 回放还发现一个独立的实时边界：`item_updated` 的 `item` 子对象只带 `id/role/text`，而 `bootId`、`generation` 和序列信息位于外层 event。Web 适配器此前只把 `turnId`/`generation` 补进子对象，导致完成 item 使用 `legacy:<generation>` 身份，无法命中同一 `itemId` 的带 boot stamp live delta，于是 Store 保留两条相同正文。刷新 history 后两条都会带统一 history stamp，因此表面上重复消失。

## Goals / Non-Goals

**Goals:**

- 为 raw-response agent item 保留稳定且可验证的来源定位。
- 让同一 reply 的 provisional/raw 与 canonical item 即使 ID 不同也只显示一次。
- 让已由权威 history page 物化的 completed-event agent/user overlay 不再作为第二条 item 暴露。
- raw/live 协调使用 canonical completed ID；history 物化协调使用 authority history item ID，并保留对应场景的权威位置、最完整正文、状态及完整性元数据。
- 对歧义或冲突 fail closed，并留下可观测诊断。
- 用同一纯 alias 判定规则覆盖 runtime overlay 与 Web timeline engine。
- history/overlay 物化协调不得对 page 全量 items 做两两正文比较，目标路径复杂度为 `O(pageItems + overlayItems)`，额外空间同阶且 overlay 继续受现有上限约束。

**Non-Goals:**

- 不按相同、包含或相似文本通用去重。
- 不合并同一来源中的两个不同 canonical item ID，也不跨 turn 或 generation 合并。
- 不把 history item ID 前缀、`msg_*`/`item-*` 命名形状或数组位置单独作为 alias 证据。
- 不改变 reasoning、tool、diff、system 的 identity 规则，也不改变 Web 对 user 的 `clientUserMessageId` 强 identity；服务端只用该既有 identity 消费已物化的重复 user overlay。
- 不修改历史 rollout 或 app-server 持久化数据。

## Decisions

### 1. raw-response 始终携带 response source locator

`rawResponseItem/completed` 只要提供有效的 `responseId` 与 `absoluteOutputIndex`，转换后的 item 就携带 `{sourceKind: "response", sourceId, absoluteOutputIndex}`，无论 payload 是否已有显式 ID。显式 ID 继续作为原始 item ID，不再与来源定位互斥。

选择该方案是因为 raw-response 来源本身就是可验证证据；只在缺少 ID 时记录 locator 会让最容易产生跨 ID 重复的记录反而失去 provenance。备选的根据 ID 前缀猜测来源不稳定，因此不采用。

### 2. 共享纯 alias resolver，保持强 identity 不变

新增无副作用的 agent alias resolver，输入只包含 generation/history stamp、turnId、item ID、正文、source locator、provisional 状态和顺序元数据。它仅在以下条件全部成立时返回 alias：

- 两条记录同 generation 且同 turn；
- 恰好一条是 `sourceKind: response` 或由 live-delta ledger 标记的 provisional 记录，另一条是 canonical 记录；
- 候选在该 turn 中唯一；
- 正文去除首尾空白后相等，或 provisional 正文是 canonical 完整正文的前缀；
- canonical 正文不得倒退为 provisional 的更短版本。

resolver 返回 canonical winner、provisional loser 和内容合并策略；通用 `identityKey` 仍严格包含 item ID。这样来源别名是 identity 之前的显式协调步骤，而不是隐藏在展示层的文本规则。

### 3. server overlay 与 Web engine 都执行同一协调规则

runtime overlay 在插入未命中的 agent item 前先运行 resolver：raw 先到时暂存为 provisional；canonical 后到时替换 raw key；canonical 先到时后续 raw 被消费。对外 snapshot/page 因而优先只包含 canonical message。

Web timeline engine 作为第二道防线维护有界的 per-turn provisional agent ledger。`live-delta` 新建 agent entry 时登记 provisional identity；raw-response completed item 根据 source locator 视为 provisional；canonical completed/snapshot 到达时运行 resolver，并以 canonical ID 原位替换候选。generation barrier、turn 删除、窗口替换和 terminal cleanup 同步清理 ledger。

双层协调用于覆盖不同到达顺序和断线场景；两层共用 resolver，避免规则漂移。仅在 React 展示层抑制重复会让 Store、分页和滚动锚点继续持有错误条目，因此不采用。

### 4. canonical 内容与位置的合并策略

成功协调后使用 canonical ID、history stamp、generation、turn 与完成状态；保留 provisional 的最早 `createdAt`、已确认 source order/anchor 和更早可见位置。正文使用完整性选择器：canonical 完整正文优先，前缀兼容时采用更长内容，空状态 completion 不清空已显示正文。

该 entry 的索引和 revision/sequence ledger 随 canonical identity 重建，provisional identity 从索引与 ledger 中移除，避免后续 replay 再次追加旧 delta。

### 5. 歧义与冲突不猜测

多个 provisional/raw 候选同时匹配、正文非前缀冲突、generation/turn 不同或两边都是 canonical 时，resolver 返回拒绝原因。系统保留全部强身份；对真正的 provisional 冲突增加 `agentAliasAmbiguities` 或 `identityConflicts` 诊断，并触发既有 bounded repair。正式 canonical 同文消息不是错误，不触发 repair。

这里的“两边都是 canonical”限定为同一来源语义。completed event overlay 与 authority history page 虽都携带完整 item，但属于“事件态记录”与“已物化历史记录”两种互补来源；它们只有通过下一节的更严格物化规则才能收敛。

### 6. completed overlay 与 history snapshot 使用独立物化规则

history page 是刷新、分页和内容详情定位的权威来源；completed-event overlay 用于在 history 尚未物化时保持实时可见。二者 ID 漂移时，不能继续把 overlay 当成第二条 authored reply，也不能把所有 completed item 全局降级为 provisional。

`applyTimelineOverlayItems` 在单次 page 合并作用域内将来源显式区分为 `history` 与 `completed-overlay`，并只在以下条件全部成立时消费 overlay：

- history item 与 overlay item 属于同一 generation 和同一 turn；
- 两者都是 agent message，正文去除首尾空白后精确一致；completed/history 不使用前缀匹配；
- 该 `{generation, turnId, normalizedText}` 在 history 与 completed overlay 两侧都恰好只有一个候选；
- overlay item 不是仍在流式追加的 provisional/raw item；raw/live 继续走现有 alias resolver；
- history item 与 overlay item ID 不同，且没有同 ID direct merge 已经消费 overlay。

成功后保留 history item 及其 item ID、分页顺序、完整性和内容详情定位，overlay ID 只在本次响应中标记为已消费。user overlay 使用同一 turn/generation 且唯一相等的 `clientUserMessageId` 建立更强的物化关系，不依赖正文。

不在合并过程中删除 runtime 的 live overlay map。上游 page 读取与事件到达之间存在并发窗口，缺少单调 overlay revision 时主动删除可能误删 page watermark 之后的新状态；现有 overlay 容量上限负责内存约束，而每次响应通过索引低成本消费已物化记录。

### 7. 线性索引替代全量候选两两比较

history/overlay 物化路径先分别遍历 page items 与 overlay snapshot，构建 turn/generation 作用域的精确正文指纹桶和 user client ID 桶。只有双方桶大小均为 1 时产生 alias。第二次遍历 page 与 overlay 完成 direct merge、alias consume 和未物化 overlay 插入。

该路径不对每个 history agent 扫描全部 overlay，也不对每个 overlay 扫描全部 history，时间复杂度为 `O(pageItems + overlayItems)`，额外空间为 `O(agentAndUserCandidates)`。既有 raw/live 前缀协调仍受 per-turn provisional 上限保护；新增 completed/history 路径禁止前缀匹配，避免为前缀搜索引入排序、trie 或二次扫描。

### 8. 完成事件继承 envelope 身份元数据

`item_updated`/`item.appended` 可能把可见 item 放在 `item` 或 `entry` 子对象中，而 `bootId`、`generation`、`streamSequence` 等字段属于外层事件 envelope。适配器在转换前按“子对象已有值优先、缺失时继承 envelope”补齐这些字段；当 envelope 同时提供 `bootId` 与 generation 时生成对应 `historyStamp`。这样同一 item 的 initial completion、live delta 和 final completion 都使用同一 `identityKey`，不会因为对象层级造成 `legacy` 与 stamped 两条记录。

该补齐只处理身份与传输 provenance，不改变正文、来源类型或通用文本匹配，也不把任意两个不同 item 合并。事件重复到达仍由 event ID/revision ledger 处理。

## Risks / Trade-offs

- [前缀兼容把合法第二条短消息认成流式前缀] → 只有 raw/live 与 canonical completed 互补来源、同 turn、候选唯一且一侧明确 provisional 时才允许；同一来源的两个 canonical 永不合并。
- [history 与 completed overlay 的同文合法双消息被误合并] → 只允许互补来源一对一精确匹配；任一侧同指纹多于一条立即失败关闭，同一来源 canonical 永不互相合并。
- [长 page 与 overlay 合并退化为平方复杂度] → completed/history 使用一次建桶和线性消费，不复用全量 reciprocal candidate 两两扫描。
- [物化后清理 overlay 与新事件竞态] → 本 change 不删除 live overlay map，只在响应 snapshot 中消费；依靠现有容量上限保持内存有界。
- [server 与 Web 重复执行协调产生不一致] → 使用同一纯 resolver 和共享测试表；协调操作设计为幂等。
- [provisional ledger 无界增长] → 按 generation/turn 有界维护，在完成、删除、generation barrier 与窗口替换时清理。
- [歧义 fail closed 仍可能短暂显示重复] → 保留内容安全优先于误删，并通过诊断和 bounded repair 收敛。
- [旧事件没有来源 locator] → 不追溯猜测 ID；只使用 live-delta ledger 中的当前 provisional 证据，旧历史保持强身份。

## Migration Plan

无需数据迁移。先部署兼容新增 provenance 的 server/Web 类型与 resolver，再启用 overlay、engine 与 history materialization 协调。旧客户端忽略新增 locator 字段；新客户端对缺少 locator 的旧记录继续使用现有强身份。completed/history 规则只改变服务端 page 合并结果，不修改 rollout。回滚时停用 alias resolver 与 materialization index 并保留新增字段，不影响持久化会话。

归档时应先同步 `harden-timeline-event-recovery` 的强身份规格，再同步本 change 的新增 alias requirement，避免旧 delta 覆盖新的安全边界。

## Open Questions

无。
