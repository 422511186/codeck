## Why

用户明确选择「完全访问权限」后，下一轮仍可能出现命令审批，期间权限 chip 还会在「请求批准」与「完全访问权限」之间变化。当前系统把用户为后续 turn 配置的权限、app-server 当前运行时权限和审批结果写入同一状态，同时丢失 `acceptForSession` 与结构化审批 decision；设置页又因全局滚动锁无法到达底部登出入口，需要在不降低安全边界、不破坏聊天页布局的前提下统一修复。

## What Changes

- 将用户配置的完整权限三元组与 app-server 运行时权限观察值分离；权限 chip、本地恢复和下一次 `turn/start` 只使用有明确配置来源的状态。
- 为显式权限设置增加可排序、可去重的配置提交事件；普通 `thread/settings/updated` 不再静默覆盖用户配置。
- 完全访问配置下仍收到真实命令审批时保持失败关闭，保留审批卡片并显示去重的不一致诊断，不自动授权。
- 完整保留 app-server 的审批 decision，分别呈现一次允许、会话允许、规则修订、拒绝与中断，并由服务端按不透明选项 ID 回传原始结构化值。
- 为 `/settings` 路由树建立手机视口内的独立滚动容器和安全区底部间距，确保登出和自定义模型内容可达。
- 以失败测试覆盖连续发送、刷新、重连、事件乱序、结构化审批和移动端滚动，再执行完整验证与构建。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `permission-mode-controls`: 明确配置权限与运行时观察的权威边界、恢复顺序、发送快照及权限不一致反馈。
- `approval-inline-cards`: 保留并安全提交 app-server 提供的全部审批 decision，避免会话级与结构化语义丢失。
- `settings-minimal`: 要求设置路由在锁定全局 body 的移动端布局中独立滚动，并保证底部操作可达。

## Impact

- 前端会话状态、权限 chip、发送流程、事件分发和本地权限恢复逻辑。
- app-server gateway 的权限状态登记、浏览器事件与 pending request decision 映射。
- 审批卡片和 resolve API 的选项契约。
- `/settings` 及其子路由布局。
- 权限、审批、事件、设置页相关单元测试与移动端 smoke 验证。
