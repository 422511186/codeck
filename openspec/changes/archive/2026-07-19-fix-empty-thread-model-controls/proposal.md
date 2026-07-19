## Why

新建会话在首条消息前没有 rollout，但当前模型切换仍先尝试恢复 rollout，导致 `no rollout found` 并阻断正常操作。同时，空会话的页面状态没有携带模型能力目录，错误地把默认 `Xhigh` 当成唯一推理强度；刷新后 Codex 的持久化系统提醒也会被误判为“操作失败”。

## What Changes

- 为尚未物化的空会话提供不依赖 rollout 的原地模型切换路径，保持会话 ID、权限选择和首次发送能力。
- 为空会话补齐统一模型目录中的模型标签、推理强度列表、默认强度和输入模态；当前强度只作为选中值，不再覆盖能力列表。
- 保持历史会话继续使用冷恢复和运行时核验，避免降低模型切换的服务端一致性保护。
- 将 Codex 持久化的 `Heads up` 长会话提醒恢复为 warning notice，不渲染为“操作失败”；真实 turn error 继续保留错误语义。
- 为上述路径补充服务端、API、状态恢复和页面选择器回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `empty-thread-runtime-reconfiguration`: 未物化空会话可在无 rollout 时原地切换模型并核验状态。
- `thread-model-switching`: 模型切换必须区分空会话与历史会话，并保持完整模型能力与权限状态。
- `chat-input-area`: 推理强度选择器必须显示当前模型目录声明的全部支持选项。
- `timeline-event-stream`: 持久化的 Codex 系统提醒恢复为 warning，不能降级为 turn error。

## Impact

- 影响 `src/server/custom-models/switch-service.ts`、`src/server/custom-models/lifecycle-service.ts` 和 `src/server/app-server/runtime.ts` 的空会话状态读取与模型切换路径。
- 影响 `src/app/threads/[threadId]/page.tsx`、模型目录读取及推理强度选择器的状态组装。
- 影响 `src/web/state/timeline-adapter.ts` 的历史 warning 识别。
- 不改变模型 provider、凭据、部署配置或历史 rollout 内容；只修复状态恢复和展示语义。
