## 1. 回归测试先行

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 增加用例：带图片和 Skill 引用的 optimistic user message 已绑定 `turnId` 后，被缺少附件元数据或 `clientUserMessageId` 的同 turn server user item 确认时，只保留一条 user message，并继续展示本地附件。
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 增加用例：local user message 与 server user item 中间夹有 reasoning、tool、command 或 runtime activity entries 时，确认去重不依赖相邻位置。
- [x] 1.3 在 `tests/unit/web-store-events.test.ts` 增加保护用例：不同 turn 中相同文本、图片和 Skill 的 user messages 仍保留为不同消息。
- [x] 1.4 在 app-server session timeline 测试中增加用例：JSONL 补齐 tool/Thinking 活动但找不到 assistant 文本锚点时，补齐活动位于 user message 之后、最终 assistant message 之前。
- [x] 1.5 在 `tests/unit/web-timeline.test.tsx` 或等价渲染测试中增加移动端派生顺序用例：同一 turn 的 user、activity、assistant 在 repair 后按语义顺序展示，activity grouping 不把活动移动到最终回复下方。

## 2. 用户消息确认与去重实现

- [x] 2.1 拆分 user message 的稳定身份匹配与内容 fallback：优先使用 `clientUserMessageId`、`turnId`、server item id 或 `localUserMessageIdsByTurn`，仅对未绑定 turn、仍在 sending 且候选唯一的消息使用内容 key。
- [x] 2.2 更新 `findConfirmableLocalUserIndex` 和本地确认替换逻辑，使同 turn server user item 即使缺少 `skillReferences`、图片附件或 `clientUserMessageId` 也能原位确认 optimistic entry。
- [x] 2.3 更新确认合并逻辑，server 身份和状态以 server item 为准；当 server 缺少结构化附件时，保留 local entry 的 Skill 引用和图片附件。
- [x] 2.4 将 user message 去重从相邻重复扩展为 turn-scoped 身份重复，确保中间夹有 activity entries 时仍只保留一条同 turn user message。
- [x] 2.5 保留跨 turn 边界：相同文本、图片或 Skill 的不同 turn user messages 不得被确认、去重或替换成一条。

## 3. 活动排序与 JSONL 补全实现

- [x] 3.1 更新 `mergeTurnSessionRecords` 的 JSONL 工具活动补齐逻辑：有可靠 assistant 文本锚点时仍按锚点插入；找不到锚点时使用同 turn 安全 fallback，插入到 user message 之后、最终 assistant message 之前。
- [x] 3.2 更新前端 `orderTimelineEntries` 或同等排序派生逻辑，在保持跨 turn 稳定顺序的同时，为同 turn user、activity、assistant 建立可预测语义顺序。
- [x] 3.3 确保内联 activity grouping 只合并连续 activity entries，遇到 user、assistant、system 或 error entry 时停止，不能为了聚合改变底层 timeline 事实顺序。
- [x] 3.4 确保 live stream、completion item、snapshot repair 和 JSONL repair 混合到达时，后到的补齐活动不会被追加到最终 assistant 回复之后。

## 4. 验证

- [x] 4.1 运行用户消息确认相关单元测试，至少覆盖 `web-store-events` 中新增和既有 rewind/fork 身份测试。
- [x] 4.2 运行 session timeline / app-server runtime 相关测试，确认 JSONL 补齐排序和工具去重不回归。
- [x] 4.3 运行移动端 timeline 渲染相关测试，确认 activity grouping 顺序和展示稳定。
- [x] 4.4 运行项目推荐验证命令，并运行 `openspec validate fix-mobile-timeline-user-activity-order --strict`。
