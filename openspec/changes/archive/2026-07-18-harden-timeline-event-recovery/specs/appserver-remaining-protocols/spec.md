## ADDED Requirements

### Requirement: Bounded rollout supplement recovers nested custom tool activity
当 app-server bounded page 缺少 Codex custom tool call 的内部动作时，gateway SHALL 从经过 workspace path 校验的 rollout 有界尾部恢复当前 page turn 的可见 activity。超大 rollout MUST 只读取固定尾部预算，MUST NOT 因文件总大小超过 inline budget 而无条件丢弃当前 activity，也 MUST NOT 全量读取文件。`custom_tool_call name: exec` 的嵌套 `tools.exec_command` 只有在直接调用、参数对象与 `cmd/workdir` 字符串均可静态证明时才能归一化为 command/read/list/search；系统 MUST NOT 执行或动态求值 rollout 输入。

#### Scenario: Oversize current rollout still exposes a recent command
- **WHEN** rollout 大于 1 MB，尾部包含当前 page turn 的直接 `tools.exec_command({ cmd: "npm test" })` 及其 output
- **THEN** bounded page supplement MUST 生成一个 command activity 并保留 `npm test` 与可证明的 stdout
- **AND** 文件读取 MUST 保持固定 byte、line 和 elapsed-time 预算

#### Scenario: Read command recovers action metadata
- **WHEN** 可证明的 nested exec command 为 `sed`、`cat`、`head`、`tail` 或 `nl` 读取具体路径
- **THEN** supplement item MUST 使用 `toolKind: command` 与 `actionKind: read`
- **AND** Web 第一次展开 activity 时 MUST 显示具体读取路径

#### Scenario: Dynamic nested call fails closed
- **WHEN** nested call 使用模板插值、变量间接参数、动态属性或不完整语法
- **THEN** supplement MUST 不把它伪装成 read 或 command
- **AND** 原父调用 MAY 保守显示为通用工具，扫描器 MUST 不执行输入代码或越过预算

### Requirement: Id-less response items receive collision-free source identity
系统 SHALL 接受协议允许缺少 `id` 和 `call_id` 的 `rawResponseItem/completed` 或等价 response item，并为其生成稳定、不可碰撞的 synthetic identity。synthetic identity MUST 绑定 `bootId`、thread history generation、`threadId`、`turnId`、item type 和跨 replay/pagination 稳定的 canonical source locator。事件来源的 locator SHALL 使用 `{bootId,eventId,field}`；response/rollout 来源 SHALL 使用 `{sourceKind,responseId/recordId,absoluteOutputIndex}` 或等价绝对位置。页内 ordinal、数组当前位置、文本 hash、item type、turnId 或固定 `:live` 后缀 MUST NOT 单独作为 identity。后续来源只有携带显式 synthetic alias 或唯一 canonical source anchor 时才能与该 item 合并；无法取得稳定 locator 时 MUST 使用仅本次显示有效的唯一 identity 并触发 bounded repair。

#### Scenario: Same-type id-less items remain distinct
- **WHEN** 同一 turn 合法产生两个都缺少 `id` 和 `call_id` 的同类型 response items
- **THEN** adapter MUST 为二者生成不同的 synthetic identity
- **AND** timeline MUST 保留两个 item 及其来源顺序

#### Scenario: Replayed id-less item keeps identity
- **WHEN** 同一 response source event 因重连或双通道传递再次到达
- **THEN** adapter MUST 生成与首次相同的 synthetic identity
- **AND** 客户端 MUST 将其识别为 replay，而不是追加第二项

#### Scenario: Page-local ordinal is not a canonical locator
- **WHEN** 两个分页或 refresh response 都包含页内 ordinal 0 的无 ID item
- **AND** 系统无法提供 responseId + absoluteOutputIndex 或其他稳定绝对 locator
- **THEN** adapter MUST NOT 为二者生成可跨页面合并的相同 synthetic identity
- **AND** MUST 保留独立项并请求 bounded repair，而不是使用文本或数组位置猜测

#### Scenario: Later item cannot merge by type alone
- **WHEN** completed item 或 snapshot item 与现有 synthetic item 类型相同但没有 alias 或唯一 source anchor
- **THEN** timeline engine MUST NOT 仅因类型或文本相同而合并二者
- **AND** 系统 MUST 保留独立项或请求 bounded repair

### Requirement: Command and process byte streams preserve UTF-8 and truncation state
系统 SHALL 将 `command/exec/outputDelta` 和 `process/outputDelta` 的 `deltaBase64` 作为原始 bytes 处理，并按连接、process identity 和 output stream 隔离流式 UTF-8 decoder。decoder MUST 跨 notification 保留不完整多字节字符，直到对应 stream 完成、process 退出或请求结束时才 flush。`capReached: true` MUST 转换为 truncated completeness，并保留已解码 preview、原始字节计数及可用的 continuation/contentRef 或 scoped repair-required；系统 MUST NOT 把 capReached 输出标记为完整或静默丢弃。

#### Scenario: UTF-8 character spans two chunks
- **WHEN** 一个 UTF-8 多字节字符的 bytes 被拆分到同一 process stream 的两个 base64 notifications
- **THEN** adapter MUST 在第二个 chunk 到达后解码出一个完整字符
- **AND** 输出 MUST NOT 包含 replacement character、乱码或丢失 bytes

#### Scenario: Interleaved streams keep decoder state isolated
- **WHEN** stdout 与 stderr 或两个不同 process 的 chunks 交错到达
- **THEN** 每个 stream MUST 使用独立 decoder state 和原始字节计数
- **AND** 一个 stream 的尾部 bytes MUST NOT 与另一个 stream 的开头 bytes 拼接

#### Scenario: Output cap is represented as truncated content
- **WHEN** command 或 process notification 以 `capReached: true` 结束某个 output stream
- **THEN** 可见 item MUST 保留已经安全解码的内容并标记 `truncated`
- **AND** MUST 保留 continuation/contentRef，或产生该 item 的 scoped repair-required 状态
- **AND** MUST NOT 将该内容标记为 `complete`

#### Scenario: Decoder state is released at lifecycle boundary
- **WHEN** output stream 完成、process 退出、generation barrier 生效或连接关闭
- **THEN** 系统 MUST 按对应 lifecycle flush 或丢弃无法归属的 decoder 尾部并释放状态
- **AND** 后续新 process 或新 HistoryStamp MUST NOT 复用旧 decoder bytes

## MODIFIED Requirements

### Requirement: Notifications and pending event flow
系统 SHALL 将新增协议产生的 app-server notification 归一化为现有浏览器 `codex-event` 事件流可分发的移动端事件。timeline 可见 notification MUST 保留 thread、turn、item、HistoryStamp、来源顺序和 completeness 所需字段；兼容 WebSocket 通道与 SSE 主通道暴露给前端 store 的语义 MUST 一致。file change adapter SHALL 支持当前 `item/fileChange/patchUpdated` notification；旧 `item/fileChange/outputDelta` 只可作为兼容输入，MUST NOT 作为当前 patch 更新的唯一接入点。

#### Scenario: Realtime notification is forwarded
- **WHEN** app-server 发送 thread realtime 相关 notification
- **THEN** 后端 MUST 通过浏览器事件流发送 `codex-event`
- **AND** 事件 MUST 包含前端区分 realtime session、transcript、audio、error 或 closed 状态所需字段

#### Scenario: External agent import completion is forwarded
- **WHEN** app-server 发送 external agent config import completion notification
- **THEN** 后端 MUST 通过浏览器事件流发送可被移动端分发的 `codex-event`
- **AND** 事件 MUST 保留导入成功和失败摘要

#### Scenario: Current file patch notification is forwarded
- **WHEN** app-server 发送 `item/fileChange/patchUpdated`，并提供 `threadId`、`turnId`、`itemId` 和 `changes`
- **THEN** adapter MUST 生成同一 item identity 的可见 file change event
- **AND** 事件 MUST 保留 `changes`、来源顺序、HistoryStamp 和后续 completed/snapshot 原位合并所需字段
- **AND** adapter MUST NOT 因只匹配旧 `item/fileChange/outputDelta` 而返回 `null`

#### Scenario: Legacy file output delta remains compatible
- **WHEN** 兼容 app-server 仍发送旧 `item/fileChange/outputDelta`
- **THEN** adapter MAY 将其归一化为同一 file change 事件模型
- **AND** 该兼容路径 MUST NOT 改变 `patchUpdated` 的当前协议优先级或创建重复 Files changed item
