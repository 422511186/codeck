# process-exec Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Process spawn with cwd validation
系统 SHALL 在启动进程前校验 `cwd` 在允许的工作区范围内，校验 `command` 为非空字符串数组。操作 MUST 记录审计日志（包含 command 数组和 cwd）。

#### Scenario: Spawn process
- **WHEN** 已认证用户 POST `/api/codex/process/spawn` 提供非空 command 数组和有效 cwd
- **THEN** 校验 cwd 在工作区内，记录审计日志，调用 `gateway.startProcessSession({command, cwd})`，返回 `{ok: true, session}`

#### Scenario: Invalid command
- **WHEN** command字符串数组或为空
- **THEN** 返回 HTTP 400 和 `"command 不能为空"`

#### Scenario: Invalid cwd
- **WHEN** cwd 不是非空字符串或不在工作区内
- **THEN** 返回 HTTP 400 或 50

### Requirement: Process session tracking
系统 SHALL 在 Gateway 内存中维护进程会话映射（`terminalSessions: Map<processHandle, TerminalSession>`），追踪输出、退出和运行状态。

#### Scenario: Session created on spawn
- **WHEN** 进程成功启动
- **THEN** 在 `terminalSessions` 中创建条目，`running=true, output="", exitCode=null`

#### Scenario: Output appended on notification
- **WHEN** 收到 `process/outputDelta` 通知
- **THEN** 将 base64 解码后的 delta 追加到对应 session 的 output

#### Scenario: Session completed on exit
- **WHEN** 收到 `process/exited` 通知
- **THEN** 追加 stdout/stderr 到 output，设置 exitCode 和 `running=false`

###: Process stdin write
系统 SHALL 支持向运行中进程的 stdin 写入数据。数据 MUST 通过 base64 编码传递。

#### Scenario: Write stdin
- **WHEN** 已认证用户 POST `/api/codex/process/{processHandle}/stdin` 并提供 `text`
- **THEN** 调用 `gateway.writeProcessStdin(processHandle, text)`

### Requirement: Process PTY resize
系统 SHALL 支持调整进程的终端尺寸。

#### Scenario: Resize PTY
- **WHEN** 已认证用户 POST `/api/codex/process/{processHandle}/resize` 并提供 cols 和 rows
- **THEN** 调用gateway.resizeProcessSession(processHandle, cols, rows)`

### Requirement: Process kill
系统 SHALL 支持杀死进程。操作 MUST 记录审计日志。

#### Scenario: Kill process
- **WHEN** 已认证用户 POST `/api/codex/process/{processHandle}/kill`
- **THEN** 调用 `gateway.killProcessSession(processHandle)`，记录审计日志

### Requirement: Process session read
系统 SHALL 支持读取进程会话的当前状态。

#### Scenario: Read process session
- **WHEN** 已认证用户 GET `/api/codex/process/{processHandle}`
- **THEN** 从 `terminalSessions` Map 返回 session 数据

#### Scenario: Unknown process handle
- **WHEN** 请求的 processHandle 不存在于 terminalSessions 中
- **THEN** 返回错误 `"找不到终端会话"`

### Requirement: Command exec with cwd validation
系统 SHALL 支持通过 `command/exec` 执行命令。与 process/spawn 不同，command/exec 支持流式 stdin/stdout/stderr（`streamStdin: true, streamStdoutStderr: true`）。cwd MUST 通过校验。操作 MUST 记录审计日志。

#### Scenario: Start command exec session
- **WHEN** 已认证用户 POST `/api/codex/command-exec/spawn` 提供非空 command 数组和有效 cwd
- **THEN** Gateway 生成 processId（`mobile-command-{counter}`），创建 session 映射，调用 `gateway.startCommandExecSession()`，返回 `{ok: true, session}`

### Requirement: Command exec session tracking
系统 SHALL 在 `commandExecSessions: Map<processId, TerminalSession>` 中追踪 command exec 会话。

#### Scenario: Output appended on command exec notification
- **WHEN** 收到 `command/exec/outputDelta` 通知
- **THEN** 将 base64 解码后的 delta 追加到对应 session 的 output

### Requirement: Command exec stdin, resize, terminate
系统 SHALL 支持向 command exec 会话写入 stdin、调整终端尺寸和终止会话。

#### Scenario: Write command exec stdin
- **WHEN** 已认证用户 POST `/api/codex/command-exec/{processId}/stdin` 并提供 text
- **THEN** 调用 `gateway.writeCommandExecStdin(processId, text)`

#### Scenario: Resize command exec
- **WHEN** 已认证用户 POST `/api/codex/command-exec/{processId}/resize` 并提供 cols 和 rows
- **THEN** 调用 `gateway.resizeCommandExecSession(processId, cols, rows)`

#### Scenario: Terminate command exec
- **WHEN** 已认证用户 POST `/api/codex/command-exec/{processId}/terminate`
- **THEN** 调用 `gateway.terminateCommandExecSession(processId)`

### Requirement: App-server process invocation
当 app-server 模式为 `spawn` 时，系统 SHALL 使用 `codex app-server --listen ws://host:port` 命令启动子进程。在 Windows 上 MUST 通过 `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command` 包装调用。

#### Scenario: Spawn on Windows
- **WHEN** `process.platform === "win32"` 且 codexBin 不以 `.exe/.cmd/.bat` 结尾
- **THEN** 使用 PowerShell 包装调用

#### Scenario: Spawn on Unix
- **WHEN** 不满足 Windows 条件
- **THEN** 直接调用 codexBin

### Requirement: Connection retry with deadline
系统 SHALL 在连接 app-server 时最多重试 10 秒（每次间隔 200ms），单次连接超时 2 秒。

#### Scenario: Successful connection
- **WHEN** app-server 在 10 秒内可连接
- **THEN** 状态转为 `ready`

#### Scenario: Connection timeout
- **WHEN** 10 秒内无法连接
- **THEN** 状态转为 `error`抛出超时错误

**Open Questions**

1. **进程执行无命令级限制**：`process/spawn` 和 `command/exec` 仅校验 `cwd`，对 `command` 内容没有任何限制（如禁止 `rm -rf /`、`sudo` 等）。是否需要引入命令黑名单或白名单？此外，`command-exec/spawn` 路由对 command 的校验弱于 `process/spawn`：前者仅检查 `!body.command?.length`（数组非空），后者额外校验每个元素为字符串（`Array.isArray` + `every(item => typeof item === "string")`）。两者不一致。
2. **Gateway 内存 Map 无并发保护**：`terminalSessions` 和 `commandExecSessions` 的读写没有锁保护。如果同一会话同时收到 outputDelta 通知和 HTTP 读请求，可能出现数据竞争。JavaScript 单线程模型是否足够安全（考虑到 async/await 的调度点）？
3. **断线不重连**：`WebSocketAppServerPeer` 在连接建立不再重试。如果 WebSocket 断开，状态转为 `idle`，但 Gateway 的 `initialized` Promise 已 resolved，后续 `ensureReady()` 不会再触发连接。一次断线就是永久失效，除非重启整个 Node.js 进程。是否需要重连机制？
4. **子进程 stdout/stderr 仅打印到 console.error**：app-server 子进程的 stderr 输出仅通过 `console.error` 打印，不持久化。排查问题时需要回溯日志。
5. **Windows PowerShell 包装可能引入安全风险**：`-ExecutionPolicy Bypass` 允许执行未签名脚本。是否需要更严格的执行策略？

