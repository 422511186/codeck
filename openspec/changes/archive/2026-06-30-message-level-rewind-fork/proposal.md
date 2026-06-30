## Why

当前 Web 端把「重发上一条」放在底部输入区，把 Fork 放在会话级 `⋮` 抽屉中，实际只能处理会话最新位置。用户真正需要的是基于某一条历史用户消息进行时间线操作：可以回滚到该消息重新聊天，也可以从该消息创建新分支继续探索。

这次变更将时间线回滚与 Fork 从“会话级最新状态操作”调整为“消息级历史时间线操作”，避免用户误以为只能对最新消息操作，也避免 Fork 总是从最新会话状态分支。

## What Changes

- **BREAKING** 移除底部输入区的「重发上一条」入口。
- **BREAKING** 移除会话头部 `⋮` 抽屉里的「Fork 会话」入口。
- 新增用户消息长按操作菜单，作为回滚和 Fork 的唯一入口。
- 长按自己的 user message 后显示「复制」「回滚到这里」「从这里 Fork」「取消」。
- 「回滚到这里」会截断当前会话到所选用户消息之前，把该消息文本回填到底部输入框，用户可编辑后重新发送。
- 「从这里 Fork」会保留原会话，创建新会话并截断到所选用户消息之前，跳转到新会话后把该消息文本回填到输入框。
- 前端 timeline 数据需要能可靠识别 user message 所属 turn，并计算从尾部需要回滚的 turn 数。
- 运行中 thread 不允许触发回滚或 Fork，避免和 active turn 状态冲突。

## Capabilities

### New Capabilities
- `timeline-message-actions`: 定义用户消息长按菜单，以及基于某条历史用户消息的复制、回滚到这里、从这里 Fork 行为。

### Modified Capabilities
- `chat-input-area`: 删除底部输入区的「重发上一条」能力要求，输入区只保留发送、图片、全屏编辑和运行态中断。
- `thread-controls`: 从会话头部 `⋮` 抽屉中删除 Fork，会话级菜单只保留会话级操作。
- `thread-chat-view`: 更新聊天页交互入口，Fork 不再从头部抽屉触发，而是从用户消息长按菜单触发。
- `thread-lifecycle`: 明确 rollback/fork 支持消息级时间线操作所需的 turn 识别与回滚语义。

## Impact

- 前端组件：`src/app/threads/[threadId]/page.tsx`、`src/web/components/ChatInput.tsx`、`src/web/components/Timeline.tsx`。
- 前端状态：timeline entry 需要携带或能解析 user message 所属 turn 信息。
- API/服务端适配：可能需要扩展移动端 `ThreadDetail` / `TimelineItem` 的字段，或新增 helper API 以定位目标 turn 并计算 `numTurns`。
- 后端调用：继续复用 `thread/fork` 与 `thread/rollback`，或在 Web API 层封装消息级 rewind/fork 流程。
- 测试：需要覆盖旧入口删除、长按菜单、当前会话回滚、Fork 后回滚、运行中禁用、历史分页/局部 timeline 不误操作等场景。
