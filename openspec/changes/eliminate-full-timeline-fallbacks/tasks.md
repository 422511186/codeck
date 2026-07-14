## 1. 非兼容上游回归测试

- [x] 1.1 添加 client 测试，复现 metadata flags 被忽略、resume 缺少 `initialTurnsPage` 及分页失败时完整 turns 泄漏
- [x] 1.2 添加 Web 页面测试，复现 `notLoaded` 状态发送后 resume 响应 replace 为完整 timeline
- [x] 1.3 添加 route/runtime 测试矩阵，覆盖 rollback、steer、review、rename、interrupt、fork 和 unarchive 的负向 timeline 保证

## 2. 服务端契约收紧

- [x] 2.1 删除 `metadataThread.turns` 与 `response.thread.turns` fallback，并强制 metadata/resume 丢弃非分页 turns
- [x] 2.2 将 mutation gateway 和 routes 改为仅返回操作结果、metadata 或显式有界消息页
- [x] 2.3 对所有公开消息页统一执行条目上限、UTF-8 字节预算和 cursor 前进校验

## 3. 前端分页窗口保护

- [x] 3.1 移除发送流程对 resume detail timeline 的 replace/merge，resume 后仅更新 metadata
- [x] 3.2 移除首屏、repair 和 mutation 对 detail timeline 的 fallback，分页失败保持当前窗口并提供局部重试
- [x] 3.3 迁移 rollback、steer、review、rename、interrupt、fork 和 unarchive 调用方到收紧后的响应类型

## 4. 验证与发布

- [x] 4.1 运行相关 Vitest、`npm run verify` 和 OpenSpec 校验
- [x] 4.2 运行 `npm run release:verify`，验证长会话发送前后响应条数、字节和 cursor 不扩张
- [x] 4.3 提交全部代码，基于 `codex-web:local` 重建镜像并替换 `codex-web-19899`
- [x] 4.4 验证健康接口、resume、metadata 零 timeline、最新分页和容器日志
