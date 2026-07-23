# permission-mode-controls Specification

## Purpose
TBD - created by archiving change redesign-mobile-composer-permission-controls. Update Purpose after archive.
## Requirements
### Requirement: Composer permission mode chip
移动端会话页空闲态 composer SHALL 在底部工具栏常驻展示当前 configured permission selection 对应的权限模式 chip。chip MUST 使用 Codex App 对齐的四项中文标签之一：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。configured selection MUST 同时包含 named permission profile、`approvalPolicy` 与 `approvalsReviewer`；app-server 当前 turn 的 runtime permission observation MUST NOT 单独改写 chip。

#### Scenario: Render active permission mode
- **WHEN** 用户进入会话页且 thread 处于静止状态
- **THEN** composer 底部工具栏 MUST 显示 configured selection 对应的权限模式 chip
- **AND** chip MUST 与发送按钮、模型/思考档位 chip 同处于发送前状态区域

#### Scenario: Workspace with user reviewer
- **WHEN** configured selection 为 `permissions: ":workspace"`、`approvalPolicy: "on-request"` 且 `approvalsReviewer: "user"`
- **THEN** 权限 chip MUST 显示「请求批准」

#### Scenario: Workspace with auto reviewer
- **WHEN** configured selection 为 `permissions: ":workspace"`、`approvalPolicy: "on-request"` 且 `approvalsReviewer: "auto_review"`
- **THEN** 权限 chip MUST 显示「替我审批」

#### Scenario: Full access profile
- **WHEN** configured selection 为 `permissions: ":danger-full-access"` 且 `approvalPolicy: "never"`
- **THEN** 权限 chip MUST 显示「完全访问权限」
- **AND** `approvalsReviewer` 的 runtime observation MUST NOT 重新启用审批模式显示

#### Scenario: Danger sandbox with approval still enabled
- **WHEN** configured selection 为 `permissions: ":danger-full-access"` 但 `approvalPolicy` 不是 `never`
- **THEN** 权限 chip MUST NOT 把该组合显示为「完全访问权限」
- **AND** 页面 MUST 显示权限状态未完整生效的反馈或触发有界状态恢复

#### Scenario: Config default mode
- **WHEN** configured selection 明确清除了 `permissions`、`approvalPolicy` 与 `approvalsReviewer` 三个会话级 override
- **THEN** 权限 chip MUST 显示「自定义 config.toml」

#### Scenario: Runtime settings observation does not relabel chip
- **WHEN** configured selection 为「完全访问权限」
- **AND** app-server 随后发出完整的 `thread/settings/updated`，其 runtime observation 为 `:workspace + on-request + user`
- **THEN** 权限 chip MUST 继续显示「完全访问权限」
- **AND** 该 runtime observation MUST 仅用于诊断

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
用户选择权限模式后，系统 SHALL 更新当前会话后续 turn 的完整 configured permission selection。普通 App 模式 MUST 同时写入 `permissions`、`approvalPolicy` 和 `approvalsReviewer`；「自定义 config.toml」MUST 对三个字段发送显式 `null` 以清除会话级 override。成功的显式设置 MUST 产生可排序、可去重的配置提交事件；后续 `turn/start` 和新会话启动 MUST 使用同一 configured selection。

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
- **AND** 显式设置结果仍为 `approvalPolicy: "on-request"` 或其他非 `never` 值
- **THEN** 系统 MUST 将本次设置视为未完整生效
- **AND** 后续发送 MUST NOT 静默宣称当前模式为「完全访问权限」

#### Scenario: Explicit settings commit is broadcast
- **WHEN** gateway 成功应用完整权限设置
- **THEN** 系统 MUST 广播包含完整 configured selection 的 `thread_permission_configured` 事件
- **AND** 事件 MUST 携带现有事件流提供的 `bootId`、`revision` 与 `eventId`

#### Scenario: Approval resolution does not change configured mode
- **WHEN** 用户解决命令、文件或权限审批请求
- **THEN** configured permission selection MUST 保持不变
- **AND** 审批结果 MUST NOT 被写入权限 chip 或下一次 `turn/start` payload

### Requirement: Permission mode state source
会话页 SHALL 将 configured permission selection 作为权限显示与发送来源，并将 app-server runtime permission observation 单独保存。完整 configured selection 包含 named permission profile、`approvalPolicy` 与 `approvalsReviewer`；系统 MUST 区分尚未读取的 `undefined` 与显式清除 override 的 `null`。只有明确的用户设置、配置提交事件或携带同一显式覆盖的 start/resume 结果可以替换 configured selection。

#### Scenario: Read configured payload from authoritative source
- **WHEN** `thread/start`、带显式权限覆盖的 `thread/resume`、成功 settings 提交或配置提交事件包含完整权限 payload
- **THEN** 前端 MUST 使用该 payload 作为权限 chip 和后续发送的 configured selection

#### Scenario: Runtime settings event is observation only
- **WHEN** 普通 `thread/settings/updated` 包含完整权限三元组
- **THEN** 前端 MUST 将其保存为 runtime permission observation
- **AND** MUST NOT 覆盖 configured selection 或 localStorage

#### Scenario: Optimistic selection wins over incomplete backend state
- **WHEN** 用户刚选择「替我审批」
- **AND** 后端随后只返回 `activePermissionProfile.id: ":workspace"` 而缺少 `approvalPolicy` 或 `approvalsReviewer`
- **THEN** 权限 chip MUST 继续显示「替我审批」
- **AND** 后续发送 MUST 继续携带 `approvalPolicy: "on-request"` 与 `approvalsReviewer: "auto_review"`

#### Scenario: Unknown state is not explicit config default
- **WHEN** 页面尚未从本地选择或权威配置来源获得任一完整权限 payload
- **THEN** 系统 MUST 将 configured selection 保持为 unknown
- **AND** MUST NOT 把 unknown 归一化为三个 `null` 后写入 settings 或 `turn/start`

#### Scenario: Resume result restores permission before send
- **WHEN** thread 状态为 `notLoaded` 且用户发送消息
- **AND** 页面先调用带显式覆盖或 idle 引导语义的 `thread/resume`
- **THEN** 发送流程 MUST 消费该 resume 返回的完整 configured selection
- **AND** `turn/start` MUST NOT 使用 resume 前闭包中的 unknown、stale 或 runtime observation

#### Scenario: Fallback to local state
- **WHEN** gateway 暂未返回 configured selection
- **AND** 前端存在该 thread 的本地完整权限选择记录
- **THEN** 权限 chip SHALL 使用本地记录作为 configured selection
- **AND** 普通 runtime observation MUST NOT 覆盖该记录

#### Scenario: Reconnect preserves configured selection
- **WHEN** 页面刷新、事件流重连或 settings 事件乱序
- **AND** 前端或 gateway 已存在完整 configured selection
- **THEN** 系统 MUST 保持该 configured selection，直到收到更新的显式配置提交事件

#### Scenario: Settings aggregation partial failure
- **WHEN** `/api/codex/settings` 中与权限无关的子请求失败
- **THEN** 权限选择面板 MUST 仍能展示四个 Codex App 权限模式
- **AND** 用户 MUST 仍能切换权限并发送后续消息

### Requirement: Incomplete permission state is pending, not failed

当 configured permission selection 包含未返回的字段时，前端 MUST 显示低干扰的“权限状态待确认”状态，不得将其解释为权限失败，也不得阻止用户发送消息。runtime observation 的完整性 MUST NOT 把 configured unknown 自动转换为任一权限模式。

#### Scenario: Partial permission payload arrives
- **WHEN** configured selection 的 `permissions`、`approvalPolicy`、`reviewer` 任一字段为 `undefined`
- **THEN** composer 显示待确认状态，保留发送能力，并说明正在等待完整配置状态

#### Scenario: Complete local selection wins
- **WHEN** 本地缓存包含完整三元组，即使 detail 或 runtime observation 暂时不完整
- **THEN** 页面立即显示本地选择对应的真实权限模式，而不是待确认

#### Scenario: Complete configured event restores mode
- **WHEN** 显式配置提交事件或权威 detail 返回完整三元组（允许显式 `null`）
- **THEN** 页面切换到对应的真实权限模式并移除待确认文案

### Requirement: Permission mismatch remains fail closed
当 configured selection 表示完全访问但 app-server 仍产生真实命令审批时，系统 SHALL 保留后端审批边界并提供可诊断反馈。系统 MUST NOT 根据前端 chip 自动响应审批。

#### Scenario: Command approval under configured full access
- **WHEN** configured selection 为 `:danger-full-access + never`
- **AND** 当前或下一 turn 收到 `command_approval`
- **THEN** timeline MUST 继续显示可操作的审批卡片
- **AND** 页面 MUST 显示去重的“权限配置未生效”提示
- **AND** 系统 MUST NOT 自动提交 accept、acceptForSession 或其他允许 decision

#### Scenario: Repeated mismatches in one turn
- **WHEN** 同一 turn 连续收到多个相同 configured/runtime 指纹的命令审批
- **THEN** 权限不一致提示 MUST 去重
- **AND** 每个真实审批请求 MUST 仍各自保留

### Requirement: Runtime model changes preserve complete permission selection
任何会改变或重建 thread 模型运行时的操作 SHALL 保持操作开始时的完整权限选择。完整权限选择 MUST 包含 `permissions`、`approvalPolicy` 与 `approvalsReviewer`，并 MUST 用于目标切换、旧状态回滚、显式恢复和进程中断恢复。

#### Scenario: Historical model switch carries permissions through cold resume
- **WHEN** 已有历史的 thread 使用冷 resume 切换模型
- **THEN** resume 请求 MUST 同时携带操作开始时的 `permissions`、`approvalPolicy` 与 `approvalsReviewer`
- **AND** 模型切换成功后权限 chip 与后续 turn payload MUST 保持同一权限模式

#### Scenario: Recovery uses the original permission snapshot
- **WHEN** 模型目标失败后恢复旧状态，或服务重启后恢复未完成 operation
- **THEN** 系统 MUST 使用 operation 保存的同一完整权限选择
- **AND** 系统 MUST NOT 从浏览器陈旧状态、当前部署默认值或模型目标推断替代权限

### Requirement: Binding operation persists permission selection compatibly
新建 binding operation SHALL 持久化完整合法的可选 `permissionSelection`。读取器 MUST 兼容没有该字段的旧 operation；若新字段存在但缺少成员、包含未知枚举或额外字段，读取 MUST 失败关闭。

#### Scenario: New operation records complete permissions
- **WHEN** 系统在模型运行时变更前创建 binding operation
- **THEN** operation MUST 保存 `permissions`、`approvalPolicy` 与 `approvalsReviewer` 的完整值，包括显式 `null`

#### Scenario: Legacy operation remains readable
- **WHEN** 持久化文件中的旧 operation 不包含 `permissionSelection`
- **THEN** 读取器 MUST 接受该 operation
- **AND** 恢复流程 MUST 使用兼容的部署默认权限行为

#### Scenario: Partial permission snapshot fails closed
- **WHEN** `permissionSelection` 存在但任一成员缺失、枚举非法或包含未允许字段
- **THEN** 绑定存储 MUST 拒绝该文件
- **AND** 系统 MUST NOT 猜测或静默修补权限


﻿### Requirement: Permission settings recover missing live thread
用户更新当前会话权限模式时，服务端 SHALL 在 thread 尚未 live 的情况下先恢复 live thread 再提交 settings。前端 MAY 继续直接调用 settings API；gateway MUST 对该路径提供 bare resume + 一次重试。成功后的 configured permission selection 语义保持不变。

#### Scenario: Cold session permission switch succeeds
- **WHEN** 用户进入历史或新会话后直接选择权限模式
- **AND** app-server 首次 `thread/settings/update` 返回 thread not found 或等价 missing-live-thread 错误
- **THEN** 服务端 MUST bare resume 该 thread
- **AND** MUST 使用用户选择的完整权限三元组重试 settings update
- **AND** 前端 MUST 看到设置成功，而不是 `thread not found`

#### Scenario: Model switch workaround is no longer required
- **WHEN** 用户未先切换模型
- **AND** 直接更新权限设置
- **THEN** 系统 MUST 仍能完成权限设置
- **AND** MUST NOT 要求前端先执行 model switch 作为前置条件
