## Why

当前移动端 Web 的权限选择器仍以 Web 端猜测的 permission profile 为中心，和 Codex App 中展示的四种权限模式不一致；切换权限后还会把旧的或不完整的权限参数传给 app-server，导致后续发送消息失败。需要把移动端 Web 的权限菜单、状态显示和请求参数统一到 Codex App 语义，并顺手修正模型 chip 中模型与推理强度的展示文案。

## What Changes

- 权限选择面板固定展示并语义对齐 Codex App 的四项：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。
- 权限切换不再只写 `permissions`，而是按选项同时维护 `permissions` 与 `approvalsReviewer`，确保 `thread/settings/update`、`turn/start`、`thread/start` 的参数符合 app-server 规范。
- 「请求批准」和「替我审批」共享 workspace 权限 profile，但使用不同 `approvalsReviewer` 表达人工审批或自动代审。
- 「完全访问权限」使用 app-server 的 full access profile，且不误传旧的 `full-auto` / `workspace-write` 等无效 id。
- 「自定义 config.toml」清除会话级 override，让 app-server 回到当前 `config.toml` 配置。
- 权限 chip 的当前态必须能表达四项之一，并在用户切换后立即反映选择，不能被 stale `activePermissionProfile` 覆盖成旧状态。
- 模型 chip 中模型名与推理强度之间不再使用中文逗号；推理强度展示从「低 / 中 / 高」改为官方英文表达「Low / Medium / High」，协议传参仍保持小写值。
- 权限 profile 列表获取需要避免被大型 settings 聚合接口的部分失败拖垮；至少要保证四项固定菜单可用。

## Capabilities

### New Capabilities

### Modified Capabilities

- `permission-mode-controls`: 权限菜单项、权限状态语义和 app-server 参数传递规则改为对齐 Codex App。
- `chat-input-area`: composer 底栏模型 chip 的模型/推理强度组合展示和推理强度文案发生变化。

## Impact

- 前端页面与组件：`src/app/threads/[threadId]/page.tsx`、`src/web/components/ChatInput.tsx`。
- 前端状态：thread 本地模型/权限状态、后端 active profile 合并逻辑、乐观切换展示。
- 前端 API 类型：`StartThreadInput`、`StartTurnInput`、thread settings update 需要支持 `approvalsReviewer?: "user" | "auto_review" | "guardian_subagent" | null`。
- 后端 API route 与 gateway：`POST /api/codex/threads/start`、`POST /api/codex/turns/start`、`POST /api/codex/threads/:threadId/settings` 需要透传 `permissions` 和 `approvalsReviewer`。
- app-server 交互：使用当前协议 profile id，例如 `:workspace`、`:danger-full-access` 和 `null`，不得继续发送旧 Web id。
- 测试：需要覆盖四项权限菜单、切换后发送、settings 更新、thread start、权限状态显示、settings 部分失败降级，以及模型 chip 文案。
