## ADDED Requirements

### Requirement: Ordinary file upload
系统 SHALL 提供认证的 `POST /api/codex/uploads/files`，每个请求只接受一个非图片普通文件。服务端 MUST 将文件保存到 `CODEX_WEB_UPLOAD_DIR` 下由 UUID 和受限扩展名组成的路径，并返回 `{ok: true, file: {id, name, path, mimeType, size}}`。单文件 MUST 非空且不超过 20 MiB，原始名称 MUST 清理控制字符并限制长度。

#### Scenario: Upload valid ordinary file
- **WHEN** 已认证用户向 `/api/codex/uploads/files` 提交一个 20 MiB 以内的非空普通文件
- **THEN** 服务端 MUST 保存文件并返回结构化 file 元数据
- **AND** 保存路径 MUST NOT 直接使用用户提供的原始文件名

#### Scenario: Missing file
- **WHEN** 请求未包含 `file` 或包含的值不是 File
- **THEN** 服务端 MUST 返回 HTTP 400
- **AND** MUST NOT 创建上传文件

#### Scenario: Empty or oversized file
- **WHEN** 普通文件大小为 0 或超过 20 MiB
- **THEN** 服务端 MUST 返回 HTTP 400 和明确的大小错误
- **AND** MUST NOT 把文件写入 uploadDir

#### Scenario: Supported image sent to file endpoint
- **WHEN** 文件 MIME 与扩展名匹配现有图片白名单
- **THEN** `/api/codex/uploads/files` MUST 拒绝该请求并提示使用图片上传流程
- **AND** MUST NOT 把图片保存为普通文件附件

#### Scenario: Expired uploads are cleaned before save
- **WHEN** 用户上传新的普通文件
- **THEN** 服务端 MUST 在保存前清理 uploadDir 中超过 24 小时的旧上传

### Requirement: File references participate in send identity
普通文件引用 SHALL 参与客户端重复发送 key 与服务端 turn/start 幂等指纹。文件引用的增加、移除或替换 MUST 被视为 payload 变化；同一发送动作的网络结果未知时，重试 MUST 复用原 `clientUserMessageId` 和未修改的 `fileReferences`。

#### Scenario: Same text with different files
- **WHEN** 两次发送使用相同文本但携带不同 `fileReferences`
- **THEN** 客户端 MUST 将它们视为不同 payload
- **AND** 每次成功发送 MUST 创建并绑定各自的 turn

#### Scenario: Ambiguous retry reuses file payload
- **WHEN** 带普通文件的 turn/start 结果未知
- **AND** 用户重试同一发送动作
- **THEN** 客户端 MUST 复用原 `clientUserMessageId` 和相同 `fileReferences`
- **AND** 服务端 MUST NOT 因重试创建第二个等价 turn

## MODIFIED Requirements

### Requirement: Turn start with input validation
系统 SHALL 在启动 turn 前校验 `threadId` 非空和 `text` 非空。`imagePaths` MUST 经过 `assertRuntimePathAllowed` 校验（额外允许 uploadDir 作为根路径）。`fileReferences` MUST 校验结构、数量、总大小、uploadDir 词法边界、canonical real path 与普通文件类型；单条消息普通文件 MUST 不超过 10 个且合计不超过 50 MiB。操作 MUST 记录审计日志（仅记录原始 textLength、imageCount、fileCount 和 fileBytes，不记录文本、文件名或文件内容）。

#### Scenario: Start turn with valid input
- **WHEN** 已认证用户 POST `/api/codex/turns/start` 提供非空 threadId、text 和合法附件
- **THEN** 系统 MUST 校验 imagePaths 与 fileReferences
- **AND** MUST 调用 `gateway.startTurn()`
- **AND** MUST 记录审计日志 `{textLength, imageCount, fileCount, fileBytes, model, ...}`
- **AND** MUST 返回 `{ok: true, turnId}`

#### Scenario: Missing threadId
- **WHEN** 请求不提供 threadId
- **THEN** 返回 HTTP 400 和 `{ok: false, error: "threadId 不能为空"}`

#### Scenario: Empty text
- **WHEN** text 为空或仅空白
- **THEN** 返回 HTTP 400 和 `{ok: false, error: "消息不能为空"}`

#### Scenario: Image path outside workspace
- **WHEN** imagePaths 中的路径不在 workspace 和 uploadDir 范围内
- **THEN** `assertRuntimePathAllowed` MUST 抛出错误并阻止启动 turn

#### Scenario: Invalid file reference path
- **WHEN** fileReferences 包含 uploadDir 外路径、符号链接逃逸路径或非普通文件
- **THEN** 服务端 MUST 返回客户端错误
- **AND** MUST NOT 调用 `gateway.startTurn()`

#### Scenario: File count or aggregate size exceeds limit
- **WHEN** fileReferences 超过 10 个或声明的普通文件合计超过 50 MiB
- **THEN** 服务端 MUST 返回 HTTP 400
- **AND** MUST NOT 调用 `gateway.startTurn()`

#### Scenario: Uploaded file expired before send
- **WHEN** fileReference 通过词法校验但文件本体已经不存在
- **THEN** 服务端 MUST 返回稳定的附件已过期错误
- **AND** MUST NOT 删除引用后降级发送
- **AND** MUST NOT 调用 `gateway.startTurn()`

### Requirement: User input construction
系统 SHALL 将用户输入构造为 `UserInput[]` 数组，包含一个 `type: "text"` 元素、零到多个 `type: "skill"` 元素和零到多个 `type: "localImage"` 元素。text MUST trim 后非空，skill name/path MUST trim 后非空，image path MUST trim 后非空。skill 引用 MUST 使用 app-server 官方 `{type: "skill", name, path}` 结构，不得拼接到 text 中。普通文件 MUST 保持为 Web 自有 `fileReferences`，并在进入 app-server 前由服务端编码到 `type: "text"` 的可信 Files-mentioned 包装；MUST NOT 映射为 `localImage` 或 `mention`。

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

#### Scenario: Text with ordinary files
- **WHEN** 调用 turn 输入构造器并提供已校验的 `{name: "notes.txt", path: "/uploads/id.txt"}`
- **THEN** 第一个 text UserInput MUST 包含 `# Files mentioned by the user:`
- **AND** MUST 包含 `## notes.txt: /uploads/id.txt`
- **AND** MUST 以 `## My request for Codex:` 分隔并保留用户原始文本 `hello`
- **AND** 返回数组 MUST NOT 包含未知 `localFile`、伪造 `localImage` 或文件 `mention`

#### Scenario: Multiple ordinary files preserve selection order
- **WHEN** 输入包含多个已校验普通文件引用
- **THEN** Files-mentioned 包装 MUST 按用户选择顺序列出所有文件
- **AND** 每个文件名与路径 MUST 由服务端结构化数据生成

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

#### Scenario: Unvalidated file reference rejected
- **WHEN** 普通文件引用缺少 id、名称、路径、MIME 或大小，或者名称包含包装控制字符
- **THEN** 系统 MUST 在构造 app-server 输入前拒绝请求
