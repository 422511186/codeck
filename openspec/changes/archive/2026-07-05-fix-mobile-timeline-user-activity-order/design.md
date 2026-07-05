## Context

移动端会话页同时接收本地 optimistic user message、`turn/start` 返回、timeline event stream、completion item、snapshot repair 和服务端基于 JSONL 的历史补全。当前合并路径中，用户消息确认仍会在部分场景依赖 `userMessageKey`，而该 key 把正文、图片和 Skill 引用都纳入比较；当 server user item 缺少 `skillReferences`、图片元数据或 `clientUserMessageId` 时，即使它属于同一个 `turnId`，也可能无法原位确认本地消息。

活动排序的当前风险在于同一 turn 内只按 turn 分组，turn 内基本保留追加顺序；服务端 JSONL 补齐工具活动时如果找不到 agent 文本锚点，会把剩余工具记录追加到 turn 末尾。移动端最终呈现就会出现 assistant 最终回复在上、工具/Thinking 活动统一堆在下方的错误历史。

## Goals / Non-Goals

**Goals:**

- 同一 turn 的 server user item MUST 原位确认对应 optimistic user message，即使附件元数据在两端不完全一致。
- 确认后的用户消息 MUST 保留本地已知的 Skill 引用和图片附件展示，避免服务端缺省字段导致移动端信息消失。
- 去重逻辑 MUST 能处理 user entries 中间夹有 reasoning、tool、command、diff 或 runtime activity 的非相邻重复。
- 同一 turn 内活动记录 MUST 按真实事件顺序或可推断语义顺序穿插展示；repair fallback 不得把活动统一追加到最终 assistant 之后。
- 增加覆盖用户截图场景的单元测试和渲染测试。

**Non-Goals:**

- 不改变 `turn/start`、rollback、fork、event stream 的公开 API 合约。
- 不引入新的桌面端布局；测试和验收以手机浏览器 timeline 行为为准。
- 不重做完整 timeline 数据模型，只收紧现有身份、去重和排序规则。
- 不伪造未公开 reasoning 内容；仅排序和展示 app-server 已提供的可见活动。

## Decisions

1. 用户消息确认以稳定身份优先，内容 key 只作严格 fallback。

   `findConfirmableLocalUserIndex` 和确认后清理逻辑应优先使用 `clientUserMessageId`、`turnId`、server item id 或已保存的 `localUserMessageIdsByTurn`。当本地 optimistic entry 已绑定 `turnId` 时，同 turn 的 server user item 可以确认它，即使 `skillReferences` 或 `imagePaths` 不一致。纯内容 fallback 只保留给未绑定 turn、仍处于 sending、候选唯一的本地消息，避免连续相同 prompt 被跨 turn 合并。

   备选方案是继续扩展 `userMessageKey`，让服务端缺失字段时忽略附件差异。该方案会把“身份确认”和“内容等价”混在一起，容易误删不同 turn 的同文消息，因此不采用。

2. confirmed user merge 采用“服务端身份 + 本地附件补全”。

   原位替换时，entry id、server metadata、状态应以 server item 为准；正文以更权威或更完整的一方为准；Skill 引用和图片附件如果 server 缺失但 local 存在，MUST 保留 local 值。这样刷新或 repair 后展示稳定，同时不因为服务端暂未回填结构化附件而丢失用户刚看到的 chip/缩略图。

   备选方案是完全信任 server item 覆盖 local entry。该方案更简单，但会复现 Skill/图片消失和确认失败后的重复显示，不采用。

3. 去重范围从“相邻 user message”扩展为“同 turn 身份重复”。

   `removeAdjacentDuplicateUserMessages` 只能处理相邻重复；这次 bug 中间可能夹着 runtime loading、tool、reasoning 或 assistant delta。实现应在确认合并后，对同 turn、同 `clientUserMessageId` 或同 server/user identity 的 user message 做 turn-scoped 去重，并保留排序最早、附件最完整、身份最权威的一条。不同 turn 的相同文本、相同图片或相同 Skill MUST 保留为不同消息。

4. turn 内排序引入语义 phase 和 repair fallback 插入点。

   `orderTimelineEntries` 仍可保持跨 turn 顺序稳定，但同 turn 内需要保证 user message 在活动和 assistant 输出之前，活动在可推断位置穿插，最终 assistant 不应被缺少锚点的活动挤到前面。对于服务端 `mergeTurnSessionRecords` 的 JSONL 补齐，当找不到匹配 agent 文本锚点时，补齐的 tool/activity records 应插入到该 turn 的 user message 之后、第一条 assistant/final assistant 之前；如果记录本身有更可靠的 event/order metadata，再按 metadata 定位。

   备选方案是所有补齐活动放到 user message 后面。该方案能避免坠底，但会破坏已有“assistant、工具、assistant”交错场景。因此只有在缺少锚点或顺序无法可靠恢复时才使用安全 fallback。

5. 测试先覆盖 store 和 session-timeline，再覆盖移动端渲染派生结果。

   store 测试负责证明非相邻 user confirmation 不重复、附件保留、相同文本跨 turn 不误删；session-timeline 测试负责证明 JSONL 补齐活动缺少 agent 锚点时不会坠到最终回复后面；timeline 渲染测试负责证明移动端 activity grouping 不改变底层语义顺序。

## Risks / Trade-offs

- [Risk] 仅凭 `turnId` 合并 user message 可能误合并同一 turn 中异常出现的多个 user item。→ Mitigation：同 turn 合并只应用于当前产品约束下的一轮一个用户输入；若同 turn 出现多个 server user items，应优先使用 `clientUserMessageId`/server id，并在测试中覆盖候选唯一性。
- [Risk] 保留本地附件可能让短时间内 local 与 server snapshot 不完全一致。→ Mitigation：只在 server 缺失字段时补本地附件；server 明确返回附件时以 server 为准。
- [Risk] repair fallback 的活动插入点不一定还原绝对真实顺序。→ Mitigation：有可靠 event/order/text anchor 时按真实锚点；只有缺失锚点时使用“user 后、assistant 前”的安全语义位置，避免最明显的坠底错误。
- [Risk] 增加 turn-scoped 去重后可能影响 rewind/fork 的 user message 定位。→ Mitigation：保留 `turnId`、server item id、`clientUserMessageId` 和本地附件 metadata，并用现有 rewind/fork 测试加回归断言。

## Migration Plan

- 这是前端和 app-server 合并逻辑修复，无需数据库迁移。
- 部署后旧 thread 通过 `thread/read`、snapshot repair 或重新进入会话自动按新规则派生 timeline。
- 若发现排序回归，可回滚本 change 的实现；数据源中的原始 thread items 和 JSONL 记录不需要回滚。

## Open Questions

- 无阻塞问题。实现阶段若发现 app-server 可提供更稳定的 activity sequence metadata，应优先使用该 metadata，但不影响本 change 的 fallback 要求。
