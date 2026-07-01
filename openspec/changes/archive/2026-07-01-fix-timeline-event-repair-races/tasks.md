## 1. 事件流订阅空窗与 gap 归属

- [x] 1.1 为 `TimelineEventStreamClient` 添加无 listener 期间事件缓存、flush 和溢出 gap 的单元测试
- [x] 1.2 实现无 listener 期间的有限事件缓存，确保重新订阅后不会静默丢事件
- [x] 1.3 为 SSE `timeline-gap` 的 `threadId` 归属和客户端不盲修 active thread 添加测试
- [x] 1.4 实现服务端 gap `threadId` 解析/携带，以及客户端按归属 repair 的逻辑

## 2. repair 与本地 mutation 串行化

- [x] 2.1 为 snapshot repair 返回时 epoch 已变化但 repair 需求必须保留添加页面级测试
- [x] 2.2 调整 thread 页面 repair effect，使 stale repair 不覆盖新状态也不清除已确认 repair
- [x] 2.3 为 rewind/fork 本地失败不推进 mutation epoch 添加页面级测试
- [x] 2.4 延后 rewind/fork 的 mutation epoch bump 到实际服务端历史 mutation 前

## 3. generation-scoped 幂等状态

- [x] 3.1 为 generation 切换后同 item id、低 revision 的新 agent/reasoning/tool delta 添加 store 测试
- [x] 3.2 调整 `itemRevisions` 结构和 stale 判断，使 revision 按 generation 隔离
- [x] 3.3 为 snapshot suppression 遇到新 generation 或超出覆盖窗口保留新 delta 添加 store 测试
- [x] 3.4 调整 snapshot suppression 记录和判断，使其不会跨 generation 误抑制新输出

## 4. rollback barrier 服务端校验

- [x] 4.1 为 rollback `expectedDeletedTurnIds` 包含仍存在 turn 的情况添加 app-server 测试
- [x] 4.2 实现服务端 deleted-turn barrier 校验，只标记实际删除或可验证 live overlay tail turn

## 5. 验证与收尾

- [x] 5.1 运行相关单元测试：`web-events-client`、`web-store-events`、`web-thread-page`、`codex-events-route`、`app-server-runtime`
- [x] 5.2 运行项目推荐验证命令并修复回归
