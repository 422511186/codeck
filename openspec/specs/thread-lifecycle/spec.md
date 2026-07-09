# thread-lifecycle Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Thread list with pagination
系统 SHALL 支持通过 `thread/list` 获取会话列表，默认 `limit=30`，支持 cursor 分页。支持通过 `search` / `q` 参数触发 `thread/search` 搜索模式。

#### Scenario: List threads without search
- **WHEN** 已认证用户 GET `/api/codex/threads` 不带 search 参数
- **THEN** 调用 `gateway.listThreads({limit: 30, cursor, sortKey: "updated_at", sortDirection: "desc"})`，返回 `{ok: true, threads, nextCursor}`

#### Scenario: Search threads
- **WHEN** 已认证用户 GET `/api/codex/threads?search=keyword`
- **THEN** 调用 `gateway.searchThreads({searchTerm: "keyword", limit: 30})`，返回搜索结果

#### Scenario: List archived threads
- **WHEN** 已认证用户 GET `/api/codex/threads?archived=true`
- **THEN** 传递 `archived: true` 给 app-server

### Requirement: Thread start with workspace validation
系统 SHALL 在创建新会话时校验 `cwd` 和 `workspaceRoots` 在允许的工作区范围内。操作 MUST 记录审计日志。

#### Scenario: Start thread with validated paths
- **WHEN** 已认证用户 POST `/api/codex/threads/start` 提供 `cwd` 和 `workspaceRoots`
- **THEN** 对 `cwd` 调用 `assertRuntimePathAllowed`，对 `workspaceRoots` 调用 `assertRuntimeWorkspaceRootsAllowed`，通过后调用 `gateway.startThread()`，记录审计日志

#### Scenario: Start thread with path outside workspace
- **WHEN** 用户提供的 `cwd` 不在允许的工作区范围内
- **THEN** `assertRuntimePathAllowed` 抛出错误，返回 HTTP 502 和 `{ok: false, error: "路径不在允许的工作区范围内"}`

### Requirement: Thread read
系统 SHALL 支持通过 threadId 读取会话详情，包含 timeline（用户消息、agent 消息、命令执行等）和 goal 信息。系统 MUST 将尚未 materialized 的空 thread 视为可读取会话，返回空 timeline，而不是把 app-server 的 `includeTurns` 限制暴露给用户。为了支持消息级时间线操作，timeline item MUST 携带足够的 turn 元数据，使前端能够识别 item 所属 turn。运行中 thread 的 `readThread` SHALL 作为初始化、显式刷新、事件流断线修复和 rollback/fork 返回详情的 snapshot API；客户端 MUST NOT 把它作为正常运行中输出的高频 polling 主路径。系统 SHALL 另提供不含 timeline 的 thread summary 读取能力，用于运行中状态兜底检测。

#### Scenario: Read thread detail
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且目标 thread 已有可读取 turns
- **THEN** 调用 `gateway.readThread(threadId)`，返回包含 `timeline` 和 `goal` 的详情
- **AND** 每个由 turn 展开的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识
- **AND** 由 realtime overlay 补入或替换的 timeline item 也 MUST 保留所属 `turnId`

#### Scenario: Read unmaterialized empty thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且 app-server 对 `thread/read` 的 `includeTurns: true` 返回未 materialized 错误
- **THEN** 系统 SHALL 降级读取 thread metadata，返回 `{ok: true, thread}`，其中 `thread.timeline` 为空数组、`thread.lastTurnId` 为 `null`
- **AND** 响应 MUST 保持现有 `ThreadDetail` 形状，使前端可以显示空会话并发送第一条用户消息

#### Scenario: Read is not high-frequency running polling
- **WHEN** thread 处于 running 状态且 timeline event stream 可用
- **THEN** 客户端 MUST NOT 每隔固定短周期调用 `readThread` 获取完整 timeline
- **AND** `readThread` MAY 仅用于首屏 snapshot、手动刷新、事件流缺口修复或最终 reconcile

#### Scenario: Read thread summary without timeline
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/summary`
- **THEN** 系统 MUST 调用 `gateway.readThreadSummary(threadId)`
- **AND** 响应 MUST 返回 thread 摘要状态
- **AND** 响应 MUST NOT 携带完整 timeline

### Requirement: Thread resume with latest turns
系统 SHALL 支持恢复已存在的会话，默认获取最近 30 条 turns（倒序）。恢复结果中的 timeline item MUST 保留所属 turn 元数据，以支持历史消息级操作。

#### Scenario: Resume thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/resume`
- **THEN** 调用 `gateway.resumeThread(threadId)`，返回会话详情
- **AND** 返回的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识

### Requirement: Thread delete
系统 SHALL 支持删除会话。操作 MUST 记录审计日志。删除不可逆。

#### Scenario: Delete thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/delete`
- **THEN** 调用 `gateway.deleteThread(threadId)`，记录审计日志，返回 `{ok: true}`

### Requirement: Thread archive and unarchive
系统 SHALL 支持归档和取消归档会话。归档后 thread 从主列表移至归档列表。

#### Scenario: Archive thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/archive`
- **THEN** 调用 `gateway.archiveThread(threadId)`，返回 `{ok: true}`

#### Scenario: Unarchive thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/unarchive`
- **THEN** 调用 `gateway.unarchiveThread(threadId)`，返回恢复的会话详情

### Requirement: Thread fork
系统 SHALL 支持从现有会话分叉新会话。Fork 本身 SHALL 创建完整分支；消息级 Fork 若需要从历史 user message 分支，客户端或 Web API 层 MUST 在新 thread 上继续执行 rollback，使新 thread 截断到目标 user message 所属 turn 之前。

#### Scenario: Fork thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/fork`
- **THEN** 调用 `gateway.forkThread(threadId)`，返回分叉后的新会话详情

#### Scenario: Fork then rollback for message action
- **WHEN** 用户通过消息级「从这里 Fork」指定历史 user message
- **THEN** 系统 MUST 先创建新 thread
- **AND** MUST 在新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST NOT 修改原 thread history

### Requirement: Thread rollback
系统 SHALL 支持回滚会话指定数量的 turns。rollback 返回的会话详情 SHALL 表示回滚后的 thread history，前端用于消息级回滚时 MUST 用该详情替换本地 timeline。rollback 成功后，系统 MUST 清理或失效被删除 turns 的 realtime overlay、事件缓存和 late event，使这些 turns 不会再次出现在当前 thread timeline。若 app-server rollback 响应只包含有限 turns 窗口，Web 层 MUST 保留或恢复正确分页语义，不能把有限窗口误标记为已经到达会话开头。

#### Scenario: Rollback thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/rollback` 并提供 `numTurns`
- **THEN** 调用 `gateway.rollbackThread(threadId, numTurns)`，返回回滚后的会话详情
- **AND** 返回的 timeline MUST 不包含被删除 turns 的 overlay item

#### Scenario: Rollback response replaces client timeline
- **WHEN** 前端为了消息级「回滚到这里」调用 rollback 且请求成功
- **THEN** 前端 MUST 使用返回的会话详情替换当前 thread timeline
- **AND** MUST NOT 使用保留旧尾部条目的 merge 策略
- **AND** MUST NOT 使用 rollback 前本地 entries 切片作为 timeline fallback

#### Scenario: Rollback preserves pagination state
- **WHEN** app-server rollback 响应中的 thread turns 不是完整历史
- **AND** 回滚后仍可能存在更早 turns
- **THEN** Web 返回给前端的 thread detail MUST 带有可继续读取更早历史的 cursor 或等价未到开头状态
- **AND** 前端 MUST NOT 将该 timeline 视为完整会话开头

#### Scenario: Rollback only changes history
- **WHEN** 系统执行 thread rollback
- **THEN** rollback MUST 只修改 thread history
- **AND** MUST NOT 自动还原 agent 已经写入本地工作区的文件变更

#### Scenario: Late events after rollback
- **WHEN** rollback 成功后收到属于已删除 turn 的 realtime 事件
- **THEN** 系统 MUST 忽略该事件或标记为过期
- **AND** 后续 `readThread` MUST NOT 通过 overlay 把该事件重新追加到 timeline

### Requirement: Thread set name
系统 SHALL 支持重命名会话。

#### Scenario: Set thread name
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/name` 并提供 `name`
- **THEN** 先调用 `gateway.setThreadName()`，再调用 `gateway.readThread()` 返回更新后的详情

### Requirement: Thread settings update
系统 SHALL 支持更新会话的 model / reasoningEffort / permissions 设置。

#### Scenario: Update thread settings
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/settings` 并提供 settings 字段
- **THEN** 调用 `gateway.updateThreadSettings()`，返回 `{ok: true}`

### Requirement: Thread metadata update
系统 SHALL 支持更新会话的元数据（如 gitInfo）。

#### Scenario: Update thread metadata
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/metadata` 并提供 `gitInfo`
- **THEN** 调用 `gateway.updateThreadMetadata()`，返回更新后的会话详情

### Requirement: Thread goal management
系统 SHALL 支持设置、获取和清除会话目标（goal）。Goal 包含 objective、status、tokenBudget 等字段。

#### Scenario: Set thread goal
- **WHEN** 已认证用户设置 thread goal
- **THEN** 调用 `gateway.setThreadGoal()`，返回 goal 视图，同时触发 `thread/goal/updated` 通知推送到浏览器

#### Scenario: Get thread goal
- **WHEN** 读取 thread detail 时
- **THEN** 同时获取 goal 信息（通过 `readThreadGoal` 并行请求）

#### Scenario: Clear thread goal
- **WHEN** 已认证用户清除 thread goal
- **THEN** 调用 `gateway.clearThreadGoal()`，触发 `thread/goal/cleared` 通知

### Requirement: Thread compact
系统 SHALL 支持压缩空闲会话上下文，并拒绝压缩所有非空闲会话。compact API MUST 在调用 app-server compact 前读取不含 timeline 的 thread summary 进行预检；对可预期的非 idle、active turn not steerable 或 compact 已在运行错误 MUST 返回 `409` 和稳定中文错误；对未知 app-server 或网络异常 MAY 返回 `502`。系统 MUST 保留足够的结构化错误和诊断信息，便于区分预检拒绝、app-server 拒绝和未知失败。

#### Scenario: Compact thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话处于 `idle` 状态
- **THEN** 调用 `gateway.compactThread(threadId)`，触发 `thread/compacted` 通知
- **AND** 系统 MUST 记录 compact 已被 app-server 接受或开始的诊断信息

#### Scenario: Reject active thread compact
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话处于运行状态
- **THEN** 系统 MUST 返回 `409`
- **AND** 系统 MUST 不调用 `gateway.compactThread(threadId)`
- **AND** 响应错误 MUST 表达“会话仍在运行，停止后才能压缩上下文”或等价含义

#### Scenario: Reject unloaded or errored thread compact
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **AND** 会话状态是 `notLoaded`、`systemError` 或其他非 `idle` 状态
- **THEN** 系统 MUST 返回 `409`
- **AND** 系统 MUST 不调用 `gateway.compactThread(threadId)`
- **AND** 响应错误 MUST 表达需要恢复或停止后才能压缩

#### Scenario: App-server rejects compact as non-steerable active turn
- **WHEN** compact 预检看到 thread 为 `idle`
- **AND** app-server 在 `thread/compact/start` 阶段返回结构化 `activeTurnNotSteerable` 或等价 active-turn 错误
- **THEN** 系统 MUST 返回 `409`
- **AND** 系统 MUST NOT 将该可预期状态冲突映射为 `502`

#### Scenario: Unknown compact failure remains server error
- **WHEN** app-server compact 请求失败且错误无法识别为非 idle 或 active-turn 状态冲突
- **THEN** 系统 MAY 返回 `502`
- **AND** 系统 MUST 保留 sanitized 错误诊断，便于后续排查

### Requirement: Thread review
系统 SHALL 支持对会话启动代码审查。

#### Scenario: Start review
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/review`
- **THEN** 调用 `gateway.startReview(threadId)`，返回 `{turnId, reviewThreadId}`

### Requirement: Thread elicitation counter
系统 SHALL 支持增减会话的 elicitation 计数器。当计数 > 0 时线程标记为 paused。

#### Scenario: Increment elicitation
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/elicitation/increment`
- **THEN** 调用 `gateway.incrementThreadElicitation()`，返回 `{count, paused}`

#### Scenario: Decrement elicitation
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/elicitation/decrement`
- **THEN** 调用 `gateway.decrementThreadElicitation()`，count 最小为 0

### Requirement: Thread unsubscribe
系统 SHALL 支持取消订阅会话。

#### Scenario: Unsubscribe thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/unsubscribe`
- **THEN** 调用 `gateway.unsubscribeThread()`，返回 `{status}`

### Requirement: Thread shell command
系统 SHALL 支持在线程中执行 shell 命令。

#### Scenario: Run shell command in thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/shell-command` 并提供 `command`
- **THEN** 调用 `gateway.runThreadShellCommand()`

### Requirement: Thread inject items
系统 SHALL 支持向会话注入上下文 items。

#### Scenario: Inject items
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/items/inject` 并提供 `items`
- **THEN** 调用 `gateway.injectThreadItems()`

### Requirement: Thread approve guardian denied action
系统 SHALL 支持批准被 Guardian 拒绝的操作。

#### Scenario: Approve guardian denied action
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/guardian/approve-denied-action`
- **THEN** 调用 `gateway.approveGuardianDeniedAction()`

### Requirement: Turn list and pagination
系统 SHALL 支持分页获取会话的 turns 和 turn items。

#### Scenario: List thread turns
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/turns`
- **THEN** 调用 `gateway.listThreadTurns()`，返回 `{ok: true, items, nextCursor}`

#### Scenario: List turn items
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/turns/{turnId}/items`
- **THEN** 调用 `gateway.listThreadTurnItems()`

### Requirement: Background terminal management
系统 SHALL 支持列出、终止和清理会话的后台终端。

#### Scenario: List background terminals
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/background-terminals`
- **THEN** 调用 `gateway.listThreadBackgroundTerminals()`

#### Scenario: Terminate background terminal
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/background-terminals/{processId}/terminate`
- **THEN** 调用 `gateway.terminateThreadBackgroundTerminal()`

#### Scenario: Clean background terminals
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/background-terminals/clean`
- **THEN** 调用 `gateway.cleanThreadBackgroundTerminals()`

### Requirement: Thread memory mode
系统 SHALL 支持设置会话的记忆模式。

#### Scenario: Set thread memory mode
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/memory` 并提供 `mode`
- **THEN** 调用 `gateway.setThreadMemoryMode()`

**Open Questions**

1. **Thread 删除不可逆**：删除操作直接调用 `thread/delete`，无确认机制，无回收站。是否需要软删除或确认步骤？
2. **Thread start 时 workspaceRoots 校验位置不一致**：`assertRuntimeWorkspaceRootsAllowed` 仅校验根路径在 workspace 内，但后续文件/进程操作使用的是这些根路径下的子路径。校验粒度是否足够？
3. **Thread read 并行请求 goal**：`readThread` 同时发 `thread/read` 和 `thread/goal/get`，如果其中一个失败，整个请求失败。是否需要降级处理（如 goal 为 null 时仍返回 thread）？
4. **Shell command 无路径校验**：`thread/shell-command` 路由不校验 command 内容，也不校验 cwd。是否应增加限制？
5. **Inject items 无内容校验**：`thread/inject_items` 接受任意 `MobileJsonValue[]`，直接透传给 app-server。是否需要校验 items 的结构和大小？

### Requirement: Turn start does not require immediate full thread read for streaming
系统 SHALL 支持启动 turn 后通过 timeline event stream 展示运行中输出。`turn/start` Web API MAY 返回轻量 `{turnId}` 或包含权威 thread detail，但客户端 MUST NOT 依赖该响应后的全量 `readThread` 作为实时输出主路径。

#### Scenario: Start turn returns before full timeline materialization
- **WHEN** 用户发送消息且 `turn/start` 成功
- **THEN** API MUST 返回可关联后续事件的 `turnId`
- **AND** 运行中 agent/reasoning/tool 输出 MUST 通过 timeline event stream 到达

#### Scenario: Start turn snapshot does not duplicate event stream
- **WHEN** `turn/start` 响应包含 thread detail
- **AND** 同一 turn 的 delta 也通过事件流到达
- **THEN** 前端 MUST 基于事件 identity、item revision 或等价机制去重
- **AND** MUST NOT 重复追加同一段输出文本

### Requirement: List-triggered thread archive operations
系统 SHALL 支持前端从会话列表直接触发会话归档和取消归档操作，且该入口 MUST 复用既有 thread archive/unarchive API。

#### Scenario: Archive from thread list
- **WHEN** 前端从会话列表对某个 threadId 触发归档
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/archive`
- **AND** 系统 MUST NOT 要求前端先进入会话详情页
- **AND** 系统 MUST NOT 要求前端先读取完整 `ThreadDetail`

#### Scenario: Unarchive from thread list
- **WHEN** 前端从会话列表对某个 threadId 触发移出归档
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/unarchive`
- **AND** 系统 MUST NOT 要求前端先进入会话详情页
- **AND** 系统 MUST NOT 要求前端先读取完整 `ThreadDetail`

#### Scenario: List state after successful archive operation
- **WHEN** 列表入口触发的归档或移出归档请求成功
- **THEN** 前端 MAY 仅基于请求成功结果更新当前列表状态
- **AND** 前端 MUST NOT 依赖返回的完整 timeline 来决定当前 tab 是否移除该条目

### Requirement: Thread turns pages are exposed in chronological order
移动端 Web 适配层 SHALL 保证返回给前端 store 的 thread timeline items 按会话时间正序排列，即使 app-server 底层分页使用 `sortDirection: "desc"` 读取最新 turns。

#### Scenario: Resume with initial turns page
- **WHEN** `thread/resume` 返回 `initialTurnsPage` 且该页为 desc 顺序
- **THEN** Web 适配层 MUST 在构造 `MobileThreadDetail.timeline` 和 `lastTurnId` 前把 turns 转为会话正序

#### Scenario: Load older turns page
- **WHEN** 前端调用历史 turns 分页加载更早消息
- **THEN** Web 适配层 MUST 返回页内正序 timeline items
- **AND** 前端 prepend 后整体 timeline 顺序 MUST 保持稳定

### Requirement: Structured app-server errors are preserved
服务端 JSON-RPC/app-server 传输层 SHALL 保留 app-server 错误的结构化数据。业务 route MUST 能读取结构化错误信息进行 HTTP 状态分类，不得只能依赖错误 message 正则。

#### Scenario: JSON-RPC error carries data
- **WHEN** app-server JSON-RPC 响应包含 `error.message` 和 `error.data`
- **THEN** 服务端抛出的错误对象 MUST 保留 sanitized message
- **AND** 服务端抛出的错误对象 MUST 暴露 `error.data` 或等价结构化字段给 route 层

#### Scenario: Compact route uses structured error first
- **WHEN** compact route 捕获 app-server 错误
- **AND** 错误结构化数据能识别为 active turn not steerable、non-steerable compact 或正在运行状态
- **THEN** route MUST 返回 `409`
- **AND** route MUST 只在结构化数据不可用时退回 message fallback

### Requirement: Thread summary is canonical for lightweight status refresh
系统 SHALL 提供不含 timeline 的 thread summary 作为轻量状态刷新 API。前端在 compact 失败、compact pending reconcile 或 event stream 状态缺口时 MUST 使用 summary 刷新 thread status，而不是拉取完整 timeline。

#### Scenario: Compact failure refreshes summary
- **WHEN** compact 请求失败
- **THEN** 前端 MUST 能调用 `GET /api/codex/threads/{threadId}/summary` 获取当前 thread status
- **AND** 该请求 MUST NOT 返回完整 timeline

#### Scenario: Summary status updates client state
- **WHEN** 前端收到 summary 响应
- **THEN** 前端 MUST 用 summary 中的 status 更新当前 thread status
- **AND** 前端 MUST NOT 因只读取 summary 而清空或替换当前 timeline

