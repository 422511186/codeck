## MODIFIED Requirements

### Requirement: 审批卡片显示关键内容与两个按钮
审批卡片 SHALL 显示 request kind、关键内容（命令文本、文件路径与 diff、权限范围、question 文本等）以及适合该 request kind 的操作控件。普通审批类请求 SHALL 提供「拒绝」和「同意」按钮；`question` 请求 SHALL 显示问题文本和每个可选答案，不得把 question 简化为普通 approve/deny。

#### Scenario: 命令审批
- **WHEN** 渲染 `command_approval`
- **THEN** 卡片 MUST 显示完整命令
- **AND** MUST 提供「拒绝」「同意」按钮

#### Scenario: 文件审批
- **WHEN** 渲染 `file_approval`
- **THEN** 卡片 MUST 显示文件路径
- **AND** 当请求带有 diff 时 MUST 一并显示
- **AND** MUST 提供「拒绝」「同意」按钮

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

#### Scenario: 其他 kind
- **WHEN** 渲染未知或暂不支持的 request kind
- **THEN** 卡片 MUST 显示对应文本
- **AND** MUST 至少提供两个操作（同意 / 拒绝 或 等价语义），除非该 kind 没有可安全提交的默认响应

### Requirement: 点击审批调用 resolve API
用户点击审批操作 SHALL 调用 `POST /api/codex/requests/:requestId/resolve` 并把 UI 切换为已处理态。不同 request kind MUST 携带能让后端构造正确 app-server response 的语义值；`question` MUST 携带用户选择的 option value。

#### Scenario: 用户点击普通审批
- **WHEN** 用户点击普通审批的「拒绝」或「同意」
- **THEN** 前端 MUST 调用 `POST /api/codex/requests/:requestId/resolve` 携带对应选择值
- **AND** 卡片 MUST 立即标记为已处理

#### Scenario: 用户回答 question
- **WHEN** 用户点击 `question` 卡片中的某个答案
- **THEN** 前端 MUST 调用 `POST /api/codex/requests/:requestId/resolve` 携带该答案的 option value
- **AND** 前端 MUST NOT 发送 `{decision: "approve"}` 或 `{decision: "deny"}` 作为 question response
- **AND** 卡片 MUST 立即标记为已处理

#### Scenario: 调用失败
- **WHEN** resolve API 返回失败
- **THEN** timeline MUST 插入一张错误卡片或在卡片内显示错误
- **AND** 审批卡片 MUST 恢复可点状态
- **AND** 如果 request 仍处于 pending 状态，用户 MUST 能再次提交

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
