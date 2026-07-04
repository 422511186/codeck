## 1. 测试基线与协议锁定

- [x] 1.1 更新 `tests/unit/web-thread-page.test.tsx`，先用失败用例覆盖四项权限菜单：「请求批准」「替我审批」「完全访问权限」「自定义 config.toml」。
- [x] 1.2 为权限切换后的 `thread/settings/update` 增加断言，覆盖 `permissions` 与 `approvalsReviewer` 的四项 payload。
- [x] 1.3 为 `turn/start` 和 `thread/start` 增加断言，确保后续发送使用同一权限 payload，并且不会发送 `read-only`、`workspace-write`、`full-auto`。
- [x] 1.4 更新 `tests/unit/web-chat-input.test.tsx` 和相关页面测试，断言模型 chip 显示 `gpt-5-codex Medium`，不包含逗号，reasoning effort 选项显示 `Low`、`Medium`、`High`。
- [x] 1.5 为 settings 聚合或权限列表读取失败增加回归测试，确保权限菜单仍能显示四个固定入口。
- [x] 1.6 为 app-server response / settings event 的 `approvalsReviewer` 回读增加测试，覆盖 `thread/start`、`thread/resume`、`thread/fork` 和 `thread/settings/updated` 后能正确显示「请求批准」或「替我审批」。

## 2. 类型与 app-server 参数透传

- [x] 2.1 在 `src/shared/codex.ts`、`src/web/api/types.ts`、`src/web/api/endpoints.ts` 中补充 `approvalsReviewer` 类型，支持 `"user"`、`"auto_review"`、`"guardian_subagent"` 和 `null`。
- [x] 2.2 更新 `src/app/api/codex/threads/start/route.ts`，从 HTTP body 接收并转发 `approvalsReviewer`，保留显式 `null`。
- [x] 2.3 更新 `src/app/api/codex/turns/start/route.ts`，从 HTTP body 接收并转发 `approvalsReviewer`，保留显式 `null`。
- [x] 2.4 更新 `src/app/api/codex/threads/[threadId]/settings/route.ts`，从 HTTP body 接收并转发 `approvalsReviewer`，保留显式 `null`。
- [x] 2.5 更新 `src/server/app-server/client.ts` 的 `startThread`、`startTurn`、`updateThreadSettings` 参数组装，向 app-server 传入 `approvalsReviewer`。
- [x] 2.6 更新 `src/server/app-server/client.ts` 的 `readThread`、`startThread`、`forkThread` 等 response 映射，把 app-server 返回的 `approvalsReviewer` 写入移动端 thread detail / summary 需要的状态。
- [x] 2.7 更新 `src/server/app-server/events.ts` 的 `thread/settings/updated` 映射，把 `threadSettings.approvalsReviewer` 转成浏览器事件字段。
- [x] 2.8 更新 app-server mock runtime 与相关单元测试，使 settings、thread start、thread resume、thread fork、turn start 都能记录并返回 reviewer 状态。

## 3. 权限模式建模与状态合并

- [x] 3.1 在前端引入四个固定权限模式定义，包含 label、description、`permissions`、`approvalsReviewer` 和排序。
- [x] 3.2 替换旧的 `FALLBACK_PERMISSION_PROFILES` 和旧 label 映射，移除 `read-only`、`workspace-write`、`full-auto` 作为发送候选。
- [x] 3.3 扩展 thread store 或页面派生状态，保存完整权限 payload 或可反推 payload 的 `permissionModeId`。
- [x] 3.4 实现 profile + reviewer 到四项权限模式的反推逻辑，确保 `:workspace` + `user` 显示「请求批准」，`:workspace` + `auto_review` 显示「替我审批」。
- [x] 3.5 调整 `activePermissionProfile` 与本地乐观状态的合并顺序，避免缺少 reviewer 的 stale 后端状态覆盖用户刚选择的模式。
- [x] 3.6 更新 `src/web/state/store.ts` 的 settings event 处理，使完整 profile + reviewer 能同步到本地状态，缺少 reviewer 的事件不得覆盖已有完整模式。
- [x] 3.7 在发送、重试和 Plan turn 路径中统一使用当前权限 payload，不让 collaboration mode 覆盖权限语义。

## 4. 权限菜单与 settings 降级

- [x] 4.1 更新 `PermissionPicker`，固定展示 Codex App 四项和对应说明文案，并使用当前模式高亮。
- [x] 4.2 更新权限 chip 文案和 aria-label，使 composer 底栏显示四项中文标签之一。
- [x] 4.3 切换权限时调用 settings update，立即关闭面板并乐观更新 chip；失败时保留可见错误或回滚到上一个有效状态。
- [x] 4.4 新增轻量权限 profile 读取路径，或让 `/api/codex/settings` 对 rate limit/auth 等无关子请求做 partial fallback，保证四项固定菜单不丢失。
- [x] 4.5 确认 `:danger-full-access` 不可用时不回退旧 id，并把 app-server 错误安全地展示给用户。

## 5. 模型 chip 与推理强度文案

- [x] 5.1 修改 `modelChipText`，模型名和 reasoning effort 展示之间使用空格或等价无逗号分隔。
- [x] 5.2 修改 `reasoningEffortLabel`，将 `low`、`medium`、`high` 显示为 `Low`、`Medium`、`High`。
- [x] 5.3 为未知 reasoning effort 实现可读英文回退，同时保持发送原始协议值。
- [x] 5.4 同步更新模型 picker、composer button 的 aria-label 和相关测试断言。

## 6. 验证、部署与收尾

- [x] 6.1 运行权限、ChatInput、ThreadPage、API route 和 app-server client 相关 Vitest 子集。
- [x] 6.2 运行 `npm run typecheck`。
- [x] 6.3 运行 `npm run test` 或记录无法全量运行的原因和已覆盖的子集。
- [x] 6.4 在手机视口验证权限四项展示、切换后发送、模型 chip 文案、推理强度选项、settings 失败降级和错误提示。
- [x] 6.5 如用户要求部署，使用更新容器的方式发布到 `19899`，不得主动停止当前可访问服务。
