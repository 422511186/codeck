## Why

当前会话运行中时，底部发送区会整体切换成“正在生成 + 中断”状态条，导致输入框、图片入口和 Skill 引用入口全部消失。用户无法在 agent 执行期间准备下一句提示词、图片或 Skill 引用，移动端连续对话效率较低。

## What Changes

- 运行中的 thread 继续显示原 composer，不再用运行状态条替换整个发送区。
- composer 右侧原发送按钮在运行中切换为中断按钮；只有按钮视觉和点击行为变化。
- 运行中允许用户编辑下一条草稿、选择图片和选择 Skill；这些内容只作为下一次发送准备，不影响当前正在执行的 turn。
- 当前 turn 结束后，按钮恢复为发送按钮；若草稿非空且图片已准备好，用户可手动发送。
- 不引入自动排队发送，也不把运行中输入内容作为 `turn/steer` 发送给当前 turn。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `chat-input-area`: 修改运行态 composer 行为，从“整体切换为状态栏”改为“保留 composer，仅发送按钮切换为中断按钮”。

## Impact

- 前端组件：`src/web/components/ChatInput.tsx`
- 会话页装配：`src/app/threads/[threadId]/page.tsx` 如需调整 props 语义则同步更新
- 测试：`tests/unit/web-chat-input.test.tsx`、必要时补充 `tests/unit/web-thread-page.test.tsx`
- API：继续使用现有 `turns/start`、`turns/:threadId/interrupt` 和 Skill/图片上传接口，不新增后端接口
