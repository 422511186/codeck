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
系统 SHALL 支持通过 threadId 读取会话详情，包含 timeline（用户消息、agent 消息、命令执行等）和 goal 信息。系统 MUST 将尚未 materialized 的空 thread 视为可读取会话，返回空 timeline，而不是把 app-server 的 `includeTurns` 限制暴露给用户。

#### Scenario: Read thread detail
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且目标 thread 已有可读取 turns
- **THEN** 调用 `gateway.readThread(threadId)`，返回包含 `timeline` 和 `goal` 的详情

#### Scenario: Read unmaterialized empty thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}` 且 app-server 对 `thread/read` 的 `includeTurns: true` 返回未 materialized 错误
- **THEN** 系统 SHALL 降级读取 thread metadata，返回 `{ok: true, thread}`，其中 `thread.timeline` 为空数组、`thread.lastTurnId` 为 `null`
- **AND** 响应 MUST 保持现有 `ThreadDetail` 形状，使前端可以显示空会话并发送第一条用户消息

### Requirement: Thread resume with latest turns
系统 SHALL 支持恢复已存在的会话，默认获取最近 30 条 turns（倒序）。

#### Scenario: Resume thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/resume`
- **THEN** 调用 `gateway.resumeThread(threadId)`，返回会话详情

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
系统 SHALL 支持从现有会话分叉新会话。

#### Scenario: Fork thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/fork`
- **THEN** 调用 `gateway.forkThread(threadId)`，返回分叉后的新会话详情

### Requirement: Thread rollback
系统 SHALL 支持回滚会话指定数量的 turns。

#### Scenario: Rollback thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/rollback` 并提供 `numTurns`
- **THEN** 调用 `gateway.rollbackThread(threadId, numTurns)`，返回回滚后的会话详情

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
系统 SHALL 支持压缩会话上下文。

#### Scenario: Compact thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/compact`
- **THEN** 调用 `gateway.compactThread(threadId)`，触发 `thread/compacted` 通知

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

