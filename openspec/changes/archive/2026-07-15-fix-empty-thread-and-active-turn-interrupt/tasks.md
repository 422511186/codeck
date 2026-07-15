## 1. 回归测试

- [x] 1.1 为未 materialized 空 thread 的 `listThreadTurns` 添加失败优先测试，要求返回空页且不吞其他错误
- [x] 1.2 为 gateway active turn registry 和无显式 turnId 的 interrupt route 添加失败优先测试
- [x] 1.3 为 active metadata `lastTurnId: null` 不清除客户端已知 turnId 添加失败优先页面测试
- [x] 1.4 为 active metadata 与有界最新 turn 状态不一致添加失败优先 client/runtime 测试

## 2. 实现

- [x] 2.1 在 app-server client 分页边界归一化明确的空会话未 materialized 错误
- [x] 2.2 在 runtime 维护 active turn identity，并让 interrupt route 使用该 identity
- [x] 2.3 调整会话页 metadata 合并，仅以非空权威 turnId 覆盖 active identity
- [x] 2.4 以 `limit=1`、`itemsView=notLoaded` 的最新 turn 状态校正 metadata/summary 和 registry

## 3. 验证

- [x] 3.1 运行 client、runtime、interrupt route 和 thread page 相关测试
- [x] 3.2 运行 `npm run verify`、OpenSpec 严格校验并复测生产形状探针
- [x] 3.3 重建并替换 Docker 容器，验证自然终态或生产 stale-active 样本恢复为 idle
