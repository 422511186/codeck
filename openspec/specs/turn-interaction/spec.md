# turn-interaction Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
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
`turn/start` Web API MAY 返回轻量 `{turnId}`，但客户端 SHALL 将该 `turnId` 与本次发送的 `clientUserMessageId` 稳定绑定。绑定后的 optimistic user message MUST 保持可确认、可 rewind/fork，并且 MUST NOT 因后续相同文本发送而被合并。若 `turn/start` 的网络结果未知，失败 entry MUST 保留原 `clientUserMessageId`、原始 payload fingerprint、发起时 bootId 和 ambiguous outcome；查询或重试该发送动作 MUST 使用同一 identity。同 boot 内服务端 SHALL 返回已创建的 `turnId` 或继续同一幂等操作；boot 已改变且无法查询或从有界历史唯一确认原动作时，服务端 MUST 失败关闭为 unresolved，MUST NOT 再次启动 turn。

#### Scenario: Lightweight start for repeated prompt
- **WHEN** `turn/start` 只返回 `{turnId}`
- **AND** 用户随后发送另一条相同文本消息并获得不同 `turnId`
- **THEN** 两个 optimistic user message MUST 分别绑定各自 `turnId`
- **AND** 服务端确认任一 user item 时 MUST 按 client id 或 turn id 替换对应 entry

#### Scenario: Accepted turn start response is lost
- **WHEN** 服务端已经按 `clientUserMessageId` 接受 `turn/start` 并创建 turn
- **AND** HTTP 响应在客户端收到 `turnId` 前超时、断开或无法解析
- **THEN** 客户端 MUST 将该发送动作标记为 ambiguous，而不是创建新的发送身份
- **AND** 查询或重试 MUST 复用原 `clientUserMessageId` 和未修改 payload
- **AND** 服务端 MUST 返回已创建的同一 `turnId` 或继续同一幂等操作，MUST NOT 再调用第二次 app-server `turn/start`

#### Scenario: Confirmed rejection permits a new action identity
- **WHEN** 服务端明确返回输入校验拒绝或其他可证明没有创建 turn 的结果
- **AND** 用户修正或重新提交内容形成新的发送动作
- **THEN** 客户端 MAY 为该新动作生成新的 `clientUserMessageId`
- **AND** 客户端 MUST NOT 把结果未知的超时、连接中断、5xx 或解析失败当作已确认拒绝

#### Scenario: Gateway restart does not replay an unresolved start
- **WHEN** 客户端使用旧 boot 的 `clientUserMessageId` 重试 ambiguous start
- **AND** 新 boot 无法从 app-server 或 bounded latest page 唯一确认原 turn
- **THEN** Web MUST 返回显式 unresolved 结果并保留原失败 entry
- **AND** MUST NOT 再次调用 app-server `turn/start`
- **AND** 用户只有明确确认开始新的发送动作时 MAY 生成新 identity

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
Web SHALL 为一次发送只创建一个 turn。上游流最终失败时，Web MUST 保留失败用户消息、原始错误信息和已绑定的 `turnId`，并仅在用户显式选择重试时将原文本、图片和 skill 引用作为新的发送动作创建新 turn。与此不同，发生在 `turn/start` 接受结果尚未知阶段的超时、连接中断、5xx 或响应解析失败 MUST 保留并复用原 `clientUserMessageId`，不得被当作已结束 turn 的新动作重试。

#### Scenario: Upstream Responses stream disconnects
- **WHEN** app-server 上报 `stream disconnected before completion` 且不再重试
- **THEN** 当前用户消息 MUST 标记为失败
- **AND** Web MUST NOT 自动再次调用 `turn/start`
- **AND** 用户 SHALL 能通过显式“重试”将原文本、图片和 skill 引用作为新发送动作重新发送

#### Scenario: Duplicate start request uses the same client message id
- **WHEN** 相同 `clientUserMessageId` 在去重窗口内重复到达 start API
- **THEN** 服务端 MUST 复用同一个进行中的请求或已创建的 turn 结果
- **AND** app-server MUST NOT 收到第二个 `turn/start`

#### Scenario: Ambiguous start failure is not a final stream failure
- **WHEN** 客户端尚未收到 `turnId`，且 `turn/start` 请求因超时、连接中断、5xx 或响应解析失败而结束
- **THEN** Web MUST 将 outcome 记录为 ambiguous 并保留原 `clientUserMessageId`
- **AND** 显式重试该未决发送动作 MUST 查询或复用相同幂等身份
- **AND** 只有已知 turn 随后发生最终 stream failure 后的用户显式重试，才 SHALL 作为新的发送动作生成新身份

### Requirement: Interrupt resolves a known active turn without message reads
中断 route SHALL 优先使用请求中的显式 turnId；缺失时 SHALL 使用 gateway 已知 active turn identity。系统 MUST NOT 为解析中断目标读取完整 timeline、完整 rollout 或猜测历史 turn。

#### Scenario: Interrupt omits turnId after turn start
- **WHEN** gateway 已从 `turn/start` 或 `turn_started` 记录当前 active turnId
- **AND** 中断请求未显式提供 turnId
- **THEN** route MUST 中断该已知 active turn
- **AND** MUST 返回成功响应

#### Scenario: Active turn identity is unavailable
- **WHEN** 中断请求未提供 turnId 且 gateway 没有已知 active turn identity
- **THEN** route MUST 返回稳定 409
- **AND** MUST NOT 读取消息 timeline 解析目标

### Requirement: Successful upstream retry is not a final stream failure

当 app-server 已声明会继续重试当前 turn 时，Web MUST 将该发送动作保持为进行中；只有明确的最终错误才可结束 turn 并建立失败重试入口。

#### Scenario: Retryable 503 does not fail the user message
- **WHEN** Responses 上游返回 503，app-server 发送 `willRetry=true`
- **THEN** Web MUST 保持原用户消息为 sent 或 running 状态
- **AND** Web MUST NOT 创建最终失败错误卡片
- **AND** 后续成功完成 MUST 清理任何兼容旧状态留下的临时错误

### Requirement: Start idempotency honors gateway boot and confirmed rejection boundary
`turn/start` 的 operation cache SHALL 绑定 gateway boot identity。已完成或进行中的结果仅可在 operation boot 与当前 boot 一致时直接复用；跨 boot、Web cache miss 或 ambiguous retry MUST 只执行有界历史唯一恢复，无法确认时 MUST 返回 unresolved，MUST NOT 再次调用 app-server `turn/start`。审计、resume、附件、Skill、模型 readiness 等 app-server 调用前失败 MUST 标记为 confirmed rejection，MUST NOT 污染 operation cache；缓存命中和历史恢复 MUST 不重复执行这些可变步骤。

#### Scenario: Resolved cache belongs to an old boot
- **WHEN** 某 `clientUserMessageId` 已在 boot A 缓存为 resolved，随后 gateway 切换到 boot B
- **THEN** 重复请求 MUST 先从 boot B 的有界历史唯一确认该 turn
- **AND** 找不到时 MUST 返回 unresolved，MUST NOT 直接返回旧 `turnId` 或再次启动 turn

#### Scenario: Ambiguous retry after Web cache loss
- **WHEN** 客户端携带原 boot identity 和 ambiguous retry 标记，但服务端内存中已没有该 operation
- **THEN** 服务端 MUST 只执行 bounded history recovery
- **AND** 无法唯一确认时 MUST NOT 调用 app-server `turn/start`

#### Scenario: Stale start completion cannot overwrite recovery
- **WHEN** boot A 的 start promise 尚未完成时 boot B 已开始同 identity 的 bounded recovery
- **THEN** boot A 的迟到完成或失败 MUST 不得覆盖 boot B 的 operation 状态或结果
- **AND** 所有等待者 MUST 返回最新恢复结果或 unresolved

#### Scenario: Mutable preconditions do not block existing operations
- **WHEN** 已缓存 resolved 结果或 ambiguous recovery 需要确认原 turn，随后附件过期、Skill 被禁用或模型恢复状态改变
- **THEN** 服务端 MUST 直接复用缓存或执行 bounded recovery
- **AND** MUST 不因这些仅用于创建新 turn 的可变前置条件失败而阻断原操作

#### Scenario: Pre-start failure is confirmed rejection
- **WHEN** resume、审计、附件、Skill、模型恢复或其他前置条件失败，且 app-server `turn/start` 尚未被调用
- **THEN** 服务端/客户端 MUST 返回并记录可识别的 confirmed rejection
- **AND** 后续重试 MUST 使用新的发送 identity，MUST NOT 进入原 identity 的 ambiguous recovery

### Requirement: Retry identity follows failed operation state
Timeline 的重试 SHALL 根据原发送动作是否已绑定已知 turn 区分 identity。结果未知的 ambiguous start retry MUST 复用原 `clientUserMessageId`、payload 与 boot identity；已知 turn 的最终失败或明确拒绝后的用户重试 MUST 创建新的 `clientUserMessageId` 和新的 optimistic entry，并保留原失败消息。

#### Scenario: Retry ambiguous start
- **WHEN** 失败用户消息的 `sendOperation.outcome` 为 `ambiguous`
- **THEN** 重试 MUST 复用原 `clientUserMessageId` 和 `sendOperation.bootId`
- **AND** 请求 MUST 标记为 ambiguous recovery，成功后 MUST 清理临时“结果未确认”错误卡

#### Scenario: Retry final failure or confirmed rejection
- **WHEN** 用户消息已绑定 turn 且最终失败，或原发送动作已被明确拒绝
- **THEN** 显式重试 MUST 生成新的 `clientUserMessageId` 和新的 optimistic entry
- **AND** 原失败消息 MUST 保留，重试 MUST 不被旧 operation cache 当作同一次动作

### Requirement: Ambiguous start keeps the thread fail-closed

当客户端已经发出 `turn/start` 但结果未知时，Web SHALL 将发送 entry 标记为 `ambiguous` 并保留原 `clientUserMessageId`，同时 MUST 保持 thread 为 active/running，直到事件流或 summary 明确确认线程已 idle。未知结果期间 MUST NOT 因本地错误处理而开放新的发送 identity。

#### Scenario: Unknown start result does not open concurrent send

- **WHEN** `turn/start` 请求已发出，随后因超时、连接中断、5xx 或响应解析失败结束
- **THEN** 页面 MUST 保留原发送 entry 的 `ambiguous` outcome 和 identity
- **AND** 页面 MUST NOT 将 thread 状态切换为 `idle`
- **AND** ChatInput MUST 继续阻止新的普通发送，直到权威状态收敛

#### Scenario: Confirmed rejection still permits a new action

- **WHEN** resume、审计、附件、Skill、模型 readiness 或输入校验在 `turn/start` 调用前明确失败
- **THEN** 页面 MUST 将该 entry 标记为 confirmed rejection
- **AND** 页面 MUST 切换为 `idle`
- **AND** 后续显式重试 MAY 使用新的发送 identity

#### Scenario: Authoritative idle eventually reopens sending

- **WHEN** ambiguous entry 保留期间 summary 或事件流确认 thread 为 `idle`
- **THEN** store MUST 清除 active/running 状态
- **AND** 用户 MAY 创建新的发送 identity

### Requirement: Interrupt client does not guess from historical tail

会话页 SHALL 仅在已知当前 active turn identity 时向 interrupt API 显式发送 `turnId`。当 active identity 未知时，客户端 MUST 省略 `turnId` 并让 gateway 解析当前 active turn；MUST NOT 使用 thread detail 的历史 `lastTurnId`、timeline 尾部、createdAt 或文本作为替代目标。

#### Scenario: Active identity missing while lastTurnId is stale

- **WHEN** thread 状态为 active、store 尚无 `activeTurnId`，且 detail 的 `lastTurnId` 指向上一轮终态 turn
- **THEN** 客户端调用 interrupt API 时 MUST 省略 `turnId`
- **AND** route MUST 使用 gateway 当前 active identity 或稳定返回 409
- **AND** MUST NOT 显式中断 stale `lastTurnId`

#### Scenario: Known active identity remains explicit

- **WHEN** store 已记录当前 `activeTurnId`
- **THEN** 客户端 MUST 将该 identity 作为 interrupt 的显式目标
- **AND** detail 中不同的 `lastTurnId` MUST NOT 覆盖该 identity

#### Scenario: Duplicate interrupt clicks remain serialized

- **WHEN** 第一次 interrupt 请求仍在进行中且用户再次点击中断
- **THEN** 页面 MUST 复用或忽略重复操作，MUST NOT 发出第二个并发 interrupt 请求

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
