# turn-interaction Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Turn start with input validation
系统 SHALL 在启动 turn 前校验 `threadId` 非空和 `text` 非空。imagePaths MUST 经过 `assertRuntimePathAllowed` 校验（额外允许 uploadDir 作为根路径）。操作 MUST 记录审计日志（仅记录 textLength，不记录文本内容）。

#### Scenario: Start turn with valid input
- **WHEN** 已认证用户 POST `/api/codex/turns/start` 提供非空 threadId 和 text
- **THEN** 校验 imagePaths 在 workspace 或 uploadDir 范围内，调用 `gateway.startTurn()`，记录审计日志 `{textLength, imageCount, model, ...}`，返回 `{ok: true, turnId, thread}`

#### Scenario: Missing threadId
- **WHEN** 请求不提供 threadId
- **THEN** 返回 HTTP 400 和 `{ok: false, error: "threadId 不能为空"}`

#### Scenario: Empty text
- **WHEN** text 为空或仅空白
- **THEN** 返回 HTTP 400 和 `{ok: false, error: "消息不能为空"}`

#### Scenario: Image path outside workspace
- **WHEN** imagePaths 中的路径不在 workspace 和 uploadDir 范围内
- **THEN** `assertRuntimePathAllowed` 抛出错误，返回 HTTP 502

### Requirement: Turn interrupt
系统 SHALL 支持中断正在进行的 turn。

#### Scenario: Interrupt turn
- **WHEN** 已认证用户 POST `/api/codex/turns/{threadId}/interrupt`
- **THEN** 调用 `gateway.interruptTurn()`

### Requirement: Turn steer
系统 SHALL 支持在 turn 进行中追加用户输入。

#### Scenario: Steer turn
- **WHEN** 已认证用户 POST `/api/codex/turns/{threadId}/steer` 并提供 text
- **THEN** 调用 `gateway.steerTurn()`，返回 `{turnId}`

### Requirement: User input construction
系统 SHALL 将用户输入构造为 `UserInput[]` 数组，包含一个 `type: "text"` 元素、零到多个 `type: "skill"` 元素和零到多个 `type: "localImage"` 元素。text MUST trim 后非空，skill name/path MUST trim 后非空，image path MUST trim 后非空。skill 引用 MUST 使用 app-server 官方 `{type: "skill", name, path}` 结构，不得拼接到 text 中。

#### Scenario: Text-only input
- **WHEN** 调用 `createTurnUserInput("hello")`
- **THEN** 返回 `[{type: "text", text: "hello", text_elements: []}]`

#### Scenario: Text with images
- **WHEN** 调用 `createTurnUserInput("hello", ["/path/a.png"])`
- **THEN** 返回 `[{type: "text", ...}, {type: "localImage", path: "/path/a.png"}]`

#### Scenario: Text with skill references
- **WHEN** 调用 `createTurnUserInput("hello", [], [{name: "openai-docs", path: "/skills/openai-docs/SKILL.md"}])`
- **THEN** 返回 `[{type: "text", ...}, {type: "skill", name: "openai-docs", path: "/skills/openai-docs/SKILL.md"}]`
- **AND** text MUST 保持 `"hello"`，不得追加 skill 名称或说明文本

#### Scenario: Validate skill references for thread cwd
- **WHEN** `/api/codex/turns/start` 请求包含 skill 引用
- **THEN** 系统 MUST 使用当前 thread 的 `cwd` 调用 `skills/list`
- **AND** skill 引用的 `{name,path}` MUST 存在于该 `cwd` 可见的已启用 skill 列表中

#### Scenario: Blank text rejected
- **WHEN** 调用 `createTextUserInput("  ")`
- **THEN** 抛出 `"消息不能为空"`

#### Scenario: Blank skill rejected
- **WHEN** 调用 `createTurnUserInput("hello", [], [{name: " ", path: "/skills/a/SKILL.md"}])`
- **THEN** 抛出 `"Skill 引用不能为空"`

### Requirement: Image upload
系统 SHALL 仅接受 `.png`、`.jpg`、`.webp`、`.gif` 扩展名的图片上传。上传后 MUST 清理超过 24 小时的旧上传。存储路径 MUST 通过 `resolve` + `startsWith` 检查防止路径越界。

#### Scenario: Upload valid image
- **WHEN** 已认证用户 POST `/api/codex/uploads/images` 并提供有效图片文件
- **THEN** 保存到 uploadDir，返回 `{ok: true, image: {id, path, mimeType, size}}`

#### Scenario: Invalid extension rejected
- **WHEN** 上传文件扩展名不在白名单中
- **THEN** 抛出 `"只支持图片上传"`

#### Scenario: Path traversal prevented
- **WHEN** 生成的文件路径不以 uploadDir 根路径开头
- **THEN** 抛出 `"上传路径越界"`

#### Scenario: Expired upload cleanup
- **WHEN** 上传新图片时
- **THEN** 先调用 `cleanupExpiredUploads(uploadDir, {maxAgeMs: 86400000})` 删除超过 24 小时的文件

**Open Questions**

1. **turn.start 后立即 readThread**：`startTurn` 返回后立即调用 `readThread` 获取最新 thread 状态，但 app-server 的通知（如 agent message delta）可能在 readThread 之后才到达。前端拿到的 thread 可能不包含最新输出。是否需要等待特定通知后再返回？
2. **图片上传大小限制缺失**：代码中没有对上传图片的大小做限制。是否需要添加 body size 限制？
3. **upload 路径越界检查使用 `startsWith`**：`uploads.ts` 使用 `filePath.startsWith(root + "\\")` 进行路径越界检查，在 Windows 上存在大小写敏感性问题（`C:\Uploads` vs `c:\uploads`）。而 `workspace-policy.ts` 在 Windows 上做了 `toLowerCase` 比较，两者不一致。

### Requirement: Lightweight turn start preserves client message identity
`turn/start` Web API MAY 返回轻量 `{turnId}`，但客户端 SHALL 将该 `turnId` 与本次发送的 `clientUserMessageId` 稳定绑定。绑定后的 optimistic user message MUST 保持可确认、可 rewind/fork，并且 MUST NOT 因后续相同文本发送而被合并。

#### Scenario: Lightweight start for repeated prompt
- **WHEN** `turn/start` 只返回 `{turnId}`
- **AND** 用户随后发送另一条相同文本消息并获得不同 `turnId`
- **THEN** 两个 optimistic user message MUST 分别绑定各自 `turnId`
- **AND** 服务端确认任一 user item 时 MUST 按 client id 或 turn id 替换对应 entry

### Requirement: Image preview path constraints
系统 SHALL 支持通过 `/api/codex/images/preview` 预览图片。预览路径 MUST 通过 allowlist 校验，仅允许 `CODEX_WEB_WORKSPACE_ROOTS` 和 `CODEX_WEB_UPLOAD_DIR` 内的图片文件。系统 MUST NOT 默认允许整个系统临时目录作为图片预览根目录。

#### Scenario: Preview workspace image
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<workspace-image>`
- **AND** path 位于 workspace allowlist 内且扩展名为 `.png`、`.jpg`、`.jpeg`、`.webp` 或 `.gif`
- **THEN** route MUST 返回对应图片内容和正确 content-type

#### Scenario: Preview uploaded image
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<uploaded-image>`
- **AND** path 位于 `CODEX_WEB_UPLOAD_DIR` 内且扩展名为支持的图片类型
- **THEN** route MUST 返回对应图片内容和正确 content-type

#### Scenario: Preview tmpdir image rejected
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<tmpdir-image>`
- **AND** path 不在 workspace roots 或 uploadDir 内
- **THEN** route MUST 拒绝该请求
- **AND** MUST NOT 读取该文件

#### Scenario: Preview unsupported extension rejected
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<non-image>`
- **THEN** route MUST 拒绝该请求
- **AND** MUST NOT 读取该文件

### Requirement: Final stream failure remains a single explicit retryable turn
Web SHALL 为一次发送只创建一个 turn。上游流最终失败时，Web MUST 保留失败用户消息和原始错误信息，并仅在用户显式选择重试时创建新的 turn。

#### Scenario: Upstream Responses stream disconnects
- **WHEN** app-server 上报 `stream disconnected before completion` 且不再重试
- **THEN** 当前用户消息 MUST 标记为失败
- **AND** Web MUST NOT 自动再次调用 `turn/start`
- **AND** 用户 SHALL 能通过显式“重试”重新发送原文本、图片和 skill 引用

#### Scenario: Duplicate start request uses the same client message id
- **WHEN** 相同 `clientUserMessageId` 在去重窗口内重复到达 start API
- **THEN** 服务端 MUST 复用同一个进行中的请求
- **AND** app-server MUST NOT 收到第二个 `turn/start`

