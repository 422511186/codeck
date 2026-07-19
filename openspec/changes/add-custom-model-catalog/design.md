## Context

当前 `GET /api/codex/models` 直接转发 app-server `model/list` 的精简结果，前端模型选择只发送模型字符串；会话中的模型变化通过 `thread/settings/update` 完成。该路径无法向未知模型补充上下文窗口，也不能更新 provider。Codex `thread/start` 和空闲 thread 的冷 `thread/resume` 支持 `model`、`modelProvider` 与通用 `config` 覆盖，因此可以运行非官方模型；但 loaded thread 的 resume 覆盖可能被忽略，必须先取消订阅、确保空闲并核验返回结果。

Codex 当前对未知模型使用 fallback 元数据。`model_context_window` 会被 fallback 的 `max_context_window = 272000` 截断，实际 turn 窗口还会应用 `effective_context_window_percent = 95`。`model/list` 不暴露上下文窗口，`model_catalog_json` 又是 app-server 启动时加载的完整权威目录而非增量列表，因此 Web 不能可靠热维护它。

Web 登录仅表示是否持有部署共享 access token，没有稳定用户 ID。自定义模型目录因此属于整个 Codex Web 实例，而非某个用户。provider、base URL 和凭据仍由 Codex 部署配置管理；自定义模型定义只描述模型和 Web 需要的能力元数据。

现有项目使用 Next API routes、共享 TypeScript 类型、`src/server/app-server` gateway、localStorage 设备偏好和 JSONL 审计。该变更跨越后端持久化、app-server 生命周期、thread API、前端状态与移动端设置界面，需要明确的数据与恢复边界。

## Goals / Non-Goals

**Goals:**

- 允许已认证用户在手机端维护最多 200 个 provider 无关的自定义模型，并跨连接同一后端的设备共享。
- 将 app-server 与自定义模型合并为来源敏感的统一选择目录，保持同名来源的身份边界。
- 让新会话和已有会话可靠使用自定义模型，保留 thread ID、历史、草稿和附件。
- 为自定义模型恢复所需的上下文窗口、能力和 reasoning 保存会话快照，并在进程中断后确定恢复。
- 对目录并发、会话并发、存储损坏、容量不足、provider 变化和 app-server 失败提供明确结果。
- 保持移动端工作流紧凑，模型选择与模型管理分离。

**Non-Goals:**

- 不在前端创建、编辑或保存 provider、base URL、wire API、API key 或环境变量值。
- 不生成、合并、修改或热重载 Codex `model_catalog_json`。
- 不通过探测请求预验证模型与 provider 的真实兼容性。
- 不自动压缩会话，不根据历史图片阻止切换，不因调用失败删除模型定义。
- 不提供目录导入导出、定价、service tier、描述、拖拽排序或用户级权限隔离。
- 不修改 app-server 持久化 rollout 格式，也不为无绑定旧会话猜测自定义来源。

## Decisions

### 1. 模型定义与选择身份分离

共享类型新增以下核心结构：

```ts
type CustomModelConfig = {
  customModelId: string;
  model: string;
  label: string;
  contextWindow: number;
  inputModalities: ("text" | "image")[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
  createdAt: string;
  updatedAt: string;
};

type ModelSelection =
  | { source: "custom"; customModelId: string }
  | { source: "app-server"; model: string };
```

`customModelId` 由后端生成且不可变；所有用户字段都可通过完整替换修改。`model` 只在自定义目录内按区分大小写精确唯一。选择身份包含来源，因此 app-server 与自定义模型即使字符串相同也不是同一选择。

没有使用 `{provider, model}` 复合身份，因为模型定义必须跨当前 provider 名称变化长期存在。也没有只使用模型字符串，因为同名覆盖会导致旧会话和设备默认被静默改绑。

### 2. 自定义目录和会话绑定使用独立文件

运行时配置新增 `CODEX_WEB_DATA_DIR`，默认解析为当前工作目录下的 `data/`。目录包含：

```text
data/
├── custom-models.json
└── thread-model-bindings.json
```

`custom-models.json`：

```ts
type CustomModelCatalogFile = {
  schemaVersion: 1;
  revision: number;
  models: CustomModelConfig[];
};
```

`thread-model-bindings.json`：

```ts
type ThreadModelBinding = {
  bindingVersion: string;
  customModelId: string;
  model: string;
  label: string;
  contextWindow: number;
  inputModalities: ("text" | "image")[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
  reasoningEffort: string | null;
  sourceUpdatedAt: string;
  boundAt: string;
};

type BindingOperation = {
  operationId: string;
  kind: "switch" | "reapply" | "reasoning" | "recover";
  oldState: RuntimeModelSnapshot;
  targetState: RuntimeModelSnapshot;
  startedAt: string;
};

type ThreadModelBindingFile = {
  schemaVersion: 1;
  revision: number;
  bindings: Record<string, ThreadModelBinding>;
  operations: Record<string, BindingOperation>;
};
```

两个文件分别维护内部 revision。目录 revision 对浏览器公开，用于 CRUD 乐观并发；绑定 revision 只用于服务端原子写入。每次写入都在跨进程文件锁内重读、校验、写临时文件、fsync/close 并 rename。实现优先使用成熟的跨平台文件锁库；若最终不增加依赖，等价实现必须覆盖独占获取、超时和过期锁恢复测试，不能退化成仅进程内 mutex。

目录与绑定分离，避免每次切换、resume 或 reasoning 更新扰动用户可见目录 revision。损坏文件失败关闭并保留原文件；系统不自动重建为空状态。

### 3. 后端持有目录合并与解析权

app-server adapter 保留协议中的真实 `model` 字段，不再只暴露 picker `id`。`GET /api/codex/models` 在后端按区分大小写的 `model` 合并：

```text
app-server model/list ─┐
                      ├─ exact model merge ─> SelectableModel[]
custom-models.json ───┘
```

冲突时输出一个 `source: "custom"` 条目，自定义 label、窗口、模态和 reasoning 元数据完整胜出，但不修改 app-server 目录。响应包含 `catalogRevision`。前端只负责分组、搜索和渲染，不自行合并两个请求。

自定义 CRUD 使用：

- `GET /api/codex/custom-models`
- `POST /api/codex/custom-models`
- `PUT /api/codex/custom-models/{customModelId}`
- `DELETE /api/codex/custom-models/{customModelId}`

所有 mutation body 携带 `expectedRevision`。成功与 revision 409 均返回服务端最新完整目录；前端保留冲突表单，不自动合并。PUT 是完整替换，便于一次验证 reasoning 列表与默认值等交叉约束。

### 4. 默认模型是设备本地引用，创建时后端实时解析

localStorage 从旧模型字符串迁移为带 schema version 的 `ModelSelection`。旧字符串只在当前 app-server 目录存在精确模型时迁移为 app-server 身份；否则清除。即使同名自定义条目存在，也不把旧字符串迁移为自定义身份。

创建会话时浏览器提交结构化选择和已读取的 `catalogRevision`。后端重新解析最新目录：自定义身份解析当前 `customModelId` 定义，app-server 身份解析当前 app-server 条目。失效自定义身份返回可识别错误，前端清除本地引用并以服务端默认模型重新创建；不执行“先创建默认会话再切换”的双步骤流程。

### 5. 大窗口只在 Codex 已认识模型时执行

`contextWindow` 默认 200000，可配置 1 到 1000000。窗口不超过 272000 时允许未知模型走 Codex fallback。超过 272000 时，后端在 start/switch 前要求 app-server 原始 `model/list` 存在精确模型标识；否则返回 `MODEL_CATALOG_ENTRY_REQUIRED`，不启动运行时变更。

该检查只能排除未知 fallback，不能证明部署目录的真实 max 等于配置值。首次 token usage 到达后，当前会话同时保留标称值和 `modelContextWindow` 实际值；不一致时显示“实际 X / 配置 Y”、记录清理后的审计摘要，并使用实际值计算进度。provider 改变并重建运行时后旧观察失效。

没有选择让 Web 管理完整 `model_catalog_json`，因为它是全局、启动时加载且会替换权威目录，动态 CRUD 将要求重启 app-server并同步全部官方模型，在 external 模式也没有可靠控制权。

### 6. 所有模型切换走一个后端状态机

新增 `POST /api/codex/threads/{threadId}/model/switch`。请求包含目标 `ModelSelection`、`expectedCatalogRevision` 和 `expectedCurrent`（当前来源身份、reasoning、`bindingVersion`）。后端在 thread 级锁内执行：

```text
校验认证与输入
  -> 重读目录/绑定/运行时
  -> 校验 expectedCurrent 与 catalog revision
  -> 确认 thread idle
  -> 容量预检
  -> 写 BindingOperation
  -> unsubscribe
  -> cold resume(target model + current provider + target config)
  -> 核验 returned model/provider
  -> 提交目标 binding 或清除 binding
  -> 清除 operation
  -> 返回 switched
```

app-server 与自定义目标都使用该命令。自定义目标传 `config.model_context_window`；app-server 目标不传该字段，以免残留旧自定义覆盖。目标 reasoning 优先沿用当前受支持值，否则使用目标显式默认，目标无 reasoning 时为 null。

普通 `/threads/{threadId}/settings` 不再接受 `model`。它继续处理 permissions 与 reasoning；自定义绑定 reasoning 只有在 app-server ack 后才写入，并生成新 `bindingVersion`。

### 7. 切换只在空闲、容量可接受且状态未过期时开始

运行中 turn 返回 409，不中断、不排队。请求前置状态任一不符也返回 409，并且必须发生在 unsubscribe 和 operation 写入之前。前端刷新目录与 thread detail、保留草稿，不自动重试。

容量预检使用最近一次已知当前上下文用量与目标标称窗口。用量达到目标 90% 时返回 `CONTEXT_COMPACTION_REQUIRED`，要求用户使用现有手动 compact；未知用量不阻止。系统不自动 compact。对大窗口模型，start/switch 还先执行权威目录存在性检查。

### 8. 绑定是选择时快照，不是目录实时引用

自定义 start 或 switch 核验成功后写绑定；切换 app-server 成功后删除绑定。目录编辑或删除不改变绑定。绑定的 `sourceUpdatedAt` 与目录 `updatedAt` 不同时，选择器显示“配置有更新”；用户点击“重新应用”才执行完整切换并生成新 bindingVersion。

resume 自定义绑定时必须恢复快照模型、窗口和实际 reasoning，同时重新读取当前 provider。fork 在获得新 thread ID 后复制快照并生成独立 bindingVersion；archive/unarchive 保留；Web delete 成功后清理 binding 与 operation。无绑定旧会话始终按 app-server 来源解释。

当前来源身份不在统一目录时，thread detail 合成只读临时项。无绑定 app-server 会话被同名自定义条目遮蔽时，也显示独立“当前会话 · Codex”项，允许用户显式选择同名自定义项。

### 9. 操作记录提供进程中断后的确定恢复

app-server 运行时和 JSON 文件无法参加同一事务，因此在运行时变更前先写 BindingOperation，完成后原子提交绑定并清除。API 只有清除 operation 后才返回成功。

下次访问检测到 operation 时，在 thread 锁内阻止 turn 并继续恢复。正常目标失败时立即尝试旧状态。HTTP 结果固定为：

| HTTP | outcome | 语义 |
|---|---|---|
| 200 | `switched` | 目标与绑定已核验提交 |
| 409 | 无终态 | 未开始，前置条件、忙碌或容量冲突 |
| 502 | `recovered` | 目标失败，旧状态已恢复 |
| 500 | `recovery_failed` | 目标与旧状态都无法可靠恢复 |

`recovery_failed` 保留历史与草稿并禁用发送。恢复 API 提供“恢复原模型”和“重试目标模型”；目标重试使用 operation 中原快照，不重新解析已变化目录。两者都使用当前 provider，成功后提交相应绑定并清除 operation。

thread/start 与 fork 在 app-server 返回新 ID 前无法预写按 threadId 索引的 operation。它们在获得 ID 后先写 binding 再返回浏览器；极端崩溃产生的无绑定 thread 按 app-server 来源处理，不基于同名自动认领。

### 10. 输入兼容只约束待发送草稿

选择器可切换到 text-only 模型，即使草稿已有图片；前端保留图片、文本和 Skill，但发送按钮进入输入不兼容状态。用户移除图片或切回支持 image 的模型后恢复。历史图片不阻止切换，真实 provider 请求失败仍走 turn 错误流程。

能力未声明即不支持：text 必须存在，image 显式启用，reasoning 列表为空表示无 reasoning。开放 reasoning 字符串保持精确协议值，UI 只为常见值提供展示标签。

### 11. 移动端管理与选择分离

设置页增加“自定义模型”入口，进入 `/settings/custom-models`。管理页使用紧凑列表展示 label、model、窗口和能力摘要，提供新增、编辑、删除图标；删除使用确认对话框并说明已有会话绑定不受影响。页面不显示 provider、URL 或凭据。

composer 模型 chip 打开底部选择器。选择器顶部提供搜索和管理图标，正文按“当前会话”“自定义”“Codex”分组；reasoning 选项只在当前选中模型下展示。管理表单保存只更新目录，不自动切换当前会话。

### 12. 审计、错误与可观测性

自定义目录 mutation 记录 customModelId、model 和 revision；切换以 operationId 关联 request/result，记录来源敏感 old/target、reasoning、窗口、当前 provider 标识和 switched/recovered/recovery_failed。绑定更新与恢复也记录 operationId、bindingVersion 和清理后的错误摘要。

任何文件、响应和日志都不保存 API key、authorization header、环境变量值、provider base URL 或完整 provider 配置。API 使用稳定 code 分支，前端不解析错误文本。除审计外增加结构化诊断计数：目录 revision conflict、binding recovery、switch recovery、runtime context mismatch。

## Risks / Trade-offs

- [app-server 目录存在不证明大窗口 max 足够] → 仅把目录存在作为未知 fallback 的阻断条件；首个 token usage 明确展示实际值，安全计算使用实际值。
- [external app-server 上仍有其他订阅者，resume 覆盖被忽略] → 切换后核验 returned model/provider；不一致视为目标失败并恢复，不把 picker 乐观状态当事实。
- [两个 JSON 文件与 app-server 无法原子提交] → 持久化 operation、thread 锁、目标核验和旧状态恢复；未清除 operation 的会话禁止 turn。
- [跨进程文件锁残留或共享存储语义不同] → 使用成熟跨平台锁实现、超时和 stale 策略，并为多实例冲突与异常退出添加集成测试；文档说明共享卷要求。
- [绑定文件随 thread 数增长] → Web delete 立即清理；不做危险的周期猜测删除，外部删除留下的孤儿记录只在 thread 明确不存在时审计清理。
- [配置编辑与当前绑定产生认知差异] → 显示 `sourceUpdatedAt` 差异和“重新应用”，保存编辑不静默改变运行时。
- [provider 改变导致旧模型不再兼容] → 定义和绑定不删除；每次 start/resume 使用当前 provider，失败进入标准恢复和审计。
- [旧前端仍向 settings 发送 model] → route 明确返回客户端错误；前后端需要按迁移顺序部署，不能静默保留旧语义。
- [后端回滚后不认识自定义绑定] → UI 可独立回滚，但后端回滚前必须停止新切换，并先将活跃自定义会话迁回 app-server 模型或保留兼容 binding-aware resume。

## Migration Plan

1. 增加共享类型、数据目录配置、持久化 store 和只读目录 API；首次启动在文件不存在时创建 schemaVersion 1 的空文件，存在损坏文件时失败关闭。
2. 部署 binding-aware 的 thread start/resume/fork/delete、reasoning 更新和 switch/recovery API，保持旧 UI 暂不调用 switch。
3. 扩展统一 models API，并迁移 localStorage 旧默认字符串：仅可解析的 app-server 模型转成结构化 app-server 身份，其他值清除。
4. 部署设置管理页和新模型选择器，停止通过 settings route 修改 model。
5. 更新 Docker volume、`.env.example`、中文部署和测试文档；生产环境将 `CODEX_WEB_DATA_DIR` 挂载到持久卷。
6. 上线后监控 revision conflict、context mismatch、recovered 和 recovery_failed；确认自定义 start、老会话切换、重启恢复和 fork。

回滚前先关闭目录 mutation 与模型切换入口。只回滚前端时可保留新后端和数据文件；回滚 binding-aware 后端前，必须将自定义绑定会话显式切回 app-server 模型，或保留能够读取 schemaVersion 1 binding 的兼容层。数据文件不自动删除，便于重新部署恢复。

## Open Questions

无。关键产品边界、失败语义、上下文限制、provider 所有权与持久化策略均已在探索阶段确认。
