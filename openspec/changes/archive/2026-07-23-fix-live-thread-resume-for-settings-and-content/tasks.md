## 1. 失败测试

- [x] 1.1 为 `updateThreadSettings` 增加冷会话恢复测试：首次 `thread/settings/update` 报 thread not found，bare resume 后重试成功，且 resume 不带权限覆盖
- [x] 1.2 为 `readTimelineContent` 增加冷会话 rehydrate 测试：首次 `thread/items/list` 报 thread not found，resume 后读回完整正文
- [x] 1.3 为 content 增加 resume 后仍失败时返回 `repair-required`、不抛异常的测试
- [x] 1.4 为非 missing-live-thread 错误增加“不自动 resume”负例测试

## 2. Gateway 实现

- [x] 2.1 在 `AppServerGateway` 增加 missing-live-thread 检测与 `withLiveThreadRetry`/等价 helper
- [x] 2.2 将 `updateThreadSettings` 接入 bare resume + 一次重试
- [x] 2.3 将 app-server content rehydrate 接入 bare resume + 一次重试，并把可分类 missing-thread 失败映射为 `repair-required`

## 3. 验证

- [x] 3.1 运行相关单元测试确认红绿通过
- [x] 3.2 运行 `npm run typecheck`，必要时补跑邻近 runtime 测试，确认无回归
