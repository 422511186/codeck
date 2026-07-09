## MODIFIED Requirements

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

## ADDED Requirements

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
