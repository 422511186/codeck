# approval-inline-cards Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 审批一律在 timeline 内嵌呈现
所有 app-server `server-request`（包括 `command_approval`、`file_approval`、`permissions_approval`、`question`、`mcp_elicitation`、`dynamic_tool` 等）SHALL 在 timeline 中以内嵌卡片呈现，不弹 modal、不跳转独立页面。

#### Scenario: 收到审批请求
- **WHEN** 前端从 `/ws` 收到 `server-request`
- **AND** 当前会话页是该 thread 所在页
- **THEN** timeline MUST 在对应位置插入一张审批卡片

#### Scenario: 不做跨会话 inbox
- **WHEN** 多个会话都有待审批请求
- **THEN** 系统 MUST 不提供任何跨会话的审批汇总入口
- **AND** 用户 MUST 必须进入各自会话查看

### Requirement: 多张审批依次内嵌
当一段时间内连续出现多个审批请求时 SHALL 在 timeline 上按顺序依次内嵌，每张审批一张卡片。

#### Scenario: 连续审批
- **WHEN** 短时间内出现 N 张审批请求
- **THEN** timeline MUST 按到达顺序插入 N 张卡片
- **AND** MUST 不合并或堆叠

### Requirement: 审批卡片显示关键内容与两个按钮
审批卡片 SHALL 显示 request kind、关键内容（命令文本、文件路径与 diff、权限范围、question 文本等）以及适合该 request kind 的操作控件。普通审批类请求 MUST 按 app-server 提供的可支持 options 分别展示一次允许、会话允许、规则修订、拒绝或中断等操作；`question` 请求 SHALL 显示问题文本和每个可选答案，不得把 question 简化为普通 approve/deny。

#### Scenario: 命令审批
- **WHEN** 渲染带 `availableDecisions` 的 `command_approval`
- **THEN** 卡片 MUST 显示完整命令
- **AND** MUST 为每个可支持 decision 显示语义明确的独立操作
- **AND** `accept` 与 `acceptForSession` 同时存在时 MUST 分别显示「允许一次」与「本次会话允许」

#### Scenario: 结构化命令审批
- **WHEN** `availableDecisions` 包含 execpolicy 或 network amendment 对象
- **THEN** 卡片 MUST 显示对应的规则操作文案
- **AND** MUST NOT 把结构化 decision 展示或提交为 JSON 字符串

#### Scenario: 文件审批
- **WHEN** 渲染 `file_approval`
- **THEN** 卡片 MUST 显示文件路径
- **AND** 当请求带有 diff 时 MUST 一并显示
- **AND** MUST 提供「拒绝」和「允许」操作

#### Scenario: question
- **WHEN** 渲染 `question`
- **THEN** 卡片 MUST 显示 question 文本
- **AND** MUST 按 app-server 提供的 options 渲染可点击答案
- **AND** 每个答案 MUST 使用 option label 作为主文本，存在 description 时 MUST 显示说明
- **AND** 点击答案时 MUST 提交该 option 的 value，而不是提交 `approve` 或 `deny`

#### Scenario: question without options
- **WHEN** 渲染 `question` 但没有可提交 options
- **THEN** 卡片 MUST 显示无法在移动端回答的提示
- **AND** MUST 不显示会提交无效 response 的按钮

#### Scenario: Unsupported approval decision
- **WHEN** app-server 提供当前客户端无法安全表达的 decision
- **THEN** 卡片 MUST 显示兼容性提示并禁用该 decision
- **AND** MUST 保留请求中可安全提交的拒绝或取消操作
- **AND** MUST NOT 猜测未知 response

#### Scenario: 其他 kind
- **WHEN** 渲染未知或暂不支持的 request kind
- **THEN** 卡片 MUST 显示对应文本
- **AND** MUST 只提供协议允许且客户端能够安全构造的操作

### Requirement: 审批按钮无默认聚焦
审批卡片上的所有 decision 按钮 SHALL 不预先聚焦任意一个，防止误点。

#### Scenario: 渲染时
- **WHEN** 审批卡片首次出现
- **THEN** 所有 decision 按钮 MUST 都处于未聚焦状态

### Requirement: 点击审批调用 resolve API
用户点击审批操作 SHALL 调用 `POST /api/codex/requests/:requestId/resolve` 并把 UI 切换为已处理态。普通审批 MUST 提交当前 pending request 提供的不透明 option value，由 gateway 验证其请求归属并恢复原始 decision；`question` MUST 携带用户选择的 option value。

#### Scenario: 用户点击普通审批
- **WHEN** 用户点击普通审批中的任一可用 decision
- **THEN** 前端 MUST 调用 `POST /api/codex/requests/:requestId/resolve` 携带该 option value
- **AND** gateway MUST 验证该 option 属于当前未处理请求
- **AND** 卡片 MUST 在调用成功后标记为已处理

#### Scenario: 用户选择本次会话允许
- **WHEN** 用户点击 `acceptForSession` 对应的「本次会话允许」
- **THEN** gateway MUST 向 app-server 提交 `{decision: "acceptForSession"}`
- **AND** MUST NOT 降级为普通 `accept`

#### Scenario: 用户选择结构化 decision
- **WHEN** 用户点击 execpolicy 或 network amendment 对应选项
- **THEN** gateway MUST 从原始 pending request 恢复该对象
- **AND** MUST 以原始对象作为 `decision` 提交给 app-server

#### Scenario: 用户回答 question
- **WHEN** 用户点击 `question` 卡片中的某个答案
- **THEN** 前端 MUST 调用 `POST /api/codex/requests/:requestId/resolve` 携带该答案的 option value
- **AND** 前端 MUST NOT 发送 `{decision: "approve"}` 或 `{decision: "deny"}` 作为 question response
- **AND** 卡片 MUST 立即标记为已处理

#### Scenario: Unknown or stale option
- **WHEN** resolve API 收到不属于当前 pending request、已过期或未知的 option value
- **THEN** gateway MUST 拒绝请求且 MUST NOT 响应 app-server
- **AND** 审批卡片 MUST 恢复可操作或显示已失效状态

#### Scenario: 调用失败
- **WHEN** resolve API 返回失败
- **THEN** timeline MUST 插入一张错误卡片或在卡片内显示错误
- **AND** 审批卡片 MUST 恢复可点状态
- **AND** 如果 request 仍处于 pending 状态，用户 MUST 能再次提交

### Requirement: 失效审批标灰且不可操作
当审批通过其他渠道被 resolve（其他客户端、turn 已结束、`server-request-resolved` 已到达）时 SHALL 把对应卡片标灰、按钮置为不可点。

#### Scenario: 外部 resolve
- **WHEN** 收到 `server-request-resolved` 对应原本 timeline 上的某张卡片
- **THEN** 该卡片 MUST 切换为灰色样式
- **AND** 两个按钮 MUST 不可点

#### Scenario: turn 已结束
- **WHEN** 该审批所在 turn 已收到 completed 事件并且审批仍未被处理
- **THEN** 该卡片 MUST 自动标灰并禁用

### Requirement: 进入会话时拉取待处理审批
进入某个会话页时 SHALL 调用 `GET /api/codex/requests` 拉取该 thread 未处理的审批和 question，并把它们补到 timeline 对应位置。

#### Scenario: 初次进入会话
- **WHEN** 用户进入会话页
- **THEN** 前端 MUST 调用 `GET /api/codex/requests`
- **AND** MUST 把属于当前 thread 且未处理的请求渲染到 timeline 上

#### Scenario: Pending question after reload
- **WHEN** 用户刷新或重新进入包含未回答 `question` 的会话页
- **THEN** 前端 MUST 从 `GET /api/codex/requests` 恢复该 question 卡片
- **AND** 用户 MUST 能继续选择答案并提交

### Requirement: Dynamic tool request actions use protocol values
`dynamic_tool` 审批卡 SHALL 使用 app-server 归一化后的 `submit` 和 `fail` 操作值。后端 MUST 按该值构造 dynamic tool response，不得把通用 approve/deny 值当作工具输出。

#### Scenario: Dynamic tool submit
- **WHEN** 用户在 `dynamic_tool` 请求上选择 `submit`
- **THEN** 后端 MUST 构造 `{success: true, contentItems: [{type: "inputText", text: value}]}`

#### Scenario: Dynamic tool fail
- **WHEN** 用户在 `dynamic_tool` 请求上选择 `fail`
- **THEN** 后端 MUST 构造 `{success: false, contentItems: [{type: "inputText", text: "用户在移动端标记动态工具调用失败"}]}`

### Requirement: File approval details include diff when present
`file_approval` 卡片 SHALL 显示文件路径；当 request payload 包含 diff、patch 或 file changes 字段时，卡片 MUST 显示可审查的变更内容。

#### Scenario: File approval with diff
- **WHEN** `file_approval` request 包含 `path` 和 `diff`
- **THEN** 卡片 MUST 同时显示路径和 diff

