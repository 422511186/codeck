## 1. 测试先行

- [x] 1.1 为 `src/server/app-server/events.ts` 增加 `thread/status/changed` 映射测试，覆盖 `active`、`idle`、`notLoaded`、`systemError` 不追加可见 timeline 项。
- [x] 1.2 为前端 store 增加 thread status 测试，覆盖 status 事件更新 `status`、从 `status` 推导 `running`、`idle` 清理 stale active turn。
- [x] 1.3 为会话页增加状态源测试，覆盖首屏 `detail.status=active` 后收到 `idle` event 或 summary 时无需刷新即可停止 processing UI 并恢复 compact 入口。
- [x] 1.4 为手动 compact 生命周期增加前端测试，覆盖 pending 反馈、不本地追加「正在压缩上下文…」timeline 消息、失败后刷新 summary/status、失败后可重试。
- [x] 1.5 为 `POST /api/codex/threads/:threadId/compact` 增加服务端测试，覆盖非 `idle` 预检返回 `409`、结构化 `activeTurnNotSteerable` 返回 `409`、未知错误保持 `502`。
- [x] 1.6 为 JSON-RPC 错误保留增加单元测试，确认 `error.data` 或等价结构化字段可被 route 层读取。

## 2. 事件流与状态模型

- [x] 2.1 在 app-server 事件归一化层支持 `thread/status/changed`，输出浏览器可消费的 thread status 事件并保留幂等事件标识。
- [x] 2.2 更新浏览器 event stream client 类型和分发逻辑，使 thread status 事件进入 store，但不作为 visible timeline item 渲染。
- [x] 2.3 在 store 中保存真实 thread `status`，保持既有 `running` selector 兼容，并统一从 `status` 派生运行态。
- [x] 2.4 处理 `idle`、`active`、`notLoaded`、`systemError` 的 active turn 和 compact 可用性状态更新，确保 status event 不触发完整 timeline repair。

## 3. 会话页与 compact 生命周期

- [x] 3.1 调整会话页运行态、composer processing、停止按钮和 compact 可用性逻辑，优先使用 store 中的实时 thread status，`detail.status` 仅作为初始化 fallback。
- [x] 3.2 调整 summary 刷新路径，使 `GET /api/codex/threads/:threadId/summary` 返回的 status 能更新 store 和当前页面状态，但不替换当前 timeline。
- [x] 3.3 修复手动 compact pending 状态：请求中显示进行中反馈，禁止重复发起，并且不向 timeline 本地追加「正在压缩上下文…」系统消息。
- [x] 3.4 修复 compact 失败收尾：结束 pending，追加失败错误，调用 summary 或使用响应中的当前 status 同步状态，避免「当前状态不可压缩」永久卡住。
- [x] 3.5 修复 compact 完成收尾：接受 app-server live item、`thread/compacted` 或可信 `idle` 状态完成 pending 收尾，但「压缩上下文已完成」timeline 消息只能来自服务端事件。
- [x] 3.6 为 `notLoaded` 和 `systemError` 状态提供明确恢复后再压缩路径或可重试错误反馈，恢复成功后重新基于最新 status 判断 compact 可用性。

## 4. 服务端 compact 与错误分类

- [x] 4.1 修改 JSON-RPC 错误对象，保留 sanitized `message` 与结构化 `error.data`，并避免泄露敏感原始数据。
- [x] 4.2 修改 compact route，在调用 app-server 前用不含 timeline 的 summary 预检 thread status，所有非 `idle` 状态稳定返回 `409`。
- [x] 4.3 修改 compact route 的 app-server 错误分类，优先识别结构化 `activeTurnNotSteerable` 或等价状态冲突，再回退到 message fallback。
- [x] 4.4 为 compact route 增加诊断和审计信息，区分预检拒绝、app-server 已接受、app-server 结构化拒绝和未知失败。

## 5. 验证与交付

- [x] 5.1 运行新增和受影响的前后端测试，确认失败测试已通过且没有 timeline 全量轮询回退。
- [x] 5.2 运行 `npm run typecheck` 和 `npm run test`，必要时运行 `npm run verify`。
- [x] 5.3 运行 `openspec validate --changes "fix-thread-status-compact-lifecycle" --strict`。
- [x] 5.4 手工验证 active、idle、notLoaded/systemError、compact 失败、compact 完成五类状态，确认无需刷新页面即可恢复 UI。
- [x] 5.5 实现完成后按现有流程更新 Docker 实例，并记录部署验证结果。

### 验证记录

- 2026-07-08 运行受影响测试：`npm run test -- tests/unit/app-server-events.test.ts tests/unit/web-store-events.test.ts tests/unit/web-thread-page.test.tsx tests/unit/codex-thread-compact-route.test.ts tests/unit/json-rpc.test.ts`，结果 5 个测试文件、228 个用例通过。
- 2026-07-08 运行完整验证：`npm run verify`，结果 55 个测试文件通过、1 个跳过；687 个用例通过、1 个跳过。
- 2026-07-08 运行规格验证：`openspec validate --changes "fix-thread-status-compact-lifecycle" --strict`，结果 1 passed、0 failed。
- 2026-07-08 生产实例 `http://127.0.0.1:19899` 只读采样 28 个会话 summary，覆盖 `active=1`、`idle=2`、`notLoaded=25`；未对真实 `idle` 会话执行 compact，避免不可逆修改历史。
- 2026-07-08 生产实例 compact 预检验证：`active` 会话返回 `409` 和“会话仍在运行，停止后才能压缩上下文”，状态保持 `active`；`notLoaded` 会话返回 `409` 和“会话未处于空闲状态，恢复或停止后才能压缩上下文”，状态保持 `notLoaded`。
- 2026-07-08 compact 失败和完成路径由页面/store/runtime 测试覆盖：失败后追加错误并刷新 summary，完成消息仅来自 app-server live item / `thread/compacted` 事件。
- 2026-07-08 Docker 更新：直接使用 `node:22-bookworm-slim` 构建时 Docker Hub metadata 请求超时；改用本机已有 `public.ecr.aws/docker/library/node:22-bookworm-slim` 缓存后执行 `CODEX_WEB_DOCKER_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim docker compose -f compose.production.yaml up -d --build` 成功，`codex-web-19899` 已重建并启动。
- 2026-07-08 部署验证：`/api/health` 返回 `ok=true`；登录后 `/api/codex/status` 返回 app-server `external/ready`；`/api/codex/threads` 返回 28 个会话；首个 summary 状态读取成功。
