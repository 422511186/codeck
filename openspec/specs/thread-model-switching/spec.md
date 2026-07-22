# thread-model-switching Specification

## Purpose
TBD - created by archiving change add-custom-model-catalog. Update Purpose after archive.
## Requirements
### Requirement: Unified idle-only model switch command
系统 SHALL 通过单个后端命令切换已有会话模型。命令 MUST 保留 thread ID 与完整历史，所有 app-server 和自定义目标 MUST 使用相同流程；系统 MUST NOT 通过普通 thread settings update 或浏览器串联 unsubscribe/resume 实现模型切换。

#### Scenario: Switch idle thread
- **WHEN** 已认证用户对空闲会话提交来源敏感的目标模型选择
- **THEN** 后端 MUST 使用 Codex 当前 provider、目标模型与目标配置重建同一个 thread 的运行时
- **AND** 成功后 MUST 返回更新后的会话、选择身份和绑定状态

#### Scenario: Running turn rejects switch
- **WHEN** 会话存在运行中的 turn
- **THEN** 后端 MUST 返回 HTTP 409 且 MUST NOT 中断、排队或执行切换
- **AND** 前端 MUST 保留当前选择、草稿和附件

### Requirement: Stale switch preconditions fail before mutation
切换请求 SHALL 携带 `expectedCatalogRevision` 以及调用方最后读取的当前选择身份、reasoning 档位和自定义 `bindingVersion`。后端 MUST 在 `threadId` 锁内重新读取目录、绑定和运行时并校验这些前置条件。

#### Scenario: Stale device switch is rejected
- **WHEN** 另一设备已改变目录、当前模型、reasoning 或绑定版本
- **THEN** 后端 MUST 返回 HTTP 409 和后端确认的最新状态
- **AND** MUST NOT 执行 unsubscribe 或写入绑定操作记录
- **AND** 前端 MUST 刷新状态、保留草稿且 MUST NOT 自动重试

### Requirement: Context capacity preflight
模型切换前，系统 SHALL 将最近一次已知当前上下文用量与目标标称窗口比较。已知用量达到目标窗口 90% 时 MUST 阻止切换并要求用户先手动压缩；用量未知时 MUST 允许继续。系统 MUST NOT 自动压缩。

#### Scenario: Known usage requires compaction
- **WHEN** 最近一次已知上下文用量大于或等于目标窗口的 90%
- **THEN** 后端 MUST 返回 HTTP 409 和稳定的需要压缩错误码
- **AND** MUST NOT 开始模型切换

#### Scenario: Unknown usage does not block
- **WHEN** 当前会话没有可靠的最近一次上下文用量
- **THEN** 容量预检 MUST NOT 单独阻止切换
- **AND** 后续 resume 失败仍 MUST 进入标准恢复流程

### Requirement: Runtime reload and verification
通过前置检查后，后端 SHALL 记录旧状态，取消当前 Web 连接对 thread 的订阅，并使用目标模型、Codex 当前 provider、目标 reasoning 与自定义上下文覆盖执行冷 resume。自定义目标 MUST 显式传 `model_context_window`；app-server 目标 MUST 省略该覆盖并让 Codex 解析窗口。后端 MUST 核验 resume 返回的模型和 provider。

#### Scenario: Custom model reload succeeds
- **WHEN** 自定义目标 resume 返回预期模型和当前 provider
- **THEN** 后端 MUST 提交目标绑定并清除操作记录
- **AND** 前端 MUST 仅在收到 `switched` 后采用目标状态

#### Scenario: Official model clears custom override
- **WHEN** 自定义绑定会话切换到 app-server 模型
- **THEN** resume MUST 不传旧的 `model_context_window`
- **AND** 成功后 MUST 移除自定义绑定

### Requirement: Deterministic switch outcomes
模型切换 SHALL 返回稳定的业务终态与 HTTP 映射：`200 switched`、未开始变更的 `409`、目标失败但旧状态恢复的 `502 recovered`、以及目标与旧状态都无法可靠恢复的 `500 recovery_failed`。所有非成功响应 MUST 包含稳定错误码、`operationId` 和后端确认的最新会话状态。

#### Scenario: Target fails and old state recovers
- **WHEN** 目标 resume 或核验失败且旧运行时与旧绑定恢复成功
- **THEN** API MUST 返回 HTTP 502 和 `outcome: "recovered"`
- **AND** 前端 MUST 保持旧模型且 MUST NOT 显示目标已生效

#### Scenario: Target and recovery both fail
- **WHEN** 目标和旧状态都无法可靠恢复
- **THEN** API MUST 返回 HTTP 500 和 `outcome: "recovery_failed"`
- **AND** 会话 MUST 禁止发送 turn
- **AND** 系统 MUST 保留操作记录而不能猜测当前状态

### Requirement: Persisted custom thread binding snapshot
自定义模型会话 SHALL 在专用数据目录的独立版本化 `thread-model-bindings.json` 中按 `threadId` 保存绑定快照。快照 MUST 包含 `bindingVersion`、`customModelId`、模型标识、显示名称、标称窗口、能力声明、来源配置更新时间和实际 reasoning 档位；MUST NOT 保存 provider。

#### Scenario: Catalog edit does not alter bound thread
- **WHEN** 用户编辑或删除已有会话所绑定的自定义模型目录项
- **THEN** 现有绑定 MUST 保持原快照
- **AND** 当前运行时 MUST NOT 自动切换或采用新配置

#### Scenario: Current provider is resolved on resume
- **WHEN** Web 或 app-server 重启后恢复自定义绑定会话
- **THEN** 后端 MUST 使用绑定的模型、窗口和 reasoning 快照
- **AND** MUST 从 Codex 当前配置重新读取 provider，而不是使用旧 provider 名称

### Requirement: Persisted binding operation record
已有会话的切换、重新应用和绑定 reasoning 更新 SHALL 在修改 app-server 前持久化 `{operationId, oldBinding, targetBinding}` 操作记录，并在目标绑定原子提交后清除。存在未完成记录的会话 MUST 在继续正常访问前完成恢复，恢复期间 MUST 禁止发送 turn。

#### Scenario: Process exits during switch
- **WHEN** 进程在写入操作记录后、提交目标绑定前退出
- **THEN** 下次访问该会话 MUST 先按记录重新应用目标或恢复旧状态
- **AND** MUST NOT 静默选择文件或 app-server 任一侧作为事实

#### Scenario: Binding file is corrupted
- **WHEN** 绑定文件无法通过 JSON、schema 或字段校验
- **THEN** 自定义绑定恢复与切换 MUST 失败关闭
- **AND** 系统 MUST NOT 清空绑定或把会话降级成 app-server 来源

### Requirement: Binding lifecycle follows thread lifecycle
自定义绑定 SHALL 在新会话 start 或模型切换核验成功后创建或替换，在切换到 app-server 模型后移除。fork MUST 继承来源绑定快照；归档和取消归档 MUST 保留绑定；删除 thread MUST 清理绑定。无绑定旧会话 MUST NOT 仅因同名目录项自动建立绑定。

#### Scenario: Start custom thread commits before response
- **WHEN** 自定义模型 thread/start 成功并返回新 `threadId`
- **THEN** Web MUST 在向浏览器返回成功前写入对应绑定

#### Scenario: Fork inherits binding
- **WHEN** 自定义绑定会话 fork 成功
- **THEN** 新 thread ID MUST 获得来源会话绑定快照和独立 `bindingVersion`

#### Scenario: Delete removes binding
- **WHEN** app-server thread/delete 成功
- **THEN** Web MUST 清理该 thread 的绑定与未完成操作记录

### Requirement: Explicitly reapply edited custom configuration
目录中同一 `customModelId` 的 `updatedAt` 与会话绑定来源时间不同时，模型选择器 SHALL 显示配置更新状态。保存目录编辑 MUST NOT 自动重建会话；用户显式选择“重新应用”后 MUST 执行完整切换流程。

#### Scenario: Reapply updated configuration
- **WHEN** 用户对空闲会话点击“重新应用”
- **THEN** 后端 MUST 解析该 `customModelId` 的当前完整配置并执行前置检查、容量预检、操作记录、resume、核验和恢复
- **AND** 成功后 MUST 生成新 `bindingVersion`

#### Scenario: Current configuration is already applied
- **WHEN** 绑定来源更新时间与目录 `updatedAt` 相同
- **THEN** 选择器 MUST 不显示配置有更新
- **AND** 重复点击当前模型 MUST 不触发运行时重建

### Requirement: Catalog-backed reasoning capabilities
会话模型状态 SHALL 使用统一模型目录中与当前来源身份匹配的完整 `supportedReasoningEfforts` 和 `defaultReasoningEffort`。当前选中的 reasoning 值 MUST 只用于标记选中项；系统 MUST NOT 将当前值单独构造成支持列表。

#### Scenario: Empty thread uses complete app-server capabilities
- **WHEN** 新会话尚无 rollout，thread 元数据只有当前 model/reasoning 或 modelState 尚未生成
- **THEN** 会话状态 MUST 从统一 app-server 模型目录补齐该模型的完整 reasoning 能力
- **AND** `gpt-5.6-sol` 的选择器 MUST 显示目录返回的 `low`、`medium`、`high`、`xhigh`、`max` 和 `ultra`

#### Scenario: Custom binding capabilities remain authoritative
- **WHEN** 当前选择来源为 custom
- **THEN** 推理强度列表 MUST 使用 binding 快照的能力声明
- **AND** 同名 app-server 模型的能力 MUST NOT 覆盖 custom binding

#### Scenario: Unknown current model does not invent efforts
- **WHEN** 当前 model 不在 app-server 目录且没有 custom binding
- **THEN** 系统 MUST 保留原始当前 reasoning 作为选中值（若存在）
- **AND** 系统 MUST NOT 猜测或补全目录外的标准 effort

### Requirement: Reasoning effort follows target capabilities
切换目标的实际 reasoning 档位 SHALL 优先沿用当前档位；当前值不受目标支持时 MUST 使用目标 `defaultReasoningEffort`，目标未声明 reasoning 时 MUST 使用 `null`。自定义绑定 MUST 保存实际档位；会话内 reasoning 更新仅在 app-server 成功后更新绑定并生成新 `bindingVersion`。

#### Scenario: Preserve supported effort
- **WHEN** 当前 reasoning 值存在于目标的精确支持列表
- **THEN** 切换 MUST 沿用该值并原样传给 app-server

#### Scenario: Fall back to target default
- **WHEN** 当前 reasoning 不被目标支持
- **THEN** 切换 MUST 使用目标声明的默认值
- **AND** MUST NOT 根据常见枚举猜测替代值

### Requirement: Draft input compatibility is enforced without data loss
当前自定义绑定的输入模态 SHALL 约束待发送草稿。切换到只支持文本的模型时，系统 MUST 保留已选图片、普通文件与文本并允许切换，但 MUST 仅因不受支持的图片阻止发送，直到用户移除图片或切换回支持图片的模型。普通文件引用本身 MUST 按文本上下文兼容处理，不得被误判为 image modality。历史消息中的图片和普通文件 MUST NOT 阻止模型切换。

#### Scenario: Draft images survive text-only switch
- **WHEN** 草稿包含图片且用户切换到仅支持文本的模型
- **THEN** 切换 MUST 继续执行并保留图片、普通文件与文本草稿
- **AND** 发送按钮 MUST 被阻止并显示图片输入不兼容状态

#### Scenario: Ordinary files remain compatible with text-only model
- **WHEN** 草稿包含非空文本与已就绪普通文件但不包含图片
- **AND** 用户切换到只支持文本的模型
- **THEN** 切换 MUST 继续执行并保留普通文件与文本
- **AND** 普通文件 MUST NOT 单独阻止发送

#### Scenario: Mixed files and images preserve all draft data
- **WHEN** 草稿同时包含普通文件与图片并切换到只支持文本的模型
- **THEN** 所有附件和文本 MUST 保留
- **AND** 发送阻塞原因 MUST 指向图片不兼容
- **AND** 用户移除图片后 MUST 能继续发送普通文件与文本

#### Scenario: Historical images and files do not block
- **WHEN** 会话历史包含图片或普通文件但当前草稿与目标能力兼容
- **THEN** 历史附件 MUST NOT 阻止切换
- **AND** 后续真实 turn 的 provider 或文件读取权限错误 MUST 通过正常错误流程呈现
### Requirement: Current thread temporary model option
当前会话的来源敏感选择身份未被统一目录表示时，选择器 SHALL 显示只读的“当前会话”临时项。该项 MUST NOT 可编辑、删除或设为设备默认，并在会话成功切换到目录模型后消失。

#### Scenario: Official current model is shadowed by custom entry
- **WHEN** 无绑定 app-server 会话的模型被同名自定义目录项遮蔽
- **THEN** 选择器 MUST 同时显示只读 app-server 当前项和可选择的自定义项
- **AND** MUST NOT 把当前项误标为自定义绑定

### Requirement: Recovery-failed UI remains blocked
`recovery_failed` 会话 SHALL 保留历史和草稿、禁用发送，并提供“恢复原模型”主操作与“重试目标模型”次操作。前者 MUST 使用操作记录旧状态，后者 MUST 使用操作记录原目标快照而不是重新解析已变化目录。

#### Scenario: Recover original model
- **WHEN** 用户在修复部署配置后选择“恢复原模型”且核验成功
- **THEN** 后端 MUST 提交旧绑定或 app-server 选择、清除操作记录并恢复发送

#### Scenario: Retry original target snapshot
- **WHEN** 用户选择“重试目标模型”
- **THEN** 后端 MUST 使用操作记录中的目标快照和当前 provider 重试
- **AND** 再次失败 MUST 保持阻塞且 MUST NOT 提供忽略继续入口
