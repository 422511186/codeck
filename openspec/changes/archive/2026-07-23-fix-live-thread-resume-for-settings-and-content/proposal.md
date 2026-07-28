## Why

新进入会话时，thread 可能尚未在 app-server 中 materialize/live。此时直接 `thread/settings/update` 会报 `thread not found`；同一路径下截断正文的 `contentRef` 重读会调用 `thread/items/list`，异常再被 content API 包装成 502。先切换模型之所以能“修好”，是因为模型切换往往会先 `resume` 出 live thread。需要在 gateway 生命周期层统一补齐 bare resume + 一次重试，而不是让用户靠 workaround。

## What Changes

- 在 app-server gateway 为“依赖 live thread”的操作增加统一恢复：检测到 missing/not-found/not-loaded 类错误时，执行一次 **不带权限覆盖** 的 `resumeThread`，再重试原操作一次。
- `updateThreadSettings` 在冷会话上可成功提交权限/模型相关设置，不再要求用户先切模型。
- `readTimelineContent` 对 app-server content source 在 live thread 缺失时先 resume 再 rehydrate；仍无法恢复时返回 scoped `repair-required`，**MUST NOT** 因可恢复的 missing-thread 上抛成 502。
- 增加覆盖 settings 与 full-content 两条路径的失败/恢复单元测试。

## Capabilities

### New Capabilities

- `live-thread-lifecycle`: 定义 gateway 对 missing live thread 的 bare resume 恢复契约，以及可恢复错误与不可恢复错误的边界。

### Modified Capabilities

- `permission-mode-controls`: 权限设置更新在 thread 尚未 live 时 MUST 先恢复再提交，而不是直接失败。
- `timeline-content-completeness`: 截断内容按 contentRef 读取时，missing live thread MUST 先恢复 rehydrate，或返回 repair-required，而不是 opaque 502。

## Impact

- `src/server/app-server/runtime.ts`：settings 更新、content rehydrate、共享 ensure-live 辅助逻辑。
- 可能触及 `src/server/custom-models/lifecycle-service.ts` 的 settings 入口，但优先在 gateway 层收敛，避免前端或 lifecycle 各自打补丁。
- `GET /api/codex/threads/:threadId/content` 与 `POST/PATCH .../settings` 的错误语义。
- `tests/unit/app-server-runtime.test.ts` 及相关 settings/content 测试。
- 不改变 contentRef 的 ephemeral 设计与 15 分钟 TTL；本次只修 live-thread 恢复与错误面。
