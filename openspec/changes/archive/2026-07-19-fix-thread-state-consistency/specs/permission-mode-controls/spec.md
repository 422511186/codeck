## MODIFIED Requirements

### Requirement: Composer permission mode chip
移动端会话页空闲态 composer SHALL 在底部工具栏常驻展示当前权限模式 chip。chip MUST 使用 Codex App 对齐的四项中文标签之一：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。chip 的状态 MUST 同时反映 named permission profile、`approvalPolicy` 与 `approvalsReviewer`，不得只按 profile id 或 reviewer 判断。

#### Scenario: Render active permission mode
- **WHEN** 用户进入会话页且 thread 处于静止状态
- **THEN** composer 底部工具栏 MUST 显示当前权限模式 chip
- **AND** chip MUST 与发送按钮、模型/思考档位 chip 同处于发送前状态区域
- **AND** chip MUST 显示与完整权限 payload 一致的模式

#### Scenario: Workspace with user reviewer
- **WHEN** 当前权限 payload 为 `permissions: ":workspace"`、`approvalPolicy: "on-request"` 且 `approvalsReviewer: "user"`
- **THEN** 权限 chip MUST 显示「请求批准」

#### Scenario: Workspace with auto reviewer
- **WHEN** 当前权限 payload 为 `permissions: ":workspace"`、`approvalPolicy: "on-request"` 且 `approvalsReviewer: "auto_review"`
- **THEN** 权限 chip MUST 显示「替我审批」

#### Scenario: Full access profile
- **WHEN** 当前权限 payload 为 `permissions: ":danger-full-access"` 且 `approvalPolicy: "never"`
- **THEN** 权限 chip MUST 显示「完全访问权限」
- **AND** `approvalsReviewer` 的当前值 MUST 不重新启用审批

#### Scenario: Danger sandbox with approval still enabled
- **WHEN** 后端返回 `permissions: ":danger-full-access"` 但 `approvalPolicy` 不是 `never`
- **THEN** 权限 chip MUST NOT 把该组合显示为「完全访问权限」
- **AND** 页面 MUST 显示权限状态未完整生效的反馈或触发有界状态恢复

#### Scenario: Config default mode
- **WHEN** 当前选择明确清除了 `permissions`、`approvalPolicy` 与 `approvalsReviewer` 三个会话级 override
- **THEN** 权限 chip MUST 显示「自定义 config.toml」

### Requirement: Permission mode update semantics
用户选择权限模式后，系统 SHALL 更新当前会话后续 turn 的完整权限 payload。普通 App 模式 MUST 同时写入 `permissions`、`approvalPolicy` 和 `approvalsReviewer`；「自定义 config.toml」MUST 对三个字段发送显式 `null` 以清除会话级 override。后续 `turn/start` 和新会话启动 MUST 使用同一套 payload。

#### Scenario: Select request approval
- **WHEN** 用户在权限模式选择面板中选择「请求批准」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":workspace"`
- **AND** 请求体 MUST 包含 `approvalPolicy: "on-request"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: "user"`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select auto approval
- **WHEN** 用户在权限模式选择面板中选择「替我审批」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":workspace"`
- **AND** 请求体 MUST 包含 `approvalPolicy: "on-request"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: "auto_review"`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select full access
- **WHEN** 用户在权限模式选择面板中选择「完全访问权限」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":danger-full-access"`
- **AND** 请求体 MUST 包含 `approvalPolicy: "never"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: null`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select config default
- **WHEN** 用户选择「自定义 config.toml」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: null`
- **AND** 请求体 MUST 包含 `approvalPolicy: null`
- **AND** 请求体 MUST 包含 `approvalsReviewer: null`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用相同的显式清除语义

#### Scenario: Legacy permission ids are not sent
- **WHEN** 用户选择任意 Codex App 权限模式并发送消息
- **THEN** 前端 MUST NOT 向 app-server 发送 `read-only`
- **AND** 前端 MUST NOT 向 app-server 发送 `workspace-write`
- **AND** 前端 MUST NOT 向 app-server 发送 `full-auto`

#### Scenario: Running turn unchanged
- **WHEN** agent 正在执行当前 turn
- **AND** 用户切换权限模式
- **THEN** 当前已开始的 turn 权限 MUST 不变
- **AND** 新权限模式 MUST 只影响后续 turn

#### Scenario: Full access settings response remains on request
- **WHEN** 用户选择「完全访问权限」
- **AND** 后端回读的 `approvalPolicy` 仍为 `on-request` 或其他非 `never` 值
- **THEN** 系统 MUST 将本次设置视为未完整生效
- **AND** 后续发送 MUST NOT 静默宣称当前模式为「完全访问权限」

### Requirement: Permission mode state source
会话页 SHALL 使用完整权限 payload 作为当前权限显示与发送来源。完整权限 payload 包含 named permission profile、`approvalPolicy` 与 `approvalsReviewer`；系统 MUST 区分尚未读取的 `undefined` 与显式清除 override 的 `null`。本地乐观选择 SHALL 在后端未返回完整 payload 前保持有效，后端不完整状态 MUST NOT 覆盖用户刚选择的语义。

#### Scenario: Read active payload from backend
- **WHEN** `thread/read`、`thread/resume`、`thread/start`、settings 回读或 settings update 事件包含完整权限 payload
- **THEN** 前端 MUST 使用该 payload 作为权限 chip 和后续发送的当前状态

#### Scenario: Optimistic selection wins over incomplete backend state
- **WHEN** 用户刚选择「替我审批」
- **AND** 后端随后只返回 `activePermissionProfile.id: ":workspace"` 而缺少 `approvalPolicy` 或 `approvalsReviewer`
- **THEN** 权限 chip MUST 继续显示「替我审批」
- **AND** 后续发送 MUST 继续携带 `approvalPolicy: "on-request"` 与 `approvalsReviewer: "auto_review"`

#### Scenario: Unknown state is not explicit config default
- **WHEN** 页面尚未从本地选择或后端响应获得任一完整权限 payload
- **THEN** 系统 MUST 将权限状态保持为 unknown
- **AND** MUST NOT 把 unknown 归一化为三个 `null` 后写入 settings 或 `turn/start`

#### Scenario: Resume result restores permission before send
- **WHEN** thread 状态为 `notLoaded` 且用户发送消息
- **AND** 页面先调用 `thread/resume`
- **THEN** 发送流程 MUST 消费 resume 返回的完整权限 payload
- **AND** `turn/start` MUST NOT 使用 resume 前闭包中的 unknown 或 stale 权限状态

#### Scenario: Fallback to local state
- **WHEN** app-server 暂未返回完整权限 payload
- **AND** 前端存在该 thread 的本地完整权限选择记录
- **THEN** 权限 chip SHALL 使用本地记录作为临时显示
- **AND** 下一次后端返回完整权限 payload 后 MUST 以后端状态为准

#### Scenario: Settings aggregation partial failure
- **WHEN** `/api/codex/settings` 中与权限无关的子请求失败
- **THEN** 权限选择面板 MUST 仍能展示四个 Codex App 权限模式
- **AND** 用户 MUST 仍能切换权限并发送后续消息
