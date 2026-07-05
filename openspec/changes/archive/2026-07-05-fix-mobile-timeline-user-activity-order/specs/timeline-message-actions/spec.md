## MODIFIED Requirements

### Requirement: Server confirmation does not cross turn boundaries
server user item 确认 optimistic local user message 时，客户端 SHALL 优先按 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份原位替换。已绑定 `turnId` 的 local user message MAY 被同 turn 的 server user item 确认，即使 server item 暂缺 `skillReferences`、图片附件或 `clientUserMessageId`；此时合并结果 MUST 保留本地已知的 Skill/图片附件展示。纯文本 fallback MUST 仅用于未绑定 turn、仍处于 sending 且候选唯一的本地消息；MUST NOT 匹配已经绑定其他 turn 的 sent local message。

#### Scenario: Confirmation for repeated text arrives late
- **WHEN** timeline 中存在两条相同文本的 local user message
- **AND** 它们已经绑定不同 `turnId`
- **AND** 服务端只确认其中一个 turn 的 user item
- **THEN** 客户端 MUST 只替换同 `turnId` 或同 `clientUserMessageId` 的 local entry
- **AND** MUST NOT 删除或覆盖另一条相同文本 user message

#### Scenario: Confirmation preserves local Skill and image attachments
- **WHEN** 本地 optimistic user message 包含图片和 Skill 引用
- **AND** `turn/start` 已经把该 local message 绑定到 `turnId`
- **AND** 同一 turn 的 server user item 到达时缺少 `skillReferences`、图片附件或 `clientUserMessageId`
- **THEN** 客户端 MUST 用该 server user item 原位确认本地 user message
- **AND** 合并后的 user message MUST 继续展示本地已知的 Skill 引用和图片附件
- **AND** timeline MUST NOT 同时显示 local user message 和 server user message 两条用户消息

#### Scenario: Non-adjacent confirmed duplicate is merged
- **WHEN** 本地 optimistic user message 和同 turn server user item 之间夹有 reasoning、tool、command、diff 或 runtime activity entries
- **THEN** 客户端 MUST 仍将两条 user entries 识别为同一用户发送
- **AND** timeline MUST 只保留一条该 turn 的 user message
- **AND** 被夹在中间的 activity entries MUST 保持可见并保留 turn metadata
