## ADDED Requirements

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
系统 SHALL 在 Gateway 内存中维护 `pendingServerRequests: Map<id, PendingServerRequestView>`，记录来自 app-server 的审批请求。

#### Scenario: Server request received
- **WHEN** app-server 发送 server request（如命令审批、文件审批、用户问题）
- **THEN** 将其归一化为 `PendingServerRequestView`，存入 pendingServerRequests Map，通过 WebSocket 推送 `{type: "server-request", request}` 到浏览器

#### Scenario: Server request resolved
- **WHEN** 已认证用户 POST `/api/codex/requests/{requestId}/resolve` 并提供 response
- **THEN** 从 pendingServerRequests 中查找并验证 requestId 存在，调用 `peer.respondToServerRequest(id, response)`，从 Map 中删除，推送 `{type: "server-request-resolved", requestId}` 到浏览器

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

**Open Questions**

1. **审计日志写入失败无降级**：`appendAuditEvent` 使用 `appendFile`，如果磁盘满或路径无效，整个请求会抛错。对于非关键操作（如 list threads），审计失败不应阻止业务。是否需要将审计写入设为 best-effort（catch 错误后仅 console.error）？
2. **审计操作覆盖不完整**：当前仅约一半的写操作记录审计日志。读操作几乎不记录。是否需要为所有写操作增加审计？读操作的审计是否必要（可能产生大量日志）？
3. **request.resolve 的审计包含完整 response**：`request.resolve` 审计记录包含 `{requestId, response: body.response}`。response 中可能包含敏感数据（如权限审批中的 permissions 结构）。是否应该脱敏？
4. **Pending request Map 无大小限制**：`pendingServerRequests` Map 无上限。如果 app-server 频繁发送审批请求而客户端不响应，Map 会持续增长。是否需要设置上限或超时清理？
5. **Server request 审计日志中的 response 是否经过脱敏**：`request.resolve` 记录了完整 response，但 `redact` 函数只匹配 `token/secret/password/url` 关键字。如果 response 包含其他敏感信息（如 API Key、个人数据），不会被自动脱敏。
