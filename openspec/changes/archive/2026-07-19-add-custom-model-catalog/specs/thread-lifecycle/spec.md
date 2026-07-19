## MODIFIED Requirements

### Requirement: Thread start with workspace validation
系统 SHALL 在创建新会话时校验 `cwd` 和 `workspaceRoots` 在允许的工作区范围内，并由后端解析来源敏感的模型选择身份。自定义模型 start MUST 使用最新 `customModelId` 配置、Codex 当前 provider、标称上下文窗口和默认 reasoning；核验成功后 MUST 在返回浏览器前写入会话模型绑定。操作 MUST 记录审计日志。

#### Scenario: Start thread with validated paths
- **WHEN** 已认证用户 POST `/api/codex/threads/start` 提供 `cwd`、`workspaceRoots` 和可解析的模型选择身份
- **THEN** 对 `cwd` 调用 `assertRuntimePathAllowed`，对 `workspaceRoots` 调用 `assertRuntimeWorkspaceRootsAllowed`
- **AND** 后端 MUST 解析目标模型并调用 `gateway.startThread()`，记录审计日志

#### Scenario: Start custom model thread
- **WHEN** 目标选择是有效自定义模型
- **THEN** start MUST 显式传入模型、当前 provider、`model_context_window` 和目标 reasoning
- **AND** app-server 返回新 `threadId` 后 MUST 先持久化绑定再返回成功

#### Scenario: Start thread with path outside workspace
- **WHEN** 用户提供的 `cwd` 不在允许的工作区范围内
- **THEN** `assertRuntimePathAllowed` 抛出错误，返回 HTTP 502 和 `{ok: false, error: "路径不在允许的工作区范围内"}`

### Requirement: Thread resume with latest turns
系统 SHALL 支持恢复已存在的会话，默认获取最近 30 条 turns（倒序）。恢复结果中的 timeline item MUST 保留所属 turn 元数据。存在自定义绑定时，resume MUST 使用绑定模型、窗口和 reasoning 以及 Codex 当前 provider；存在未完成绑定操作时 MUST 先恢复操作且在完成前禁止 turn。

#### Scenario: Resume app-server thread
- **WHEN** 已认证用户 GET `/api/codex/threads/{threadId}/resume` 且会话没有自定义绑定
- **THEN** 调用 `gateway.resumeThread(threadId)`，返回会话详情
- **AND** 返回的 timeline item MUST 包含所属 `turnId` 或等价 turn 标识

#### Scenario: Resume custom-bound thread
- **WHEN** 会话存在有效自定义绑定
- **THEN** Web MUST 用绑定快照和当前 provider 冷 resume 同一 thread
- **AND** MUST 显式恢复绑定的上下文窗口和 reasoning 档位

#### Scenario: Resume pending binding operation
- **WHEN** 会话存在未清除的绑定操作记录
- **THEN** 正常 resume 响应前 MUST 先完成目标重试或旧状态恢复
- **AND** 恢复失败 MUST 返回阻塞状态而不能开放发送

### Requirement: Thread delete
系统 SHALL 支持删除会话。app-server 删除成功后 MUST 清理对应会话模型绑定和未完成操作记录。操作 MUST 记录审计日志。删除不可逆。

#### Scenario: Delete thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/delete`
- **THEN** 调用 `gateway.deleteThread(threadId)`，记录审计日志
- **AND** 成功后 MUST 删除该 `threadId` 的绑定与操作记录并返回 `{ok: true}`

### Requirement: Thread fork
系统 SHALL 支持从现有会话分叉新会话。Fork 本身 SHALL 创建完整分支；消息级 Fork 若需要从历史 user message 分支，客户端或 Web API 层 MUST 在新 thread 上继续执行 rollback。来源会话存在自定义绑定时，新 thread MUST 继承相同配置快照并获得独立 `bindingVersion`。

#### Scenario: Fork thread
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/fork`
- **THEN** 调用 `gateway.forkThread(threadId)`，返回分叉后的新会话详情
- **AND** 来源存在自定义绑定时 MUST 在返回前为新 `threadId` 写入继承绑定

#### Scenario: Fork then rollback for message action
- **WHEN** 用户通过消息级「从这里 Fork」指定历史 user message
- **THEN** 系统 MUST 先创建新 thread 并继承来源绑定
- **AND** MUST 在新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST NOT 修改原 thread history 或原绑定

### Requirement: Thread settings update
系统 SHALL 支持更新会话的 reasoningEffort / permissions 设置。模型变更 MUST 使用独立模型切换命令，不得通过 thread settings update。自定义绑定会话 reasoning 更新仅在 app-server 成功后 MUST 同步绑定并生成新的 `bindingVersion`。

#### Scenario: Update non-model thread settings
- **WHEN** 已认证用户 POST `/api/codex/threads/{threadId}/settings` 并提供 reasoningEffort 或 permissions
- **THEN** 调用 `gateway.updateThreadSettings()`，成功后返回 `{ok: true}`
- **AND** 自定义绑定的 reasoningEffort 成功改变时 MUST 原子更新绑定

#### Scenario: Reject model in settings update
- **WHEN** `/api/codex/threads/{threadId}/settings` 请求包含 `model`
- **THEN** route MUST 返回明确客户端错误
- **AND** MUST NOT 调用 app-server `thread/settings/update` 修改模型
