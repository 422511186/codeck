# empty-thread-runtime-reconfiguration Specification

## Purpose
TBD - created by archiving change fix-empty-thread-model-switch. Update Purpose after archive.
## Requirements
### Requirement: Authoritative empty thread classification
系统 SHALL 仅根据后端权威 thread 状态判断会话是否尚未物化。只有 `lastTurnId` 为空且权威 turn manifest 为空的加载态会话 MUST 进入空会话运行时重配置路径；前端 timeline 为空 MUST NOT 单独作为判定依据。

#### Scenario: Newly started thread is classified as unmaterialized
- **WHEN** 模型切换服务读取到 thread 的 `lastTurnId` 为 `null` 且权威 turn manifest 为空
- **THEN** 系统 MUST 将该 thread 视为尚未物化的加载态空会话
- **AND** 系统 MUST NOT 为该切换执行 unsubscribe

#### Scenario: Historical thread with an empty visible page uses cold reload
- **WHEN** 前端当前可见 timeline 为空但权威 thread 存在 `lastTurnId` 或 turn manifest 条目
- **THEN** 系统 MUST 将该 thread 视为已有历史
- **AND** 系统 MUST 继续使用可恢复历史的冷 resume 切换路径

### Requirement: In-place model switch for unmaterialized thread
未物化空会话 SHALL 在保持加载和订阅的情况下原地更新目标模型。系统 MUST 在写入 binding operation 后通过 app-server settings update 修改 model 与 reasoning，随后对仍加载的 thread 执行无覆盖 resume 并核验 model、provider 与 reasoning；核验成功前 MUST NOT 提交目标 binding。

#### Scenario: Empty thread switch succeeds without rollout
- **WHEN** 用户对空闲的未物化 thread 选择合法目标模型
- **THEN** 系统 MUST 原地更新 model 与 reasoning并保持 thread 加载
- **AND** 系统 MUST 不调用 unsubscribe 或依赖 rollout 的冷 reload
- **AND** app-server 核验成功后系统 MUST 提交目标 binding 并清除 operation

#### Scenario: Large custom model relies on authoritative catalog
- **WHEN** 自定义目标的上下文窗口超过 Codex 未知模型上限
- **THEN** 切换前置检查 MUST 要求该模型存在于 app-server 权威模型目录
- **AND** 空会话原地更新 MUST NOT 伪造或通过不支持的 settings 字段传递 `model_context_window`

### Requirement: Deterministic in-place recovery
空会话目标设置或核验失败后，系统 SHALL 使用相同原地路径恢复旧 model 与 reasoning。旧状态核验成功 MUST 返回 `502 recovered` 并保持旧 binding；目标与旧状态都无法核验时 MUST 返回 `500 recovery_failed`、保留 operation 并阻止发送。

#### Scenario: Target fails and old model recovers in place
- **WHEN** 空会话目标模型设置或运行时核验失败
- **AND** 旧 model、provider 与 reasoning 原地恢复并核验成功
- **THEN** API MUST 返回 `outcome: "recovered"` 和 HTTP 502
- **AND** 系统 MUST 保持旧 binding 且清除已完成的 operation

#### Scenario: Target and old model both fail
- **WHEN** 空会话目标状态与旧状态都无法原地恢复并核验
- **THEN** API MUST 返回 `outcome: "recovery_failed"` 和 HTTP 500
- **AND** 系统 MUST 保留 binding operation 并禁止启动新 turn
