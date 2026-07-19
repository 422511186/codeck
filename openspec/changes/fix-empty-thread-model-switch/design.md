## Context

Codex app-server 在 `thread/start` 成功后、首个 turn 产生前不会创建可供冷恢复的 rollout。当前模型切换状态机对所有空闲会话执行 `unsubscribe -> thread/resume`：新空会话一旦取消订阅，既失去加载态运行时，也没有 rollout 可恢复，因此目标切换和旧状态恢复都会返回 `no rollout found for thread id ...`。

已有历史会话的冷 resume 只覆盖模型、provider、reasoning 和可选上下文窗口，没有携带当前 `permissions`、`approvalPolicy` 与 `approvalsReviewer`。切换后 app-server 可能采用部署默认权限，而前端仍显示本地选择，造成权限显示、发送 payload 与实际运行时分叉。

前端 timeline 目前将模型前置条件、已恢复失败、权限更新失败和真正运行时错误都转换为 `ErrorEntry`，并使用带“出错了”标题的折叠危险卡片。该结构放大了可恢复问题，也让真实错误出现重复容器。

## Goals / Non-Goals

**Goals:**

- 让尚无 turn 的加载态新会话在不取消订阅的情况下完成模型切换、核验与回滚。
- 保持已有历史会话的冷 resume 状态机，并在所有切换终态保留完整权限选择。
- 让未完成 binding operation 能在进程重启后使用同一权限快照恢复。
- 将可恢复 warning 和真正 error 分成两个紧凑、可访问的 timeline 表达。
- 保持自定义模型容量预检、权威模型目录要求和 `recovery_failed` 阻塞语义。

**Non-Goals:**

- 不改变 thread 创建时机、thread ID 或历史结构。
- 不让 Web 管理 provider、凭据、`config.toml` 或 `model_catalog_json`。
- 不通过 settings update 注入 `model_context_window`；大窗口模型仍由 app-server 权威目录定义。
- 不改变运行中 turn 拒绝切模、目录并发检查和绑定版本检查。

## Decisions

### 1. 以权威 turn 状态选择切换路径

切换服务在持有 thread 锁并完成前置检查后读取权威 thread detail。只有 `lastTurnId` 为空且权威 turn manifest 为空时，才把会话判定为未物化空会话。不能仅依赖前端 timeline 为空，因为分页、过滤或事件延迟都可能产生假空状态。

未物化空会话使用原地路径：先持久化 binding operation，再调用 `thread/settings/update` 更新目标 model 与 reasoning，不执行 unsubscribe；随后对仍加载的 thread 调用不带运行时覆盖的 resume，并复用统一核验器确认 model、provider 与 reasoning。核验成功后才提交目标 binding 并清除 operation。

若目标更新或核验失败，使用相同原地路径恢复旧 model/reasoning。旧状态核验成功返回稳定的 `502 recovered`；目标与旧状态都无法核验时保留 operation 并返回 `500 recovery_failed`。已有 turn 的会话继续使用冷 resume，因为历史会话拥有 rollout，且该路径能够应用自定义上下文覆盖。

备选方案是首次切模前发送隐藏 turn 以物化 rollout，或删除后重建 thread。前者污染历史并产生模型调用，后者改变 thread ID，均不采用。

### 2. 权限选择作为 operation 的可选快照

切换开始前从权威 thread detail 读取完整权限选择：`permissions`、`approvalPolicy`、`approvalsReviewer`。binding operation 增加可选 `permissionSelection` 字段；新记录必须包含完整合法三元组，旧记录无该字段时保持可读，并沿用部署默认恢复行为。

冷 resume 的运行时覆盖类型和 `thread/resume` 参数扩展为携带该三元组。目标切换、旧状态回滚、显式恢复和重启恢复都复用 operation 中同一快照。空会话原地 settings update 只修改模型与 reasoning，不清除已加载运行时的权限；首次发送仍携带前端当前完整权限选择，作为 turn 级最终一致性保障。

备选方案是在切模后再单独调用权限 settings update。该方案存在模型已切换但权限更新失败的中间状态，且崩溃恢复缺少原始权限事实，因此不采用。

### 3. 运行时核验与 binding 提交保持同一成功边界

空会话和历史会话共享模型身份核验规则。只有 app-server 返回的 model、provider 和 reasoning 满足目标快照时才提交 binding；失败恢复也只有在旧状态核验成功后才能清除 operation。这样 binding 文件不会把未确认的浏览器意图误写成运行时事实。

`thread/settings/update` 不支持 `model_context_window`。上下文窗口超过 Codex 未知模型上限的自定义模型仍必须先加入 app-server 权威模型目录；小窗口未知模型继续使用 app-server fallback，并由 token usage 暴露实际窗口偏差。

### 4. timeline 使用 warning 与 error 两级提示

扩展 system timeline entry，增加 `systemKind: "warning"`。模型目录或容量前置条件、目标失败但旧状态已恢复、权限设置失败且本地状态已回退等不阻塞历史与后续发送的问题，使用紧凑黄色 warning，不使用折叠、卡片标题或嵌套代码框。

真正失败仍使用 error entry，但 `ErrorCard` 改为紧凑红色内联 `role="alert"`，标题为“操作失败”，移除 `BaseCard` 折叠容器、嵌套红色 `<pre>` 和“出错了”文案。`recovery_failed` 继续由阻塞恢复界面提供主操作，timeline error 只保留简短摘要。

## Risks / Trade-offs

- [Risk] app-server 对未物化 thread 的 detail 字段在版本升级后变化 → 使用 `lastTurnId` 与权威 manifest 双条件，并为误分类补充冷/热路径测试。
- [Risk] settings update 成功但后续 resume 核验失败 → 立即走同路径恢复旧状态；双重失败保留 operation 并阻塞发送。
- [Risk] 旧 operation 无权限快照时无法还原原权限 → 保持向后兼容并使用部署默认；所有新 operation 强制保存完整合法快照。
- [Risk] 并行活跃变更也修改权限类型 → 实现复用当前工作树中的完整权限类型，不回退或覆盖其他变更；验证覆盖类型检查与相关测试。
- [Trade-off] 空会话原地路径不能传自定义上下文覆盖 → 大窗口模型继续要求权威目录，小窗口未知模型接受 app-server fallback，并显式展示实际偏差。

## Migration Plan

1. 先扩展可选 operation schema 和 resume 权限覆盖，保持旧文件兼容。
2. 增加空会话路径与测试，保留历史会话冷路径。
3. 增加 warning entry 与紧凑 error 渲染，并迁移模型和权限操作提示。
4. 执行定向测试、完整验证、严格 OpenSpec 校验和 390px 手机视口验证。
5. 回滚时可恢复旧代码；新增 operation 字段为可选，不要求数据迁移。若回滚时存在未完成 operation，旧读取器会因额外字段失败关闭，因此部署回滚前必须先确认无进行中模型切换。

## Open Questions

无。空会话判定、权限快照、恢复终态和提示层级均已确认。
