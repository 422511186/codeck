## 1. File change 身份与顺序

- [x] 1.1 添加失败测试，复现同一 itemId 的 live file delta 与完成 snapshot 被拆成两条且 Files changed 移到末尾
- [x] 1.2 保持 timeline tool identity 合并语义并调整 snapshot merge，使 file change 原位完成且不同 itemId 保持独立
- [x] 1.3 添加 bounded repair 位于两个 agent messages 之间的顺序测试并验证刷新前后一致

## 2. 长列表发送与尾部跟随

- [x] 2.1 添加失败测试，复现虚拟化长 timeline 在发送 optimistic message 后滚动到底部但可见窗口为空
- [x] 2.2 将 follow-tail 协调移入 Timeline layout 阶段，移除页面层基于 lastEntry 的抢先滚动
- [x] 2.3 覆盖 stream disconnected error、同 ID 流式增长和用户阅读历史三种滚动状态

## 3. 验证与部署

- [x] 3.1 运行相关 Vitest、`npm run verify` 和 `npm run release:verify`
- [ ] 3.2 提交 change 与实现代码，使用 `codex-web:local` 构建新 Docker 镜像
- [ ] 3.3 替换 `codex-web-19899` 并验证长会话、Files changed 顺序、发送后可见窗口和连续四页 cursor 分页
