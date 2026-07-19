## Context

当前模型切换服务在读取当前状态时无条件调用 `thread/resume`。Codex app-server 对尚未产生首个 turn 的 thread 不创建 rollout，因此新会话会在模型切换前返回 `no rollout found`。同时，`thread/read` 的元数据响应不包含当前运行时 model/reasoning，服务端无法为这类会话构造完整 `modelState`；页面于是用默认 effort 生成只含当前值的伪能力列表。

历史 timeline 中的 Codex 系统提醒还存在兼容路径：实时 `warning` 事件已经进入 notice，但旧 rollout 可能把提醒恢复为 `turn_error` 文本。当前客户端只识别两种旧文案，`Heads up: Long threads...` 因此被渲染成红色错误。

## Goals / Non-Goals

**Goals:**

- 在不物化 rollout、不改变 thread ID 的前提下，完成空会话模型和 reasoning 切换。
- 让服务端和页面都使用统一模型目录中的完整能力声明；当前 effort 只表示选中项。
- 保持历史会话的冷恢复、权限快照、前置条件和恢复终态不变。
- 将已知 Codex 持久化系统提醒恢复为 warning notice，并保留真实 turn error。

**Non-Goals:**

- 不通过隐藏 turn、自动 compact 或删除重建 thread 来绕过 app-server 限制。
- 不修改 e3 的 `config.toml`、provider、凭据或模型目录数据。
- 不伪造 app-server 未声明的 reasoning effort；目录没有该模型时仍按现有失败关闭策略处理。

## Decisions

### 1. 在 gateway 内登记加载态运行时身份

`AppServerGateway` 增加按 thread ID 的运行时身份登记，来源包括 `thread/start`、`thread/resume` 返回值和 `thread/settings/updated` 通知。`readThreadMetadata` 在 thread/read 元数据上叠加该登记，使空会话也能得到 model、provider 和 reasoning。settings update 成功后同步更新登记；进程重启后没有登记时不猜测运行时身份。

相比把前端的 expected state 当作事实，gateway 登记保留了 app-server 成功响应和通知作为服务端来源；相比发送隐藏 turn，它不污染历史，也不消耗模型调用。

### 2. 用最新 turn 状态区分空会话与历史会话

模型切换服务先读取元数据和有界的最新 turn 状态。最新 turn 状态为 `null` 才表示未物化空会话；读取失败或存在 turn 时按历史会话处理，不能把“未知”降级为空会话。空会话执行 `thread/settings/update` 后读取带 gateway 身份的元数据完成 model/provider/reasoning 核验，不再调用 resume；历史会话继续使用 unsubscribe 与冷 resume。

目标失败和旧状态恢复共用同一分支，操作记录、binding 提交和 `recovery_failed` 语义保持不变。

### 3. 模型目录是 reasoning 能力的唯一展示兜底

会话页读取统一模型目录，并按当前 app-server model 合并 `supportedReasoningEfforts`、`defaultReasoningEffort`、label 和输入模态。服务端已经返回完整 `modelState` 时优先使用服务端快照；仅有 model/effort 的旧状态不能再把 effort 构造成支持列表。自定义绑定继续使用绑定快照，不与同名 app-server 项混淆。

### 4. 持久化提醒使用精确兼容识别

扩展历史 warning 识别器，加入 Codex `Heads up: Long threads and multiple compactions...` 文案（允许空白差异），并继续保留真实 turn error。被识别的 legacy error 从 timeline 移除并写入可去重 notice，实时 warning 路径不变。

## Risks / Trade-offs

- [Risk] gateway 进程重启后空会话没有 runtime 登记 → 读取状态时不猜测 model；前端显示目录默认值，但切换在无法确认当前状态时返回结构化冲突，而不是静默覆盖。
- [Risk] settings update 通知晚于请求响应 → 成功请求先更新登记，后续通知可用完整值覆盖；验证只接受当前 thread ID 的登记。
- [Risk] warning 文案在未来版本变化 → 只扩展已确认的 `Heads up` 长会话文案和空白归一化，不把所有 error 统称 warning；未知文案继续按真实错误处理。
- [Trade-off] 页面为 reasoning 选择器增加一次模型目录读取 → 请求可与 settings 并行并由请求协调器去重，换取旧会话和空会话一致的能力展示。

## Migration Plan

1. 先为 runtime identity、空会话切换和 warning 分类添加失败测试。
2. 实现 gateway 登记、switch service 分支、服务端 modelState 和页面目录兜底。
3. 运行定向测试、`npm run verify`、`npm run build`、严格 OpenSpec 校验和 390px 验收。
4. 部署后重启 e3 服务，由用户验证新建会话切换模型、六档 reasoning 列表和刷新 warning；回滚时不需要数据迁移，新增状态仅存在进程内。

## Open Questions

无。空会话以“无最新 turn 且 runtime identity 可确认”为可切换条件；无法确认时必须失败关闭。
