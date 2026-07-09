## 1. 测试先行

- [x] 1.1 为 `tests/unit/web-store-events.test.ts` 增加失败测试，覆盖 `thread_status_changed: idle` 清理已知 active turn 的空 pending reasoning，并确认不追加可见 status item、不请求 snapshot repair。
- [x] 1.2 为 `tests/unit/web-store-events.test.ts` 增加失败测试，覆盖 `thread_status_changed: idle` 将同一 active turn 下的 running tool/command activity 标记为结束。
- [x] 1.3 运行新增 store 测试并确认在实现前按预期失败。

## 2. Store 实现

- [x] 2.1 调整 `src/web/state/store.ts` 的 `thread_status_changed` 分支，在 status 为 `idle` 且存在已知 active turn 时复用 live turn 收尾逻辑。
- [x] 2.2 确保 status event 仍不追加 visible timeline entry、不参与 deleted/interrupted visible event 过滤、不单独触发 snapshot repair。
- [x] 2.3 运行新增 store 测试并确认通过。

## 3. 验证与收尾

- [x] 3.1 运行受影响测试：`npm run test -- tests/unit/web-store-events.test.ts`。
- [x] 3.2 运行完整验证：`npm run verify`。
- [x] 3.3 运行 OpenSpec 验证：`openspec validate --changes "fix-status-idle-timeline-finish" --strict`。
- [x] 3.4 记录本次代码审查发现、修复范围和验证结果。

### 验证记录

- 2026-07-08 代码审查发现：`thread_status_changed: idle` 只清理 thread `running/activeTurnId`，未收尾已知 active turn 的 live timeline activity；当 `turn_completed` 缺失或晚于 status event 时，timeline 会残留空 pending reasoning 或 running tool/command entry。
- 2026-07-08 RED：新增 `tests/unit/web-store-events.test.ts` 两个回归测试后运行 `npm run test -- tests/unit/web-store-events.test.ts`，结果 2 个新增用例失败，分别证明 pending reasoning 未清理、running activity 未结束。
- 2026-07-08 GREEN：调整 `src/web/state/store.ts` 的 `thread_status_changed` 分支后，`npm run test -- tests/unit/web-store-events.test.ts` 通过，结果 1 个测试文件、74 个用例通过。
- 2026-07-08 完整验证：`npm run verify` 通过，结果 55 个测试文件通过、1 个跳过；689 个用例通过、1 个跳过。
- 2026-07-08 OpenSpec 验证：`openspec validate --changes "fix-status-idle-timeline-finish" --strict` 通过；当前两个 active changes 均为 0 failed。
- 2026-07-08 Docker 更新：使用本机已有 `public.ecr.aws/docker/library/node:22-bookworm-slim` 缓存执行 `CODEX_WEB_DOCKER_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim docker compose -f compose.production.yaml up -d --build` 成功，`codex-web-19899` 已重建并启动。
- 2026-07-08 部署验证：`/api/health` 返回 `ok=true`；登录后 `/api/codex/threads` 返回 28 个会话；触发列表读取后 `/api/codex/status` 返回 app-server `external/ready`。
