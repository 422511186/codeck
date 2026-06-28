## MODIFIED Requirements

### Requirement: Pending server request tracking
系统 SHALL 在 Gateway 内存中维护 `pendingServerRequests: Map<id, PendingServerRequestView>`，记录来自 app-server 的审批请求和 question 请求。

#### Scenario: Server request received
- **WHEN** app-server 发送 server request（如命令审批、文件审批、用户问题）
- **THEN** 将其归一化为 `PendingServerRequestView`，存入 pendingServerRequests Map，通过 WebSocket 推送 `{type: "server-request", request}` 到浏览器

#### Scenario: Server request resolved
- **WHEN** 已认证用户 POST `/api/codex/requests/{requestId}/resolve` 并提供可构造 response 的值或完整 response
- **THEN** 从 pendingServerRequests 中查找并验证 requestId 存在，构造或使用对应 app-server response，调用 `peer.respondToServerRequest(id, response)`
- **AND** 只有当 `peer.respondToServerRequest` 成功后，系统 SHALL 从 Map 中删除该 request
- **AND** 只有成功后，系统 SHALL 推送 `{type: "server-request-resolved", requestId}` 到浏览器

#### Scenario: Server request resolve failed
- **WHEN** `peer.respondToServerRequest(id, response)` 抛出错误或 app-server 拒绝 response
- **THEN** 系统 MUST 保留 pendingServerRequests 中的该 request
- **AND** 系统 MUST NOT 推送 `server-request-resolved`
- **AND** API MUST 返回错误，使前端能够显示失败并允许用户重试

#### Scenario: Unknown request ID rejected
- **WHEN** requestId 不存在于 pendingServerRequests 中
- **THEN** 抛出 `"找不到待处理请求"`

### Requirement: Server request kind normalization
系统 SHALL 将 app-server 的 server request 方法归一化为以下种类：
- `item/commandExecution/requestApproval` → `command_approval`
- `item/fileChange/requestApproval` → `file_approval`
- `item/permissions/requestApproval` → `permissions_approval`
- `item/tool/requestUserInput` → `question`
- `mcpServer/elicitation/request` → `mcp_elicitation`
- `item/tool/call` → `dynamic_tool`
- 其他 → `unknown`

#### Scenario: Command approval request
- **WHEN** app-server 发送 `item/commandExecution/requestApproval`
- **THEN** 归一化为 `{kind: "command_approval", title: "命令审批", options: approvalOptions}`

#### Scenario: User input question request
- **WHEN** app-server 发送 `item/tool/requestUserInput`
- **THEN** 归一化为 `{kind: "question", title: "需要你回答", description: <question text>, options: <question options>}`
- **AND** 每个 option 的 value MUST 优先使用 option `id`，没有 id 时使用 option `label`
- **AND** 每个 option 的 label MUST 使用 option `label`
- **AND** option description 存在时 MUST 保留

#### Scenario: Dynamic tool call request
- **WHEN** app-server 发送 `item/tool/call`
- **THEN** 归一化为 `{kind: "dynamic_tool", title: "动态工具调用", options: [{value: "submit", label: "回传结果"}, {value: "fail", label: "标记失败"}]}`

### Requirement: Server request response construction
系统 SHALL 根据请求种类构建不同格式的响应：
- `command_approval` / `file_approval`：`{decision: value}`
- `permissions_approval`（accept）：`{permissions: <from params>, scope: "session"}`
- `permissions_approval`（decline）：`{permissions: {}, scope: "turn"}`
- `question`：`{answers: {[questionId]: {answers: [value]}}}`
- `mcp_elicitation`：`{action: value, content: value === "accept" ? {} : null, _meta: null}`
- `dynamic_tool`（submit）：`{success: true, contentItems: [{type: "inputText", text: value}]}`
- `dynamic_tool`（fail）：`{success: false, contentItems: [{type: "inputText", text: "用户在移动端标记动态工具调用失败"}]}`

#### Scenario: Accept command approval
- **WHEN** 用户选择 "accept" 回应命令审批
- **THEN** 发送 `{decision: "accept"}` 给 app-server

#### Scenario: Decline permissions approval
- **WHEN** 用户选择 "decline" 回应权限审批
- **THEN** 发送 `{permissions: {}, scope: "turn"}` 给 app-server

#### Scenario: Answer question
- **WHEN** 用户选择 value 为 `"fast"` 的 question 选项，且 question id 为 `"mode"`
- **THEN** 发送 `{answers: {mode: {answers: ["fast"]}}}` 给 app-server
- **AND** response 顶层 MUST 包含 `answers`
- **AND** response MUST NOT 包含 `{decision: "approve"}` 或 `{decision: "deny"}`

#### Scenario: Question without id
- **WHEN** question params 不包含可用 question id
- **THEN** 系统 MUST 不构造会被 app-server 拒绝的空 answers response
- **AND** API 或 UI MUST 返回清晰错误，提示该 question 无法回答
