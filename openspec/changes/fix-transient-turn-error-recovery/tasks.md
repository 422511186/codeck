## 1. 回归测试

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 增加 `willRetry=true` 后成功完成不保留 error entry 的测试。
- [x] 1.2 增加服务端 runtime overlay 测试，确认 retryable error 不出现在 `listThreadTurns`，旧 overlay 在成功完成后也会被清理。
- [x] 1.3 保留并核对最终 `willRetry=false` 错误仍显示且用户消息失败的现有测试。

## 2. 实现

- [x] 2.1 调整 `src/web/state/store.ts`，临时 turn error 不写入 timeline，并在成功完成事件中幂等删除旧 error identity。
- [x] 2.2 调整 `src/server/app-server/runtime.ts`，临时 turn error 不写入持久 overlay，并在成功完成时清理兼容旧 overlay。
- [x] 2.3 确认最终错误和现有 turn lifecycle、snapshot merge 语义不回归。

## 3. 验证

- [x] 3.1 运行相关 Vitest；依赖缺失时记录明确原因。
- [x] 3.2 运行 `npm run typecheck` 或 `npm run verify`。
- [x] 3.3 使用 390px 手机视口验证刷新后错误不再出现在 timeline 尾部。

## 4. 跨平台测试隔离

- [x] 4.1 让 `npm run test` 和 `test:watch` 显式设置 `NODE_ENV=test`，不继承调用机器环境。
- [x] 4.2 修改 app-server transport 测试，只断言受控命令语义和 endpoint，不绑定平台 wrapper。
- [x] 4.3 修改 security 路径测试，使用系统临时目录和结构化路径 API，不写死 `/tmp` 或分隔符。
- [x] 4.4 修改 catalog 初始化测试，移除跨文件系统不稳定的 POSIX mode 精确断言。
- [x] 4.5 在外部 `NODE_ENV=production` 条件下运行完整 `npm run verify` 并确认全部通过。
