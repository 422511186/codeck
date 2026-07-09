# audit-and-security Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Audit event append
系统 SHALL 将审计事件追加写入 JSONL 文件（默认 `logs/audit.jsonl`）。每条记录 MUST 包含 `at`（ISO 时间戳）、`action`、`actor` 和 `detail`（可选）。

#### Scenario: Append audit event
- **WHEN** 任何需要审计的操作完成
- **THEN** 调用 `appendAuditEvent(auditLogPath, {action, actor: "mobile-web", detail})`，以 JSONL 格式追加到审计日志文件

#### Scenario: Audit log directory auto-created
- **WHEN** 审计日志路径的父目录不存在
- **THEN** 自动创建父目录（`recursive: true`）

### Requirement: Sensitive field redaction
系统 SHALL 在审计日志中对包含 `token`、`secret`、`password`、`url` 关键字（不区分大小写）的字段值脱敏为 `"[redacted]"`。脱敏 MUST 递归处理嵌套对象和数组。

#### Scenario: Redact token field
- **WHEN** detail 包含 `{accessToken: "sk-abc123"}`
- **THEN** 记录为 `{accessToken: "[redacted]"}`

#### Scenario: Redact nested secret
- **WHEN** detail 包含 `{config: {apiSecret: "xxx"}}`
- **THEN** 递归脱敏，记录为 `{config: {apiSecret: "[redacted]"}}`

#### Scenario: Non-sensitive field preserved
- **WHEN** detail 包含 `{command: "npm test"}`
- **THEN** 原样记录 `{command: "npm test"}`

### Requirement: Workspace roots normalization
系统 SHALL 将 workspaceRoots 标准化为绝对路径（通过 `path.resolve`），自动检测 Windows 或 POSIX 风格。至少 MUST 配置一个 workspaceRoot。

#### Scenario: Normalize workspace roots
- **WHEN** 配置的 workspaceRoots 为 `["/workspace", "C:\\Users\\project"]`
- **THEN** 每个路径 resolve 为绝对路径，标记路径风格（windows/posix）

#### Scenario: No workspace roots configured
- **WHEN** 解析后 workspaceRoots 为空
- **THEN** 抛出 `"至少需要配置一个工作区根目录"`

### Requirement: Path allowed assertion
系统 SHALL 确保候选路径是某个 workspaceRoot 或其子路径。Windows 路径比较 MUST 大小写不敏感。返回值 MUST 为标准化后的路径。

#### Scenario: Path inside workspace
- **WHEN** 候选路径是某个 workspaceRoot 的子路径
- **THEN** 返回标准化后的绝对路径

#### Scenario: Path is workspace root itself
- **WHEN** 候选路径等于某个 workspaceRoot
- **THEN** 返回该 workspaceRoot

#### Scenario: Path outside workspace
- **WHEN** 候选路径不在任何 workspaceRoot 下
- **THEN** 抛出 `"路径不在允许的工作区范围内"`

#### Scenario: Empty path rejected
- **WHEN** 候选路径为空或仅空白
- **THEN** 抛出 `"路径不能为空"`

### Requirement: Workspace roots allowed assertion
系统 SHALL 支持批量校验 workspaceRoots 列表中的每个路径。

#### Scenario: All roots valid
- **WHEN** 候选 roots 列表中的每个路径都在允许范围内
- **THEN** 返回标准化后的路径数组

#### Scenario: Some roots invalid
- **WHEN** 候选 roots 列表中有不在允许范围内的路径
- **THEN** 抛出路径越界错误

### Requirement: Audit operations catalog
系统 SHALL 对特定操作记录审计日志，包含操作名称和上下文相关字段。以下操作 MUST 记录审计日志：thread.start、turn.start、fs.file.write、fs.directory.create、fs.path.remove、fs.path.copy、fs.watch、fs.unwatch、commandExec.spawn、process.spawn、process.stdin.write、process.resizePty、process.kill、config.value.write、request.resolve、account.login.chatgpt、account.login.apiKey、account.logout、remoteControl.enable、remoteControl.disable、upload.image、thread.delete、thread.name.set。以下操作当前不记录审计日志：thread.list/read/search、fs.readFile、fs.readDirectory、fs.getMetadata、fs.search、plugin.install/uninstall、mcpServer/oauth/login、mcpServer/resource/read、windowsSandbox/*、experimentalFeature/*。

#### Scenario: Audited operation records event
- **WHEN** 用户执行 `thread.start` 操作
- **THEN** 审计日志记录 `{action: "thread.start", detail: {cwd, workspaceRoots, model, permissions}}`

#### Scenario: Non-audited operation skips logging
- **WHEN** 用户执行 `fs.readFile` 操作
- **THEN** 审计日志不产生任何记录

#### Scenario: API Key login records key length only
- **WHEN** 用户使用 API Key 登录
- **THEN** 审计日志记录 `{action: "account.login.apiKey", detail: {keyLength: N}}`，不记录 key 值

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

### Requirement: Proxy path inputs are validated before app-server calls
Web 代理层 SHALL 在调用 app-server 前校验所有代表本机路径或工作目录的浏览器输入。除已有 Open Questions 明确暂不覆盖的入口外，路径 MUST 在 `CODEX_WEB_WORKSPACE_ROOTS` 或该入口明确允许的额外根目录内。

#### Scenario: Terminal exec requires allowed cwd
- **WHEN** 已认证用户 POST `/api/codex/terminal/exec` 且 `cwd` 缺失、为空或不在 allowlist 内
- **THEN** 系统 MUST 拒绝请求，不得调用 app-server `command/exec`

#### Scenario: Feedback extra log files are constrained
- **WHEN** 已认证用户 POST `/api/codex/feedback/upload` 且 `extraLogFiles` 包含 workspace/upload allowlist 外路径
- **THEN** 系统 MUST 拒绝该路径，不得把任意本机路径透传给 app-server

#### Scenario: External agent config cwd is constrained
- **WHEN** external agent config detect/import 请求包含 repo-scoped `cwd`
- **THEN** 每个 `cwd` MUST 通过 workspace allowlist 校验后才可发送给 app-server

#### Scenario: Windows sandbox setup cwd is constrained
- **WHEN** Windows Sandbox setup 请求提供 `cwd`
- **THEN** 该 `cwd` MUST 通过 workspace allowlist 校验后才可发送给 app-server

#### Scenario: Plugin installed cwds are constrained
- **WHEN** 已认证用户 POST `/api/codex/plugins/installed` 且 `cwds` 包含 workspace allowlist 外路径
- **THEN** 系统 MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server `plugin/installed`

### Requirement: Malformed JSON request bodies return client errors
Web 代理层 SHALL 将 JSON 解析失败、非对象 JSON body、字段类型错误和必填字段缺失视为客户端请求错误。此类错误 MUST 返回 400，而不是伪装为 app-server 代理失败。任何使用 JSON body 的 `/api/codex/*` route MUST 在完成 JSON 解析和字段校验前不调用 app-server。

#### Scenario: Invalid JSON body
- **WHEN** 已认证用户向使用 JSON body 的 `/api/codex/*` route 发送 malformed JSON
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server

#### Scenario: Non-object JSON body
- **WHEN** 已认证用户向使用对象 body 的 `/api/codex/*` route 发送 JSON array、string、number、boolean 或 null
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server

#### Scenario: Invalid field type
- **WHEN** 已认证用户向使用 JSON body 的 `/api/codex/*` route 发送字段类型错误的 JSON 对象
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 调用 app-server

#### Scenario: Malformed JSON does not fall back to empty object
- **WHEN** route 当前业务逻辑支持空对象作为默认输入
- **AND** 已认证用户发送 malformed JSON
- **THEN** route MUST 返回 HTTP 400
- **AND** MUST NOT 将请求当作 `{}` 处理
- **AND** MUST NOT 调用 app-server

