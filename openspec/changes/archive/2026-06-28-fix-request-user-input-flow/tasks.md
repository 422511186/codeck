## 1. 测试先行

- [x] 1.1 在 `tests/unit/pending-requests.test.ts` 增加失败用例：`questionOptions` 优先使用 option `id` 作为 value，没有 id 时 fallback 到 label，并保留 description
- [x] 1.2 在 `tests/unit/pending-requests.test.ts` 增加失败用例：question response 构造必须返回 `{answers: {<questionId>: {answers: [value]}}}`，且不包含 `decision`
- [x] 1.3 在 `tests/unit/app-server-runtime.test.ts` 增加失败用例：`resolveServerRequest` 在 `peer.respondToServerRequest` 抛错时不得删除 pending request，也不得广播 resolved
- [x] 1.4 在 `tests/unit/web-approval-card.test.tsx` 增加失败用例：`question` 卡片显示问题、选项 label/description，点击选项时提交该 option value
- [x] 1.5 在 `tests/unit/web-approval-card.test.tsx` 或 `web-thread-page.test.tsx` 增加失败用例：resolve question 失败后卡片恢复可点并显示错误
- [x] 1.6 在前端相关测试中覆盖 Build/Default 下普通 assistant 文本中的 `request_user_input is unavailable in Default mode` 只作为 Markdown 文本展示，不生成 pending question 卡片

## 2. 后端 request 归一化与响应构造

- [x] 2.1 调整 `src/server/app-server/pending-requests.ts` 的 question option 解析，确保 option value/label/description 符合 spec
- [x] 2.2 调整 question response 构造：缺少 question id 时返回清晰错误或阻止提交，不生成会被 app-server 拒绝的空 answers
- [x] 2.3 调整 `/api/codex/requests/[requestId]/resolve/route.ts`，支持常规路径提交 `{value}`，由后端根据 pending request kind 构造 response；保留完整 `{response}` 作为兼容逃生路径
- [x] 2.4 调整 `AppServerGateway.resolveServerRequest()`，确保 respond 成功后才删除 pending request 和广播 resolved；失败时保留 request 并把错误返回 API
- [x] 2.5 补充或调整审计 detail，确保 `request.resolve` 仍记录 requestId 和实际提交语义，但不泄漏不必要内部对象

## 3. 前端 question 卡片交互

- [x] 3.1 重构 `src/web/components/cards/ApprovalCard.tsx`，按 request kind 分支渲染：普通审批仍为「拒绝 / 同意」，question 渲染选项列表
- [x] 3.2 question 卡片点击选项时调用 `onResolved(option.value)`，并在提交中、成功、失败状态下保持移动端可读可点
- [x] 3.3 调整 `src/web/api/endpoints.ts` 的 `resolveRequest` 签名或新增 helper，让前端提交 `{value}` 而不是手写 app-server response
- [x] 3.4 调整 `Timeline` / thread page 的 resolve 回调，保持 resolved 后移除/禁用卡片，失败时插入错误或在卡片内显示错误并保留 pending
- [x] 3.5 确认 Build/Default 普通文字提问不走 pending request UI；只有 WebSocket 或 `GET /api/codex/requests` 返回的 request 才渲染卡片

## 4. 验证

- [x] 4.1 运行 `npx vitest run tests/unit/pending-requests.test.ts tests/unit/app-server-runtime.test.ts tests/unit/codex-request-resolve-route.test.ts tests/unit/web-approval-card.test.tsx tests/unit/web-timeline.test.tsx tests/unit/web-thread-page.test.tsx tests/unit/web-store-events.test.ts`
- [x] 4.2 运行 `npm run typecheck`
- [x] 4.3 运行 `openspec validate fix-request-user-input-flow`
- [ ] 4.4 启动移动端 Web，用浏览器在 Plan 模式触发 `request_user_input`，确认 question 卡片出现、选项可点击、resolve 不再报 `missing field answers`
- [ ] 4.5 用浏览器在 Build 模式触发普通澄清问题，确认内部工具错误不会变成待处理卡片；若 agent 输出错误文案，也只按普通文本显示
- [x] 4.6 复测失败重试路径：模拟或触发 resolve 失败后 pending question 不消失，用户可再次提交
