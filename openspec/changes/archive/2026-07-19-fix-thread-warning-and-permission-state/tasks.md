## 1. Notice 状态与事件映射

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 先增加 warning 不产生 timeline error、重复 warning 去重的失败测试
- [x] 1.2 在 `src/web/state/store.ts` 增加会话 notice 类型、初始化、upsert/dismiss action，并将 websocket `warning` 映射到 notice
- [x] 1.3 更新 store 的可见事件判断和相关类型测试，确保 notice 不进入 timeline engine

## 2. 会话页提示展示

- [x] 2.1 为 `ThreadNotices` 增加组件测试，验证黄色 status 样式、关闭操作和不出现“操作失败”
- [x] 2.2 实现 `ThreadNotices` 组件并在会话页 header/plan bar 与 timeline 之间渲染
- [x] 2.3 将模型/权限操作 warning 从 `reportModelWarning` 的 timeline 写入改为 notice upsert，并保留真正错误路径
- [x] 2.4 持久化用户关闭的 notice id，并在刷新 hydrate 与实时事件中保持隐藏

## 3. 权限待确认状态

- [x] 3.1 增加权限三元组部分缺失时显示待确认且发送不禁用的回归测试
- [x] 3.2 将 `permissionModeFromPayload` 的 incomplete 文案和样式改为低干扰待确认语义
- [x] 3.3 验证完整本地选择与完整后端三元组会覆盖 pending 状态并展示真实权限模式

## 4. 验证与回归

- [x] 4.1 运行相关 Vitest 测试并修复 warning、timeline、权限状态回归
- [x] 4.2 运行 `npm run verify` 与 `openspec validate fix-thread-warning-and-permission-state --strict`
- [x] 4.3 使用手机视口验证刷新后 warning 固定在头部、新消息仍在时间线末端，且权限状态文案不再误报失败
