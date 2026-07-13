## 1. 协议与服务端分页

- [x] 1.1 先添加失败测试，证明 app-server client 使用 `thread/items/list` 且不再请求旧 method 或 `includeTurns=true`
- [x] 1.2 更新协议类型和 app-server client，提供 thread-wide cursor 分页与 metadata-only 读取
- [x] 1.3 添加失败测试，证明 Next API 不返回完整 timeline，并强制条数与字节预算
- [x] 1.4 实现 metadata API 与受控 items 分页 API，迁移依赖完整详情的服务端调用方

## 2. 前端渐进加载

- [x] 2.1 先添加失败测试，覆盖首屏最新页、向上 cursor 翻页和分页失败不回退全量读取
- [x] 2.2 更新 Web API client、timeline adapter 和 thread 页面状态，只维护已加载消息窗口
- [x] 2.3 删除完整快照修复循环，并按 `threadId + cursor` 去重局部分页请求

## 3. Composer 布局

- [x] 3.1 先添加失败测试，证明 composer 参与 flex 布局且 timeline 使用 `min-height: 0`
- [x] 3.2 移除 fixed composer 和动态 bottom padding，实现底部贴合与历史锚点保持
- [x] 3.3 验证多行输入、已选上下文和运行态 composer 均不遮挡消息

## 4. 验证与发布

- [x] 4.1 运行相关 Vitest、`npm run verify` 和 `npm run release:verify`
- [ ] 4.2 使用长会话验证首屏响应有界、cursor 可继续翻页且没有重复 502
- [ ] 4.3 提交全部代码，重新构建并部署 Docker 容器
