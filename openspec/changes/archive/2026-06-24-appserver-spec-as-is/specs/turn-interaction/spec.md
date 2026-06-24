## ADDED Requirements

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
系统 SHALL 将用户输入构造为 `UserInput[]` 数组，包含一个 `type: "text"` 元素和零到多个 `type: "localImage"` 元素。text MUST trim 后非空，image path MUST trim 后非空。

#### Scenario: Text-only input
- **WHEN** 调用 `createTurnUserInput("hello")`
- **THEN** 返回 `[{type: "text", text: "hello", text_elements: []}]`

#### Scenario: Text with images
- **WHEN** 调用 `createTurnUserInput("hello", ["/path/a.png"])`
- **THEN** 返回 `[{type: "text", ...}, {type: "localImage", path: "/path/a.png"}]`

#### Scenario: Blank text rejected
- **WHEN** 调用 `createTextUserInput("  ")`
- **THEN** 抛出 `"消息不能为空"`

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
