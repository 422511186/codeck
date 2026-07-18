# appserver-remaining-protocols Specification

## Purpose
定义移动端 Web 后端对剩余 app-server `ClientRequest` method 的代理覆盖要求，确保环境接入、external agent config、feedback、marketplace、plugin share、MCP tool call 和 thread realtime 能力在 typed client、gateway、mock、HTTP API、事件流和中文文档中保持一致。
## Requirements
### Requirement: Complete remaining app-server method coverage
系统 SHALL 接入当前 `ClientRequest` 中尚未由源码覆盖的剩余 app-server method，并且 MUST 不再依赖临时排除规则来隐藏这些 method 的缺口。

#### Scenario: Protocol coverage has no remaining excluded gap
- **WHEN** 运行 app-server 协议覆盖测试
- **THEN** `environment/add`、`externalAgentConfig/detect`、`externalAgentConfig/import`、`feedback/upload`、`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`mcpServer/tool/call`、`plugin/installed`、`plugin/share/checkout`、`plugin/share/delete`、`plugin/share/list`、`plugin/share/save`、`plugin/share/updateTargets`、`thread/realtime/appendAudio`、`thread/realtime/appendSpeech`、`thread/realtime/appendText`、`thread/realtime/listVoices`、`thread/realtime/start` 和 `thread/realtime/stop` MUST 都能在源码接入点中被发现
- **AND** 非机器生成源码中不应只通过测试排除正则声明这些 method 已完成

### Requirement: Environment and external agent config protocols
系统 SHALL 为移动端 Web 提供环境接入与 external agent config 检测/导入 API，并通过 typed app-server gateway 调用 `environment/add`、`externalAgentConfig/detect` 和 `externalAgentConfig/import`。

#### Scenario: Add environment through mobile API
- **WHEN** 已认证的手机浏览器提交环境接入请求
- **THEN** 后端 MUST 校验请求体并调用 `environment/add`
- **AND** 响应 MUST 返回移动端可继续展示或轮询的环境接入结果

#### Scenario: Detect and import external agent config
- **WHEN** 已认证的手机浏览器请求检测或导入 external agent config
- **THEN** 后端 MUST 分别调用 `externalAgentConfig/detect` 或 `externalAgentConfig/import`
- **AND** 导入结果 MUST 保留成功项、失败项和完成通知所需的关键信息

### Requirement: Feedback upload protocol
系统 SHALL 暴露移动端 feedback 上传 API，并通过 typed gateway 调用 `feedback/upload`，使用户可以从手机浏览器提交问题反馈所需的数据。

#### Scenario: Upload feedback
- **WHEN** 已认证的手机浏览器提交 feedback payload
- **THEN** 后端 MUST 调用 `feedback/upload`
- **AND** 成功响应 MUST 标识上传已被 app-server 接收

#### Scenario: Reject invalid feedback payload
- **WHEN** feedback 请求体缺少必需字段或字段类型不合法
- **THEN** 后端 MUST 返回统一失败响应
- **AND** MUST 不调用 app-server

### Requirement: Marketplace and plugin sharing protocols
系统 SHALL 为移动端 Web 接入 marketplace 管理、插件已安装通知查询和 plugin share 工作流，并调用对应 app-server method：`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`plugin/installed`、`plugin/share/save`、`plugin/share/updateTargets`、`plugin/share/list`、`plugin/share/checkout` 和 `plugin/share/delete`。

#### Scenario: Manage marketplace entries
- **WHEN** 已认证的手机浏览器请求添加、移除或升级 marketplace
- **THEN** 后端 MUST 调用对应 marketplace app-server method
- **AND** 响应 MUST 保留状态、错误信息和移动端后续刷新所需字段

#### Scenario: Manage plugin shares
- **WHEN** 已认证的手机浏览器保存、更新目标、列出、checkout 或删除 plugin share
- **THEN** 后端 MUST 调用对应 `plugin/share/*` app-server method
- **AND** 列表响应 MUST 支持移动端分页或空列表展示

#### Scenario: Read installed plugin result
- **WHEN** 已认证的手机浏览器查询插件安装完成结果
- **THEN** 后端 MUST 调用 `plugin/installed`
- **AND** 响应 MUST 返回安装结果和需要用户继续处理的认证信息

### Requirement: MCP tool call protocol
系统 SHALL 暴露受控的 MCP tool call API，并通过 typed gateway 调用 `mcpServer/tool/call`，让移动端 Web 可以触发已配置 MCP server 的工具调用。

#### Scenario: Call MCP server tool
- **WHEN** 已认证的手机浏览器提交 server、tool name 和 arguments
- **THEN** 后端 MUST 调用 `mcpServer/tool/call`
- **AND** 响应 MUST 返回 tool call 状态、结果内容或错误信息

#### Scenario: MCP tool call validation fails
- **WHEN** MCP tool call 请求缺少 server 或 tool name
- **THEN** 后端 MUST 返回统一失败响应
- **AND** MUST 不调用 app-server

### Requirement: Thread realtime protocols
系统 SHALL 为移动端 Web 接入 thread realtime 控制协议，并调用 `thread/realtime/start`、`thread/realtime/appendAudio`、`thread/realtime/appendText`、`thread/realtime/appendSpeech`、`thread/realtime/stop` 和 `thread/realtime/listVoices`。

#### Scenario: Start and stop realtime session
- **WHEN** 已认证的手机浏览器请求启动或停止 thread realtime
- **THEN** 后端 MUST 调用对应 `thread/realtime/*` app-server method
- **AND** 响应 MUST 返回移动端识别 realtime 会话状态所需字段

#### Scenario: Append realtime input
- **WHEN** 已认证的手机浏览器向 realtime 会话追加 audio、text 或 speech 输入
- **THEN** 后端 MUST 调用对应 append method
- **AND** 二进制或文本输入 MUST 按 generated params 要求转换后发送给 app-server

#### Scenario: List realtime voices
- **WHEN** 已认证的手机浏览器请求可用 realtime voices
- **THEN** 后端 MUST 调用 `thread/realtime/listVoices`
- **AND** 响应 MUST 返回手机端可直接渲染的 voice 列表

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

### Requirement: Auth, audit, docs, and mock behavior
系统 SHALL 对所有新增 HTTP API 执行现有 session 认证、敏感操作审计、mock 模式覆盖，并更新 README 中的中文后端 API 说明。

#### Scenario: Unauthenticated request is rejected
- **WHEN** 未认证浏览器调用任一新增 `/api/codex/*` API
- **THEN** 后端 MUST 返回未登录响应
- **AND** MUST 不调用 app-server

#### Scenario: Sensitive operation is audited
- **WHEN** 已认证浏览器执行 marketplace 写操作、plugin share 写操作、MCP tool call、feedback upload、environment add、external agent import 或 realtime control
- **THEN** 后端 MUST 写入审计日志

#### Scenario: Mock mode supports all new methods
- **WHEN** app-server gateway 运行在 mock 模式
- **THEN** 所有新增方法 MUST 返回确定性 mock 响应
- **AND** 单元测试 MUST 覆盖这些 mock 响应

#### Scenario: Backend API documentation is updated
- **WHEN** 开发者阅读 `README.md`
- **THEN** 文档 MUST 使用中文说明新增 API 的路径、用途、关键请求体和响应形状

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
