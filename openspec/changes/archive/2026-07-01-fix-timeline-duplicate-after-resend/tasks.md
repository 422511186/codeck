## 1. 前端重复输出归并

- [x] 1.1 为同一 turn 内 live delta 与 item completion 的不同 id 重复 agent/reasoning 输出添加 store 测试
- [x] 1.2 实现前端 turn-scoped 等价输出归并，保留更完整文本和 metadata
- [x] 1.3 为不同 turn 相同文本不被误删添加回归测试

## 2. 服务端 snapshot/overlay 重复归并

- [x] 2.1 为 `readThread` 合并 snapshot 与 overlay 时出现等价输出重复添加 app-server 测试
- [x] 2.2 实现服务端 overlay 与 snapshot 的等价输出合并，避免刷新后仍重复

## 3. 验证

- [x] 3.1 运行 `web-store-events` 和 `app-server-runtime` 相关测试
- [x] 3.2 运行项目推荐验证命令
