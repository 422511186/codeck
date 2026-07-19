## Why

新建会话在首个 turn 前没有可供冷恢复的 app-server rollout，现有模型切换流程取消订阅后再 resume 会导致目标切换与旧状态恢复同时失败，并可能让已选择的权限在运行时重建后回退。与此同时，前端把可恢复警告和真正错误统一渲染成“出错了”折叠卡片，无法准确表达故障严重度。

## What Changes

- 为尚未产生 turn 的加载态空会话增加原地模型切换分支，不取消订阅，并在 app-server 确认目标运行时后才提交模型绑定。
- 保留已有历史会话的冷 resume 切换流程，并让目标切换、旧状态回滚和进程中断恢复携带同一完整权限选择。
- 为模型绑定操作记录增加向后兼容的权限快照，使崩溃恢复不会丢失 permission profile、approval policy 或 reviewer。
- 将模型前置条件、已恢复切换失败和权限更新失败呈现为紧凑 warning；将真正失败呈现为紧凑“操作失败”提示，移除“出错了”折叠危险卡片。
- 保持大于 Codex 未知模型上限的自定义模型必须进入 app-server 权威模型目录的约束，并保持 `recovery_failed` 的发送阻塞与显式恢复流程。

## Capabilities

### New Capabilities

- `empty-thread-runtime-reconfiguration`: 首轮前空会话的识别、原地模型更新、运行时核验、回滚与稳定终态。

### Modified Capabilities

- `permission-mode-controls`: 模型运行时切换、回滚和崩溃恢复必须保持完整权限选择。
- `timeline-event-stream`: 操作级 warning 与真正 error 使用不同的紧凑时间线提示语义和视觉层级。

## Impact

- 影响 `src/server/custom-models` 的切换状态机和绑定操作持久化，以及 `src/server/app-server` 的 settings update、resume 覆盖与运行时核验。
- 影响共享模型绑定与权限类型、thread 模型切换 API 返回处理、前端 timeline entry 类型及 warning/error 组件。
- 不修改 provider、凭据、`config.toml` 或 `model_catalog_json`；大窗口自定义模型仍由 app-server 权威目录提供实际上下文窗口。
- 需要新增切换服务、绑定存储、app-server resume、会话页错误分层及组件渲染测试，并执行严格 OpenSpec 校验、完整项目验证和手机视口验证。
