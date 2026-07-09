## 1. 回滚范围与目标身份测试

- [x] 1.1 在 timeline/会话页邻近测试中新增失败用例：当前窗口不能证明完整尾部范围时不得调用 rollback/fork。
- [x] 1.2 新增失败用例：回滚目标 entry 不在当前 normalized entries 时不得通过唯一文本 fallback 调用 rollback。
- [x] 1.3 新增失败用例：rollback 成功后若服务端返回有限历史窗口，前端不得把更早历史标记为已到开头。

## 2. 手机刷新读取测试

- [x] 2.1 在 app-server client 或会话页测试中新增失败用例：刚创建空 thread 的可恢复未加载错误应返回空 timeline 或通过有限恢复成功。
- [x] 2.2 新增失败用例：初始 `readThread` 遇到 transient thread read 错误时，会话页执行有限恢复后仍能显示空会话输入。

## 3. 实现修复

- [x] 3.1 收紧 rewind/fork 目标解析，移除破坏性操作中的纯文本 fallback，并要求当前 normalized entry 稳定存在。
- [x] 3.2 为 rollback metadata 计算加入窗口完整性输入，无法证明范围时返回 `null`。
- [x] 3.3 调整 rollback 后返回详情的分页语义，避免有限窗口被标记为 reached beginning。
- [x] 3.4 调整手机端刷新会话详情读取的有限恢复逻辑。

## 4. 验证

- [x] 4.1 运行相关单元测试：`npm run test -- tests/unit/web-timeline-engine.test.ts tests/unit/web-thread-page.test.tsx tests/unit/codex-client.test.ts`。
- [x] 4.2 运行 `npm run typecheck`。
- [x] 4.3 运行 `openspec status --change "fix-thread-rewind-and-mobile-refresh"` 并确认任务完成。
