## 1. 回归测试

- [x] 1.1 在 `web-thread-page` 增加未知 start 结果保持 active、不允许并发新发送的测试。
- [x] 1.2 增加 confirmed rejection 仍切换 idle 且保留新 identity 行为的测试。

## 2. 页面实现

- [x] 2.1 仅在 confirmed rejection 分支把发送失败后的 thread 状态置为 idle。
- [x] 2.2 复审 summary/event 收敛和 ambiguous retry，确认不改变既有 identity 语义。

## 3. 验证

- [x] 3.1 运行页面定向测试、类型检查和严格 OpenSpec 校验。
- [x] 3.2 运行完整 verify/build，并独立复审发送状态竞态。
