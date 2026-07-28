## Why

Timeline 深度复审确认多条已有规范没有被实现完整：`turn/start` 的已完成幂等缓存会在 gateway boot 改变后直接返回旧 `turnId`，发送前的 resume/审计失败会被误判为 start 结果未知，而 app-server item 的 full-content 读取只校验 generation 且 app-server source/cursor 缓存没有完整上限。前两者会造成重复执行或让修正后的重试永久失败关闭；后两者会生成从未真实存在过的混合正文，或使长生命周期 gateway 的内存持续增长。

## What Changes

- 收紧 `turn/start` 幂等缓存：只有当前 boot 与操作 boot 一致时才直接复用缓存结果；boot 改变后必须从有界历史唯一确认原 turn，无法确认时失败关闭，不得再次启动 turn。
- 只把真正发出 `turn/start` 后的未知结果标记为 ambiguous；发送前 resume、审计、附件、Skill 和模型 readiness 失败统一标记为 confirmed rejection，且缓存命中/恢复不重复执行这些可变步骤。
- 保持相同 `clientUserMessageId` 的并发请求、同 boot 串行重试和已持久化 turn 恢复行为不变。
- 收紧 app-server item full-content source：读取每个 chunk 前后都验证注册时的 item revision；revision 改变时返回 `repair-required/source-revision`，不得把不同 revision 的 chunks 拼接。
- 对所有 full-content source 与 cursor 应用统一的过期清理和数量上限；淘汰 source 时同步移除关联 cursor，旧引用返回 scoped repair-required。
- 增加可复现跨 boot 已完成缓存和跨 chunk item revision 更新的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `turn-interaction`: 明确已完成的 start 幂等结果同样受 boot 边界约束，跨 boot 必须重新确认而不能直接复用旧 `turnId`。
- `timeline-content-completeness`: 明确 app-server item 的 full-content source revision 必须在首次读取及每个 continuation chunk 上严格校验。

## Impact

- API 与 Web：`src/app/api/codex/turns/start/route.ts` 的 start operation cache/前置步骤，以及 `src/app/threads/[threadId]/page.tsx` 的发送错误分类。
- 服务端：`src/server/app-server/runtime.ts` 的 app-server item content source 解析、revision 校验与缓存生命周期。
- 测试：`tests/unit/codex-turn-start-route.test.ts`、`tests/unit/web-thread-page.test.tsx`、`tests/unit/app-server-runtime.test.ts`。
- 不改变公开请求/响应 schema，不新增依赖，不改变正常发送、Timeline 展示或附件功能。
