## 1. 回归测试

- [x] 1.1 增加 store 级失败用例：snapshot/repair 传入 activity-before-final 的数组后，真实 `setThreadEntries` normalize 仍保持该顺序。
- [x] 1.2 增加会话页历史分页失败用例：`listTurnsBefore` 返回 user/activity/final assistant 后，`prependEntries` 收到可被 store 保持的顺序和 timestamp。
- [x] 1.3 增加 app-server overlay 失败用例：未匹配 overlay activity 插入到所属 turn 的最终 assistant 前，而不是整个 timeline 尾部。

## 2. 实现修复

- [x] 2.1 在前端 snapshot reconstruction helper 中统一修复 trailing activity，并同步重写同 turn 内 `createdAt` 顺序。
- [x] 2.2 修复历史分页 fallback `createdAt` 方向，保证 page item 顺序与 store 排序一致。
- [x] 2.3 修复 app-server overlay 未匹配 item 的同 turn 安全插入点。

## 3. 验证与发布

- [x] 3.1 运行相关单元测试，确认新增测试先失败后通过。
- [x] 3.2 运行 typecheck、完整测试、生产构建。
- [x] 3.3 归档 OpenSpec change。
- [x] 3.4 构建并部署 Docker。
- [x] 3.5 commit 并 push。
