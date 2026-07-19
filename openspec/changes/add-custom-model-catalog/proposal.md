## Why

当前移动端只能选择 app-server `model/list` 返回的模型，无法维护并选择 `mimo-v2.5-pro` 等非官方模型，也无法让已有会话在保留 thread ID 与历史的同时可靠切换到这类模型。需要在不把 provider、接口地址和凭据交给前端管理的前提下，引入可持久化的自定义模型目录与可恢复的会话模型切换能力。

## What Changes

- 新增部署级共享的自定义模型目录，支持在手机设置页创建、查看、完整替换和删除模型定义；模型定义包含显示名称、标识、标称上下文窗口、输入模态与开放 reasoning 档位，不包含 provider 或凭据。
- 扩展 `GET /api/codex/models` 为 app-server 模型与自定义模型的统一可选目录，并提供来源敏感的模型选择身份；同名时自定义定义优先，但不会把已有 app-server 会话或设备默认静默改绑。
- 新增带目录修订号的乐观并发 CRUD、独立版本化 JSON 持久化、原子写入、损坏失败关闭、目录数量与字段边界，以及部署级已认证共享读写语义。
- 将新会话默认模型改为浏览器本地保存的结构化选择身份；自定义默认通过不可变 `customModelId` 在创建时由后端实时解析，失效后清除并回退到服务端默认模型。
- 新增统一的会话模型切换命令：仅在空闲时保留 thread ID 与完整历史，使用当前 Codex provider 通过 unsubscribe 与冷 resume 重建运行时；官方和自定义模型遵循同一切换语义。
- 为自定义模型会话持久化模型绑定快照和进行中操作记录，覆盖恢复、fork、删除、reasoning 更新、显式重新应用、并发冲突、进程中断以及切换失败后的恢复。
- 自定义模型上下文窗口默认 `200000`、可配置到 `1000000`；超过 Codex 未知模型 fallback 的 `272000` 时要求模型存在于 app-server 权威目录，并在运行时实际窗口与配置值不同时明确展示偏差。
- 模型选择器按自定义与 Codex 分组，提供搜索、管理入口、临时当前会话项、配置更新提示和重新应用操作；输入模态不匹配时保留草稿与附件并阻止发送。
- 为目录变更、模型切换、绑定更新与恢复过程补充不含凭据的审计记录和稳定错误终态。

## Capabilities

### New Capabilities

- `custom-model-catalog`: 自定义模型定义、后端目录持久化、统一可选目录、来源敏感选择身份、设备默认解析和移动端管理界面。
- `thread-model-switching`: 旧会话统一模型切换、上下文容量预检、会话模型绑定、显式重新应用、崩溃恢复、输入兼容与确定失败终态。

### Modified Capabilities

- `settings-minimal`: 设置页增加自定义模型管理入口，并将默认模型持久化与解析改为来源敏感的结构化身份。
- `thread-lifecycle`: thread start/resume/fork/delete 与 settings 更新需要维护自定义模型绑定；模型变更不再使用普通 settings update。
- `audit-and-security`: 审计操作目录增加自定义模型、模型切换、绑定和恢复事件，并约束持久化文件与日志不得包含 provider 凭据。

## Impact

- 影响 `src/app/api/codex/models`、新增自定义模型 CRUD 与 thread 模型切换 API，以及 `src/server/app-server` 的 start/resume/unsubscribe/settings 协调。
- 影响共享模型、thread detail、错误终态和绑定类型，前端 API client、状态管理、设置页、会话 composer 模型选择器与发送校验。
- 新增可配置的 Codex Web 数据目录、`custom-models.json` 和 `thread-model-bindings.json`，Docker 部署需要挂载该目录；不修改 `config.toml`、`model_catalog_json` 或 provider 凭据。
- 需要覆盖目录校验与并发、原子持久化、同名来源身份、start/resume/fork/delete、切换与失败恢复、上下文窗口、草稿附件兼容及手机视口交互的单元和集成测试。
