## 1. 测试先行

- [x] 1.1 为 compact route 增加 `notLoaded`、`systemError` 和未知非 `idle` 状态返回 `409` 的失败测试
- [x] 1.2 为会话页增加非 `idle` 状态不展示 compact 入口的失败测试
- [x] 1.3 为手动 compact 增加不本地追加 timeline 占位、pending 请求期间 summary idle 不提前清状态的失败测试

## 2. 实现

- [x] 2.1 修改 compact route，仅 `idle` 状态调用 `gateway.compactThread`
- [x] 2.2 修改会话页 compact 入口，只在 `idle` 且未 running/pending 时可点击
- [x] 2.3 修改手动 compact pending 逻辑，移除本地 timeline 占位，并避免 summary idle 提前清理 pending

## 3. 验证

- [x] 3.1 运行相关单元测试：`npm run test -- tests/unit/codex-thread-compact-route.test.ts tests/unit/web-thread-page.test.tsx tests/unit/web-store-events.test.ts`
- [x] 3.2 运行 `npm run typecheck`
- [x] 3.3 运行 `openspec validate fix-manual-compact-state`
