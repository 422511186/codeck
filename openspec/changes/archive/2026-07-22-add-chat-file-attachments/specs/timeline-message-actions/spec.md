## ADDED Requirements

### Requirement: 普通文件参与消息重试与历史操作
用户消息的失败重试、重发、rewind 和 fork SHALL 保留该消息的普通文件引用及稳定附件身份。需要创建新 turn 的操作 MUST 重新验证文件本体；文件已过期时 MUST 失败关闭并要求重新上传。

#### Scenario: Failed turn retry preserves files
- **WHEN** 带普通文件的 turn/start 明确失败并显示重试
- **AND** 用户点击重试
- **THEN** 新的发送尝试 MUST 携带原文本、图片、Skill 和全部 `fileReferences`
- **AND** MUST NOT 静默省略失败或缺失的普通文件

#### Scenario: Rewind restores valid file draft
- **WHEN** 用户 rewind 到一条包含仍有效普通文件的用户消息
- **THEN** composer MUST 恢复该消息的文本和普通文件引用
- **AND** 恢复操作 MUST NOT 重复上传仍有效的服务端文件

#### Scenario: Fork preserves historical file attachments
- **WHEN** 用户从包含普通文件的消息创建 fork
- **THEN** fork 后的历史用户消息 MUST 保留相同文件 chip 和附件包装语义
- **AND** fork-local turn identity MUST 独立于原 thread

#### Scenario: Fork restores valid file draft
- **WHEN** 用户从包含仍有效普通文件的用户消息创建 fork
- **THEN** fork 后的 composer MUST 恢复该消息的文本和全部普通文件引用
- **AND** 恢复操作 MUST NOT 重新上传仍有效的服务端文件
- **AND** 新 fork 的草稿 MUST 独立于原 thread 草稿

#### Scenario: Expired file blocks retry or resend
- **WHEN** 重试、重发或 rewind 需要的普通文件已经不存在
- **THEN** 系统 MUST 告知用户附件已过期并要求重新选择
- **AND** MUST NOT 启动缺少该文件的新 turn
- **AND** 原历史消息和文件 chip MUST 保持可见

## MODIFIED Requirements

### Requirement: Same-text user turns remain distinct
消息级 rewind/fork 所依赖的 user message 身份 SHALL 以 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份为准。系统 MUST NOT 仅因两个 user message 的文本、图片、普通文件或 Skill 相同，就在不同 turn 之间合并、去重或替换其中任意一条。

#### Scenario: User sends identical prompts in consecutive turns
- **WHEN** 用户连续两轮发送相同文本和相同附件
- **AND** 每轮 `turn/start` 都返回不同 `turnId`
- **THEN** timeline MUST 同时保留两条 user message
- **AND** 每条 user message MUST 绑定各自的 `turnId`
- **AND** rewind/fork MUST 能定位用户实际选择的那一条

### Requirement: Server confirmation does not cross turn boundaries
server user item 确认 optimistic local user message 时，客户端 SHALL 优先按 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份原位替换。已绑定 `turnId` 的 local user message MAY 被同 turn 的 server user item 确认，即使 server item 暂缺 `skillReferences`、图片附件、普通文件附件或 `clientUserMessageId`；此时合并结果 MUST 保留本地已知的 Skill、图片与普通文件展示。纯文本 fallback MUST 仅用于未绑定 turn、仍处于 sending 且候选唯一的本地消息；MUST NOT 匹配已经绑定其他 turn 的 sent local message。

#### Scenario: Confirmation for repeated text arrives late
- **WHEN** timeline 中存在两条相同文本的 local user message
- **AND** 它们已经绑定不同 `turnId`
- **AND** 服务端只确认其中一个 turn 的 user item
- **THEN** 客户端 MUST 只替换同 `turnId` 或同 `clientUserMessageId` 的 local entry
- **AND** MUST NOT 删除或覆盖另一条相同文本 user message

#### Scenario: Confirmation preserves local Skill image and file attachments
- **WHEN** 本地 optimistic user message 包含图片、普通文件和 Skill 引用
- **AND** `turn/start` 已经把该 local message 绑定到 `turnId`
- **AND** 同一 turn 的 server user item 到达时缺少部分附件元数据或 `clientUserMessageId`
- **THEN** 客户端 MUST 用该 server user item 原位确认本地 user message
- **AND** 合并后的 user message MUST 继续展示本地已知的 Skill、图片和普通文件
- **AND** timeline MUST NOT 同时显示 local user message 和 server user message 两条用户消息

#### Scenario: Server metadata supplements local file reference
- **WHEN** 同 turn 的 local 与 server user item 都包含同一路径的普通文件但元数据完整度不同
- **THEN** 客户端 MUST 按稳定 id 或路径合并为一个 fileReference
- **AND** MUST 使用可用的名称、MIME 和大小补齐缺失字段

#### Scenario: Non-adjacent confirmed duplicate is merged
- **WHEN** 本地 optimistic user message 和同 turn server user item 之间夹有 reasoning、tool、command、diff 或 runtime activity entries
- **THEN** 客户端 MUST 仍将两条 user entries 识别为同一用户发送
- **AND** timeline MUST 只保留一条该 turn 的 user message
- **AND** 被夹在中间的 activity entries MUST 保持可见并保留 turn metadata
