## Why

app-server 的模型兼容性和配置提示已经通过 warning 事件到达前端，但 store 把它们错误地转成 error entry，导致普通提示显示成红色“操作失败”，并在刷新后的异步到达时插入新消息尾部。权限三元组在首屏或 settings 聚合请求不完整时也被误解为失败状态，用户无法区分“尚未确认”和“权限确实失效”。

## What Changes

- 新增会话级 operation notice 状态，将 app-server warning、模型/权限操作 warning 从 timeline entry 中移出，改为顶部紧凑黄色提示并按稳定身份去重。
- 保留真正 turn/runtime error 的红色 alert；warning 不再使用 error card，也不再改变聊天消息顺序或底部滚动定位。
- 修正刷新后的 notice hydration：旧 warning 不得追加到新用户消息之后，notice 在首屏和实时事件之间保持稳定。
- 将权限“不完整”从错误式 chip 改为低干扰的待确认状态；本地完整选择或后端完整三元组到达后立即显示对应权限模式。
- 保持现有完整权限三元组的发送、模型切换恢复和 `recovery_failed` 阻塞语义。

## Capabilities

### New Capabilities

- `thread-operation-notices`: 会话级 warning notice 的来源、去重、刷新恢复和视觉展示。

### Modified Capabilities

- `timeline-event-stream`: warning 与 turn error 必须保持不同的 timeline 语义，warning 不得被降级为 error。
- `permission-mode-controls`: 权限三元组不完整时使用待确认状态，不误报为权限操作失败；完整状态到达后恢复真实模式。
- `thread-chat-view`: notice 不得参与聊天消息排序、底部自动滚动或新消息位置计算。

## Impact

- 影响 `src/web/state/store.ts`、timeline state/types、会话页和 composer/header 提示组件。
- 影响 app-server warning 事件到浏览器状态的映射，以及刷新时 thread detail 与 realtime event 的合并。
- 需要新增 store、timeline、thread page 和手机视口测试；不改变 app-server provider、模型目录或权限协议字段。
