## Context

上一个权限 composer 变更已经把权限 chip 放进移动端 composer，但当前实现仍把权限理解成单一 `permissions` profile id。实际 Codex App 的权限菜单有四个用户语义：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。其中「请求批准」和「替我审批」都可以落在 workspace 权限 profile 上，差异在 `approvalsReviewer`；仅靠 `activePermissionProfile.id` 无法区分。

当前 Web 端还残留旧的或猜测的 profile id，例如 `read-only`、`workspace-write`、`full-auto`。真实 app-server 当前返回的内置 profile id 包含 `:workspace`、`:danger-full-access`，发送旧 id 会造成设置更新或发送消息失败。另一个相关问题是 `/api/codex/settings` 聚合读取 rate limit 等信息失败时，权限 profile 列表也会丢失；权限菜单不应因为无关设置读取失败而不可用。

模型 chip 的文案也需要跟随移动端 App 语义收敛：当前显示 `模型，中文推理强度`，用户要求模型与推理强度之间不要使用逗号，并将 `low` / `medium` / `high` 展示为官方英文表达。

## Goals / Non-Goals

**Goals:**

- 权限菜单固定展示 Codex App 四项，并使用中文标签和说明文案。
- 将每个权限选项映射为明确的 `permissions` 与 `approvalsReviewer` 组合。
- 更新 Web API 类型、路由和 app-server gateway，使 thread start、turn start、thread settings update 都能透传 `approvalsReviewer`，并能从 app-server response / settings event 回读同步 reviewer 状态。
- 清除旧 Web profile id，不再发送 `read-only`、`workspace-write`、`full-auto` 等不符合当前 app-server 的值。
- 让权限切换后的 chip 立即显示新选择，并让下一次发送使用同一个权限语义。
- 让权限菜单在 settings 聚合部分失败时仍可显示四项固定入口。
- 模型 chip 改为不带逗号的组合文案，并以 `Low` / `Medium` / `High` 展示推理强度。

**Non-Goals:**

- 不改变 app-server 的权限 profile 定义，也不在 Web 端重新实现沙箱策略。
- 不新增桌面端布局。
- 不把所有 app-server 自定义 permission profile 做成一级菜单；本轮以 Codex App 四项为准。
- 不改变 reasoning effort 的协议值；发送给 app-server 的值仍为 `low` / `medium` / `high` 等原始字符串。
- 不解决 rate limit 登录失败本身，只降低它对权限菜单的连带影响。

## Decisions

1. **用四个固定的 Web 权限模式建模，而不是直接渲染 `permissionProfile/list`。**

   选择：前端定义稳定的权限模式 id，例如 `request-approval`、`auto-approve`、`full-access`、`config-default`，UI 始终按 Codex App 顺序展示四项。`permissionProfile/list` 仍可用于校验或描述补充，但不决定菜单是否存在。

   理由：用户明确要求截图里的 Codex App 是准绳。app-server profile id 是协议层细节，不适合直接暴露给用户，也不能表达 reviewer 差异。

   备选：继续渲染 app-server 返回 profiles。该方案无法天然显示「替我审批」，也会在 settings 聚合失败时丢菜单。

2. **权限模式映射同时写 `permissions` 与 `approvalsReviewer`。**

   建议映射如下：

   ```text
   请求批准:
     permissions = ":workspace"
     approvalsReviewer = "user"

   替我审批:
     permissions = ":workspace"
     approvalsReviewer = "auto_review"

   完全访问权限:
     permissions = ":danger-full-access"
     approvalsReviewer = null

   自定义 config.toml:
     permissions = null
     approvalsReviewer = null
   ```

   `null` 表示清除会话级 reviewer override，避免用户从「替我审批」切到「完全访问权限」或「自定义 config.toml」后仍继承 `auto_review`。本设计明确决定「完全访问权限」发送 `approvalsReviewer: null`，让 full access profile 使用 app-server 默认 reviewer 语义，并清理前一个模式留下的 reviewer override。

   备选：只在「替我审批」时写 `approvalsReviewer`，其他选项省略。该方案会保留 thread sticky reviewer，容易造成切换后状态污染。

3. **状态模型保存权限模式，而不仅保存 profile id。**

   选择：前端 thread state 至少需要记录 `permissionProfileId` 和 `approvalsReviewer`，或直接记录派生后的 `permissionModeId` 及其协议 payload。显示当前 chip 时用 profile + reviewer 反推四项之一。

   理由：`:workspace` + `user` 和 `:workspace` + `auto_review` 在用户眼里是两个模式。只保存 profile id 会让 chip 和实际发送参数不可逆。

   备选：继续只保存 `permissionProfileId`。该方案无法区分「请求批准」与「替我审批」。

4. **后端 active 状态和本地乐观状态要有明确合并顺序。**

   选择：用户刚切换后立即使用本地乐观模式显示和发送；当 `thread/start`、`thread/resume`、`thread/fork` 或 `thread/settings/updated` 包含完整 profile + reviewer 且能反推出模式时，再同步本地状态。只有 profile 而没有 reviewer 的旧数据不得覆盖刚选择的 reviewer 语义。

   理由：当前问题之一是 stale `activePermissionProfile` 会覆盖 UI 选择。完整后端状态应可信，但不完整状态不能抹掉本地刚做出的选择。

   备选：始终以后端 `activePermissionProfile` 为最高优先级。该方案会把「替我审批」显示回普通 workspace 模式。

5. **权限 profile 获取走轻量或容错路径。**

   选择：实现时优先考虑新增或复用轻量 endpoint 调 `permissionProfile/list`，或者让现有 settings 聚合对 rate limit/auth 等非权限失败做 partial fallback。无论 profile 列表是否可读，四项固定菜单都必须可渲染。

   理由：权限菜单是发送前核心控制，不应被 rate limit 读取失败阻断。

   备选：继续依赖 `/api/codex/settings` 聚合完整成功。该方案已暴露出权限列表丢失风险。

6. **模型 chip 使用展示格式化函数，不改变协议值。**

   选择：`modelChipText` 使用空格或紧凑分隔，例如 `gpt-5-codex Medium`；`reasoningEffortLabel` 将常见值显示为 `Low`、`Medium`、`High`，未知值用可读的英文首字母大写回退。发送参数仍使用原始 `reasoningEffort`。

   理由：显示应符合用户和官方英文表达，协议层不能被展示文案影响。

   备选：直接显示小写协议值。该方案准确但视觉上不如 App 文案自然。

## Risks / Trade-offs

- [Risk] `:danger-full-access` 在某些 app-server 版本中不可用。→ Mitigation：保留 profile list 校验和错误提示；发送前不得回退到旧 id，必要时显示 app-server 返回的具体错误。
- [Risk] `approvalsReviewer: null` 的清除语义在某些路径被 JSON 过滤掉。→ Mitigation：API 类型、route body、gateway params 和测试都要覆盖显式 `null`。
- [Risk] 后端 response 或 settings event 映射漏掉 reviewer，导致刷新后不能区分「请求批准」和「替我审批」。→ Mitigation：实现时扩展 `ThreadStartResponse`、`ThreadResumeResponse`、`ThreadForkResponse`、`thread/settings/updated` 的 Web 映射，并用 store/event 测试覆盖；不完整后端状态不得覆盖完整本地模式。
- [Risk] 固定四项菜单忽略用户自定义 profile。→ Mitigation：本轮以 Codex App 对齐为目标；「自定义 config.toml」仍允许回到用户自定义配置。后续如 App 增加自定义 profile 入口，再单独扩展。
- [Risk] settings 聚合部分失败处理过宽会吞掉真正错误。→ Mitigation：只对与权限菜单无关的子请求做局部降级，保留审计日志和可见错误信息。
- [Risk] 模型 chip 文案变化会影响现有测试和辅助功能名称。→ Mitigation：同步更新 aria-label 与单元测试，确保移动端按钮仍可被清晰读出。

## Migration Plan

- 先更新类型和测试，明确四项权限模式的 payload 与 chip 文案。
- 再改 API route/gateway 透传 `approvalsReviewer`，确保 `null` 不被过滤。
- 然后改 ThreadPage 和 ChatInput 的状态派生与展示。
- 最后部署更新容器时沿用当前滚动更新流程，不主动停止用户正在访问的 `19899` 服务。
- 回滚时可回到上一镜像或上一提交；app-server 配置不会被迁移，Web 只改变发送参数。

## Open Questions

- 是否需要在 UI 上给 `:danger-full-access` 不可用的环境显示禁用态？本轮可以先让请求失败暴露真实错误，若常见再补充禁用态。
