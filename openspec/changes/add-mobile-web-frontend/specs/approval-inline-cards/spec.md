## ADDED Requirements

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
审批卡片 SHALL 显示 request kind、关键内容（命令文本、文件路径与 diff、权限范围、question 文本等）以及两个底部按钮「拒绝」和「同意」（或语义对应的 deny / allow）。

#### Scenario: 命令审批
- **WHEN** 渲染 `command_approval`
- **THEN** 卡片 MUST 显示完整命令
- **AND** MUST 提供「拒绝」「同意」按钮

#### Scenario: 文件审批
- **WHEN** 渲染 `file_approval`
- **THEN** 卡片 MUST 显示文件路径
- **AND** 当请求带有 diff 时 MUST 一并显示
- **AND** MUST 提供「拒绝」「同意」按钮

#### Scenario: question / 其他
- **WHEN** 渲染 `question` 或其他 kind
- **THEN** 卡片 MUST 显示对应文本与选项
- **AND** MUST 至少提供两个操作（同意 / 拒绝 或 等价语义）

### Requirement: 审批按钮无默认聚焦
审批卡片上的「拒绝 / 同意」按钮 SHALL 不预先聚焦任意一个，防止误点。

#### Scenario: 渲染时
- **WHEN** 审批卡片首次出现
- **THEN** 两个按钮 MUST 都处于未聚焦状态

### Requirement: 点击审批调用 resolve API
用户点击「拒绝 / 同意」 SHALL 立即调用 `POST /api/codex/requests/:requestId/resolve` 并把 UI 切换为已处理态。

#### Scenario: 用户点击
- **WHEN** 用户点击「拒绝」或「同意」
- **THEN** 前端 MUST 调用 `POST /api/codex/requests/:requestId/resolve` 携带对应 response
- **AND** 卡片 MUST 立即标记为已处理

#### Scenario: 调用失败
- **WHEN** resolve API 返回失败
- **THEN** timeline MUST 插入一张错误卡片
- **AND** 审批卡片 MUST 恢复可点状态

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
进入某个会话页时 SHALL 调用 `GET /api/codex/requests` 拉取该 thread 未处理的审批，并把它们补到 timeline 对应位置。

#### Scenario: 初次进入会话
- **WHEN** 用户进入会话页
- **THEN** 前端 MUST 调用 `GET /api/codex/requests`
- **AND** MUST 把属于当前 thread 且未处理的请求渲染到 timeline 上
