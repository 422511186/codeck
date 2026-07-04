# permission-mode-controls Specification

## Purpose
TBD - created by archiving change redesign-mobile-composer-permission-controls. Update Purpose after archive.
## Requirements
### Requirement: Composer permission mode chip
移动端会话页空闲态 composer SHALL 在底部工具栏常驻展示当前权限模式 chip。chip MUST 使用 Codex App 对齐的四项中文标签之一：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。chip 的状态 MUST 同时反映 named permission profile 与 `approvalsReviewer`，不得只按 profile id 判断。

#### Scenario: Render active permission mode
- **WHEN** 用户进入会话页且 thread 处于静止状态
- **THEN** composer 底部工具栏 MUST 显示当前权限模式 chip
- **AND** chip MUST 与发送按钮、模型/思考档位 chip 同处于发送前状态区域
- **AND** chip MUST 显示 Codex App 对齐的四项标签之一

#### Scenario: Workspace with user reviewer
- **WHEN** 当前权限 payload 为 `permissions: ":workspace"` 且 `approvalsReviewer: "user"`
- **THEN** 权限 chip MUST 显示「请求批准」

#### Scenario: Workspace with auto reviewer
- **WHEN** 当前权限 payload 为 `permissions: ":workspace"` 且 `approvalsReviewer: "auto_review"`
- **THEN** 权限 chip MUST 显示「替我审批」

#### Scenario: Full access profile
- **WHEN** 当前权限 payload 为 `permissions: ":danger-full-access"`
- **THEN** 权限 chip MUST 显示「完全访问权限」

#### Scenario: Config default mode
- **WHEN** 当前权限 payload 清除了会话级权限 override
- **THEN** 权限 chip MUST 显示「自定义 config.toml」

### Requirement: Permission mode picker
权限模式 chip SHALL 打开移动端权限模式选择面板。面板 MUST 以 Codex App 为准固定展示「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」四项，并展示与 App 语义一致的说明文案。面板 MUST 不再把 `permissionProfile/list` 返回的原始 profile id 作为主要用户菜单。

#### Scenario: Open picker
- **WHEN** 用户点击 composer 底部工具栏的权限模式 chip
- **THEN** 系统 MUST 打开权限模式选择面板
- **AND** 面板 MUST 显示四个权限模式、说明文案和当前选中状态

#### Scenario: Request approval option
- **WHEN** 权限模式选择面板打开
- **THEN** 面板 MUST 显示「请求批准」
- **AND** 该选项 MUST 表示编辑外部文件和使用互联网时始终向用户询问

#### Scenario: Auto approval option
- **WHEN** 权限模式选择面板打开
- **THEN** 面板 MUST 显示「替我审批」
- **AND** 该选项 MUST 表示仅对检测到的风险操作请求批准

#### Scenario: Full access option
- **WHEN** 权限模式选择面板打开
- **THEN** 面板 MUST 显示「完全访问权限」
- **AND** 该选项 MUST 表示允许访问互联网和电脑文件，不使用旧的 `full-auto` profile id

#### Scenario: Config default option
- **WHEN** 权限模式选择面板打开
- **THEN** 面板 MUST 提供「自定义 config.toml」选项
- **AND** 该选项 MUST 表示使用 `config.toml` 当前定义的权限

### Requirement: Permission mode update semantics
用户选择权限模式后，系统 SHALL 更新当前会话后续 turn 的权限 payload。普通 App 模式 MUST 同时写入 `permissions` 和 `approvalsReviewer`；「自定义 config.toml」MUST 以 `permissions: null` 和 `approvalsReviewer: null` 清除会话级 override。后续 `turn/start` 和新会话启动 MUST 使用同一套 payload。

#### Scenario: Select request approval
- **WHEN** 用户在权限模式选择面板中选择「请求批准」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":workspace"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: "user"`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select auto approval
- **WHEN** 用户在权限模式选择面板中选择「替我审批」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":workspace"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: "auto_review"`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select full access
- **WHEN** 用户在权限模式选择面板中选择「完全访问权限」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: ":danger-full-access"`
- **AND** 请求体 MUST 包含 `approvalsReviewer: null`
- **AND** 后续 `POST /api/codex/turns/start` MUST 使用同一 payload，除非用户再次切换

#### Scenario: Select config default
- **WHEN** 用户选择「自定义 config.toml」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/settings`
- **AND** 请求体 MUST 包含 `permissions: null`
- **AND** 请求体 MUST 包含 `approvalsReviewer: null`
- **AND** 后续 `POST /api/codex/turns/start` MUST 以 `permissions: null` 和 `approvalsReviewer: null` 表达清除 override

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

### Requirement: Permission mode state source
会话页 SHALL 使用完整权限 payload 作为当前权限显示来源。完整权限 payload 包含 named permission profile 与 `approvalsReviewer`；本地乐观选择 SHALL 在后端未返回完整 payload 前保持有效。后端只返回 `activePermissionProfile` 而缺少 reviewer 时，MUST NOT 覆盖用户刚选择的 reviewer 语义。

#### Scenario: Read active payload from backend
- **WHEN** `thread/resume`、`thread/start`、settings 读取或 settings update 事件包含完整权限 payload
- **THEN** 前端 MUST 使用该 payload 作为权限 chip 的当前状态

#### Scenario: Optimistic selection wins over incomplete backend state
- **WHEN** 用户刚选择「替我审批」
- **AND** 后端随后只返回 `activePermissionProfile.id: ":workspace"` 而未返回 `approvalsReviewer`
- **THEN** 权限 chip MUST 继续显示「替我审批」
- **AND** 后续发送 MUST 继续携带 `approvalsReviewer: "auto_review"`

#### Scenario: Fallback to local state
- **WHEN** app-server 暂未返回完整权限 payload
- **AND** 前端存在该 thread 的本地权限选择记录
- **THEN** 权限 chip SHALL 使用本地记录作为临时显示
- **AND** 下一次后端返回完整权限 payload 后 MUST 以后端状态为准

#### Scenario: Settings aggregation partial failure
- **WHEN** `/api/codex/settings` 中与权限无关的子请求失败
- **THEN** 权限选择面板 MUST 仍能展示四个 Codex App 权限模式
- **AND** 用户 MUST 仍能切换权限并发送后续消息

