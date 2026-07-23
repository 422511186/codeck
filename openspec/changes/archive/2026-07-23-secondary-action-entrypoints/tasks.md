## 1. Shared UI primitives

- [x] 1.1 新增轻量 `SwipeActionRow`（或等价 hook/组件）：横向滑出动作按钮、纵向滚动优先、滑开不自动执行
- [x] 1.2 统一/抽取底部 ActionSheet 与可选 Undo Toast 展示，供列表与消息复用视觉与交互
- [x] 1.3 为 `SwipeActionRow` 补充单元测试（阈值、纵向取消、点击动作）

## 2. Session list (thread-list-view)

- [x] 2.1 移除会话列表 `ThreadRow` 长按逻辑
- [x] 2.2 进行中 tab：左滑露出「归档」，点击后调用 archive，成功移出列表并可选 Undo Toast
- [x] 2.3 已归档 tab：禁止导航进入会话；点击打开 sheet（移出归档 / 取消）
- [x] 2.4 已归档 tab：左滑露出「移出归档」，与 sheet 共用 unarchive 提交与防重复逻辑
- [x] 2.5 更新/新增会话列表交互相关测试

## 3. User message actions (timeline-message-actions)

- [x] 3.1 移除用户消息长按打开菜单逻辑
- [x] 3.2 轻点 user message 气泡打开操作工具条/sheet（复制 / 回滚 / Fork / 取消）
- [x] 3.3 运行中仅允许复制；保持既有 rollback/fork 业务与 idempotency 行为
- [x] 3.4 更新 timeline 消息操作相关测试

## 4. Project management entry

- [x] 4.1 移除项目列表长按打开菜单逻辑；列表点击仅进入项目
- [x] 4.2 在项目会话列表页增加项目操作入口，复用重命名 / 存储迁移 / 移除能力
- [x] 4.3 从项目列表页迁移或共享 ActionSheet/Rename/Conflict 等操作实现，避免重复分叉
- [x] 4.4 更新项目管理相关测试

## 5. Verification

- [x] 5.1 运行 `npm run typecheck` 与相关 `npm run test`，修复回归
- [x] 5.2 对照 specs 自检：无长按主入口、已归档不可进入、左滑需再点、归档点击不直接移出
