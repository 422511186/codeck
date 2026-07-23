## Why

外接键盘用户，尤其是 macOS 用户，需要不离开输入框就能发送消息。当前底部 composer 仅支持点击发送按钮，普通 Enter 为换行；应在不破坏移动端回车换行习惯的前提下，增加跨平台修饰键发送。

## What Changes

- 在底部 composer 中支持 `Cmd+Enter`（macOS）与 `Ctrl+Enter`（Windows/Linux）触发发送
- 普通 `Enter` 继续只换行，不发送
- IME 组字过程中的 Enter / 修饰键 Enter 一律不发送
- 快捷键发送复用与发送按钮相同的可发送条件与提交流程

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `chat-input-area`: 在“普通输入框回车不发送”的基础上，增加修饰键发送规则与 IME 兼容要求

## Impact

- 前端：`src/web/components/ChatInput.tsx` 的 textarea 键盘事件处理
- 测试：`tests/unit/web-chat-input.test.tsx`
- 不影响 timeline、服务端 turn API 或附件上传协议
