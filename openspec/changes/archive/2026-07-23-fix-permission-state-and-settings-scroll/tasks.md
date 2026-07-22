## 1. 复现缺陷并锁定契约

- [x] 1.1 在 `web-store-events` 增加“完全访问收到临时 settings 事件仍保持 configured 权限”的失败测试，并确认当前实现失败
- [x] 1.2 在 `web-thread-page` 增加“下一轮发送继续携带完全访问三元组、刷新/重连不被 runtime observation 覆盖”的失败测试，并确认当前实现失败
- [x] 1.3 在 `pending-requests` 增加 `acceptForSession`、结构化 execpolicy/network decision 保留与非法 option 拒绝的失败测试，并确认当前实现失败
- [x] 1.4 在 `web-approval-card` 增加多 decision 展示、会话级允许和结构化 option 的失败测试，并确认当前实现失败
- [x] 1.5 在设置页测试中增加独立滚动容器、底部安全区和登出可达的失败测试，并确认当前实现失败

## 2. 分离权限配置与运行时观察

- [x] 2.1 扩展浏览器事件与共享类型，加入 `thread_permission_configured` 完整三元组事件和 thread runtime observation 字段
- [x] 2.2 将 gateway 权限登记改为 configured map；普通 `thread/settings/updated` 只记录 runtime observation，不再覆盖或回写 configured selection
- [x] 2.3 让 `startThread`、带显式权限覆盖的 `resumeThread`、成功 `updateThreadSettings` 和成功 `startTurn` 正确建立 configured selection；settings 成功后广播配置事件
- [x] 2.4 让 store 只用 configured selection 驱动 chip 和发送，持久化完整值，并在完全访问收到命令审批时插入按 turn/指纹去重的不一致提示
- [x] 2.5 修正 ThreadPage 的 detail、resume 和发送路径，确保最新 configured selection 优先且 runtime observation 不参与下一轮 payload

## 3. 保留审批协议 decision

- [x] 3.1 更新 pending request 归一化，为 command approval 的字符串和结构化 decision 建立 request-local option value 与安全文案
- [x] 3.2 更新 resolve response 构造与 route 校验，按当前 pending request 恢复原始 decision，拒绝未知、过期和跨请求 option
- [x] 3.3 更新 `ApprovalCard` 渲染所有可支持 decision，明确区分一次允许、会话允许、规则修订、拒绝和中断，并对不支持项失败关闭
- [x] 3.4 保持 question、permissions approval、MCP elicitation 和 dynamic tool 的既有 response 语义，补齐相邻回归测试

## 4. 修复设置页滚动

- [x] 4.1 新增 `/settings` 路由级滚动 layout，设置动态视口高度、纵向滚动、overscroll 边界和安全区底部间距
- [x] 4.2 调整设置页及自定义模型页底部 padding，并验证固定表单 overlay 和聊天页固定 viewport 不受影响

## 5. 回归与交付验证

- [x] 5.1 按 TDD 顺序运行权限、审批和设置目标测试，确认每个新增失败测试转绿且输出无警告
- [x] 5.2 运行 `npm run verify` 和 `npm run build`，修复所有类型、测试或构建回归
- [x] 5.3 启动非占用端口进行手机视口 smoke 检查：连续新 turn、命令审批选项、刷新/重连、设置页滚动和登出
- [x] 5.4 运行 `openspec validate --all --strict`，确认 change artifact、实现和任务状态一致
- [x] 5.5 深度复核权限失败回滚与审批 option 错误边界：清理失败的乐观持久化，将非法/过期 option 映射为 `400`，并拒绝 schema 外的 network action
