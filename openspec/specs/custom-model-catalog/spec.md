# custom-model-catalog Specification

## Purpose
TBD - created by archiving change add-custom-model-catalog. Update Purpose after archive.
## Requirements
### Requirement: Provider-independent custom model definition
系统 SHALL 使用 provider 无关的 `CustomModelConfig` 表示自定义模型。配置 MUST 包含后端生成且不可变的 `customModelId`、`model`、`label`、`contextWindow`、`inputModalities`、`supportedReasoningEfforts`、`defaultReasoningEffort`、`createdAt` 和 `updatedAt`，并且 MUST NOT 包含 provider、base URL、API key、环境变量值或其他凭据。

#### Scenario: Create with conservative defaults
- **WHEN** 用户开始创建自定义模型
- **THEN** 表单 MUST 默认使用 `contextWindow: 200000`、`inputModalities: ["text"]`、`supportedReasoningEfforts: []` 和 `defaultReasoningEffort: null`
- **AND** 图片与 reasoning 能力 MUST 仅在用户显式声明后启用

#### Scenario: Mutable model fields preserve identity
- **WHEN** 用户完整替换已有自定义模型的 `model`、`label`、上下文窗口或能力字段
- **THEN** 后端 MUST 保留原 `customModelId` 和 `createdAt`
- **AND** MUST 更新 `updatedAt`

#### Scenario: Provider fields are rejected
- **WHEN** 创建或替换请求包含 provider、接口地址或凭据字段
- **THEN** 后端 MUST 返回字段校验错误
- **AND** MUST NOT 把这些值写入任何自定义模型持久化文件或审计日志

### Requirement: Custom model validation boundaries
后端 SHALL 对自定义模型执行完整校验。`model` MUST 在去除首尾空白后为 `1..256` 字符且不含控制字符；`label` MUST 在去除首尾空白后为 `1..100` 字符；`contextWindow` MUST 是 `1..1000000` 的安全整数；输入模态 MUST 包含唯一的 `text` 并且只能额外包含 `image`；reasoning 档位 MUST 最多 16 个，每个去除首尾空白后为 `1..64` 字符、不含控制字符、区分大小写且互不重复。

#### Scenario: Reasoning default belongs to declared values
- **WHEN** `supportedReasoningEfforts` 非空
- **THEN** `defaultReasoningEffort` MUST 是其中一个区分大小写的精确值
- **AND** 空 reasoning 列表 MUST 要求 `defaultReasoningEffort` 为 `null`

#### Scenario: Duplicate model identifier is rejected
- **WHEN** 创建或替换后的 `model` 与另一个自定义模型的标识按区分大小写的精确值相同
- **THEN** 后端 MUST 返回稳定的冲突错误
- **AND** 目录 MUST 保持不变

#### Scenario: Catalog limit blocks only create
- **WHEN** 目录已经包含 200 个自定义模型
- **THEN** 后端 MUST 拒绝继续创建
- **AND** MUST 继续允许完整替换和删除已有模型

### Requirement: Versioned shared catalog persistence
自定义模型目录 SHALL 是 codeck 部署级全局资源，连接同一实例的所有已认证设备 MUST 共享读写。后端 MUST 将 `{schemaVersion, revision, models}` 保存到专用可配置数据目录中的独立 JSON 文件，并使用进程锁、锁内重读、临时文件和原子替换完成写入。

#### Scenario: Successful catalog mutation is atomic
- **WHEN** 校验和修订号检查通过
- **THEN** 后端 MUST 原子写入完整新目录
- **AND** MUST 仅在替换成功后递增 `revision` 并返回成功

#### Scenario: Corrupted catalog fails closed
- **WHEN** 目录文件存在但 JSON、schema 或字段校验失败
- **THEN** 所有目录读取和写入 MUST 返回明确的存储错误
- **AND** 系统 MUST NOT 静默重置、覆盖损坏文件或返回空目录

#### Scenario: Catalog is not Codex configuration
- **WHEN** 用户修改自定义模型目录
- **THEN** 系统 MUST NOT 修改 `config.toml`、`model_catalog_json`、当前 provider 或任何凭据来源

### Requirement: Revision-guarded custom model CRUD
系统 SHALL 提供读取、创建、完整替换和删除自定义模型的已认证 API。创建、替换和删除 MUST 携带调用方最后读取的 `expectedRevision`；成功响应 MUST 返回最新完整 `{revision, models}`。

#### Scenario: Read custom model catalog
- **WHEN** 已认证用户 GET `/api/codex/custom-models`
- **THEN** 后端 MUST 返回当前 `revision` 和完整自定义模型目录

#### Scenario: Create custom model
- **WHEN** 已认证用户 POST `/api/codex/custom-models` 并提供有效完整模型和匹配的 `expectedRevision`
- **THEN** 后端 MUST 生成 `customModelId`、创建目录项并返回新修订号与完整目录

#### Scenario: Fully replace custom model
- **WHEN** 已认证用户 PUT `/api/codex/custom-models/{customModelId}` 并提供全部可修改字段和匹配的 `expectedRevision`
- **THEN** 后端 MUST 对完整目标状态执行交叉字段校验
- **AND** MUST NOT 使用缺失字段继承旧值的 PATCH 语义

#### Scenario: Delete custom model
- **WHEN** 已认证用户 DELETE `/api/codex/custom-models/{customModelId}` 并提供匹配的 `expectedRevision`
- **THEN** 后端 MUST 仅从目录删除该模型并返回最新完整目录
- **AND** MUST NOT 修改已有会话历史或会话模型绑定

#### Scenario: Stale revision returns latest catalog
- **WHEN** `expectedRevision` 与锁内重读的当前修订号不同
- **THEN** 后端 MUST 返回 HTTP 409、稳定错误码和服务端最新完整目录
- **AND** 前端 MUST 保留未提交表单且 MUST NOT 自动合并或重试

### Requirement: Unified selectable model catalog
`GET /api/codex/models` SHALL 由后端生成 app-server 模型与自定义模型的统一可选目录。每个条目 MUST 返回 `source`、`model`、可选 `customModelId`、显示名称、输入模态、reasoning 档位和默认档位；响应 MUST 同时返回自定义目录 `catalogRevision`。

#### Scenario: Custom metadata wins exact model collision
- **WHEN** app-server 与自定义目录存在区分大小写后完全相同的 `model`
- **THEN** 统一目录 MUST 只返回一个可选条目
- **AND** 该条目 MUST 使用自定义来源、`customModelId` 和自定义能力元数据
- **AND** app-server 原始模型目录 MUST 保持不变

#### Scenario: Catalog order and search
- **WHEN** 手机模型选择器打开
- **THEN** 自定义模型组 MUST 显示在 Codex 模型组之前
- **AND** 用户 MUST 能按 `label` 或 `model` 搜索
- **AND** 选择器 MUST 提供进入自定义模型管理页的管理图标

#### Scenario: Picker always refreshes
- **WHEN** 用户每次打开默认模型或会话模型选择器
- **THEN** 前端 MUST 重新调用 `GET /api/codex/models`
- **AND** MUST NOT 依赖长期缓存的目录副本

### Requirement: Source-sensitive model selection identity
模型选择 SHALL 使用结构化来源身份：自定义模型由 `source: "custom"` 与 `customModelId` 标识，app-server 模型由 `source: "app-server"` 与 `model` 标识。相同模型字符串的不同来源 MUST NOT 自动互换。

#### Scenario: Existing app-server thread is not auto-bound
- **WHEN** 无自定义绑定的已有会话模型与新建自定义模型同名
- **THEN** 会话 MUST 继续保持 app-server 来源
- **AND** 用户显式选择自定义条目之前 MUST NOT 创建自定义绑定

#### Scenario: Deleted custom default does not target official alias
- **WHEN** 设备默认引用的 `customModelId` 已被删除且 app-server 存在同名模型
- **THEN** 前端 MUST 清除失效默认并回退到服务端默认模型
- **AND** MUST NOT 静默改为同名 app-server 模型

### Requirement: Device-local default model resolution
设备默认模型 SHALL 以结构化选择身份保存在浏览器 localStorage。创建新会话时，后端 MUST 根据最新统一目录实时解析该身份；自定义默认 MUST 通过 `customModelId` 解析最新配置，而不是保存配置副本。

#### Scenario: New thread uses live custom default
- **WHEN** 设备默认指向仍存在的自定义模型
- **THEN** thread start MUST 使用该 `customModelId` 当前的模型标识、上下文窗口、能力默认值和 Codex 当前 provider

#### Scenario: Invalid default falls back safely
- **WHEN** 默认选择身份无法解析
- **THEN** 前端 MUST 清除该本地默认
- **AND** 新会话 MUST 使用 app-server 服务端默认模型

### Requirement: Mobile custom model management
设置页 SHALL 提供独立的自定义模型管理入口和手机页面。管理页 MUST 使用列表展示目录，支持创建、完整编辑和带确认的删除；会话模型选择器 SHALL 只负责选择与重新应用，不能在选择器内嵌编辑表单。

#### Scenario: Manage custom models from settings
- **WHEN** 用户从设置页进入自定义模型管理
- **THEN** 页面 MUST 显示模型 `label`、`model`、标称上下文窗口和能力摘要
- **AND** MUST 提供新增、编辑和删除入口

#### Scenario: Delete requires confirmation
- **WHEN** 用户请求删除自定义模型
- **THEN** UI MUST 显示模型身份和删除影响确认
- **AND** 确认文案 MUST 说明已有会话绑定不会被删除

### Requirement: Large custom context window prerequisite
自定义模型 `contextWindow` SHALL 表示传给 app-server 的标称完整窗口。大于 `272000` 的配置可以保存，但创建或重配会话前 MUST 要求该模型标识精确存在于 app-server 权威模型目录；Web MUST NOT 生成、修改或热重载 `model_catalog_json`。

#### Scenario: Unknown large-window model is blocked
- **WHEN** 自定义模型窗口大于 `272000` 且 app-server `model/list` 不包含精确模型标识
- **THEN** thread start 或模型切换 MUST 在运行时变更前拒绝
- **AND** MUST 返回提示部署侧配置 Codex 权威模型目录的稳定错误

#### Scenario: Runtime window differs from configured window
- **WHEN** token usage 返回的 `modelContextWindow` 与当前自定义绑定的标称窗口不同
- **THEN** 当前会话 MUST 同时显示配置值与实际值的偏差
- **AND** 容量进度与后续当前会话安全判断 MUST 使用实际值
- **AND** 系统 MUST NOT 自动回写目录或递增目录修订号
