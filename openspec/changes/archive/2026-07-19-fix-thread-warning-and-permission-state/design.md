## Context

当前 app-server 会通过独立的 `warning` 事件发送模型兼容性、元数据和恢复提示，但浏览器 store 将该事件写入 timeline，并使用 `body.kind = error` 渲染。因此普通 warning 会显示为红色“操作失败”，而且在刷新后异步到达时会被追加到消息列表末尾。真正的 turn/runtime error 与 warning 在协议层已经区分，问题集中在前端状态建模和展示边界。

权限展示依赖 `permissions`、`approvalPolicy`、`reviewer` 三元组。首屏 detail、settings 聚合请求或 websocket 重连期间可能只收到部分字段，当前页面用错误式文案表达这种暂态，造成权限已失效的误解。

## Goals / Non-Goals

**Goals:**

- 为每个会话增加独立、可去重、可关闭的 operation notice 状态。
- 将 app-server warning 和模型/权限操作 warning 渲染为会话头部附近的紧凑提示，不进入 timeline。
- 保留真正 `turn_error`、`recovery_failed` 的红色错误语义。
- 让刷新、实时事件合并和新消息发送不受 notice 排序影响。
- 将权限三元组不完整明确显示为低干扰的“待确认”，完整状态到达后立即显示真实权限模式。

**Non-Goals:**

- 不修改 app-server 的模型目录、provider 配置或权限协议。
- 不在本次变更中修复 settings 聚合接口的 MCP/plugin 外部连接失败。
- 不改变已经完整生效的权限模式、模型切换恢复和错误恢复流程。

## Decisions

### 独立 notice 状态

在 `ThreadState` 增加 `notices`，并提供稳定身份的 upsert/dismiss 操作。warning 事件只更新该集合，不调用 `appendEntries`。选择独立状态而不是给 timeline entry 增加更多类型，是为了让时间线排序、虚拟列表、底部定位和历史消息分页完全不感知通知。

### 稳定去重身份

notice 使用来源和消息指纹组成稳定 id；同一会话重复收到相同 warning 时只更新时间和文本，不新增视觉卡片。不同 warning 保留为独立提示，用户可逐条关闭。

### 展示位置与语义

会话页在 header/plan bar 之后、timeline 之前渲染 `ThreadNotices`。warning 使用黄色、中性 `role=status` 的紧凑提示和关闭图标；不显示“操作失败”。真正错误仍使用现有 `role=alert` 红色组件。

### 权限暂态

权限三元组只要存在 `undefined` 就标记为 `pending`，文案使用“权限状态待确认”，并保持发送控件可用；只有收到完整三元组（包括显式 `null`）才计算 auto/request/full/config 等真实模式。这样不会把网络延迟或 settings 502 误报成权限拒绝。

### Notice 关闭持久化

关闭操作将 notice 的稳定 id 写入当前会话的本地存储。hydrate 或实时 upsert 前过滤已关闭 id，确保用户刷新后不会再次看到同一条提示；不同文本会生成不同 id，因此新的问题仍可出现。清除会话本地数据时一并清除关闭记录。

## Risks / Trade-offs

- [通知状态没有服务端持久化] → 通过 thread detail/realtime warning hydration 在当前页面生命周期内恢复；用户可关闭，刷新后若服务端再次发送则重新出现。
- [同一消息的文本变化会产生新指纹] → 保留来源前缀并仅对完全相同消息去重，避免隐藏重要的新上下文。
- [通知占用少量头部空间] → 使用紧凑单行/可换行布局，不参与 timeline 滚动和自动定位；移动端超过宽度时自然换行。
- [settings 仍可能返回 502] → UI 明确显示待确认而不是错误，并保留现有日志和重试路径，避免在本次范围内扩大后端改动。

## Migration Plan

先发布前端状态与展示改动，旧 timeline warning 仍可由历史数据读取但新事件不再追加。页面加载时清理或忽略旧的 warning error entry，避免同一 warning 同时出现两种样式。回滚时删除 notice 渲染和映射即可，不需要数据迁移。

## Open Questions

- 是否需要在后续版本将 notice 持久化到 thread detail，以便跨设备恢复？本次保持会话内状态和实时事件为准。
