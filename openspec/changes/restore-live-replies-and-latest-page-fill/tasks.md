## 1. 回归测试

- [x] 1.1 添加 legacy 多个短 turn 聚合成一个 item 页及 cursor 连续性测试
- [x] 1.2 添加完成事件早于 assistant 持久化时自动重试 repair 的页面测试

## 2. 实现

- [x] 2.1 实现 legacy 跨 turn 有界 item 聚合与复合 cursor
- [x] 2.2 实现 completion repair 输出确认、去重和有限延迟重试

## 3. 验证部署

- [x] 3.1 运行相关测试、`npm run verify`、OpenSpec 校验和 `npm run release:verify`
- [ ] 3.2 提交、构建镜像、替换 `codex-web-19899` 并验证生产首屏与实时恢复
