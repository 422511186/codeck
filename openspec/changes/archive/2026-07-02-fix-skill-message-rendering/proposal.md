## Why

移动端会话中引用 Skill 后，服务端回读的用户消息会把结构化 `skill` 输入降级显示为 `[skill]`，既污染用户原始提问，也无法说明实际引用了哪个 Skill。同时，Skill 触发后常见的工具/命令过程卡片在折叠态优先展示工作目录等低价值信息，导致手机首屏被过程噪声占用，正文回答被明显下推。

## What Changes

- 用户消息中的结构化 Skill 引用不再作为普通文本渲染为 `[skill]`。
- 用户消息 SHALL 以只读 chip 或等价轻量样式展示已引用的 Skill 名称，并与正文文本分离。
- 本地乐观消息、历史消息、刷新修复后的消息 SHALL 保持一致的 Skill 引用展示。
- 命令/工具卡片在移动端折叠态 SHALL 优先展示用户可理解的动作名称或命令本身，避免长工作目录抢占标题。
- 保留推理、命令、工具过程的可追踪性，但降低它们对普通阅读流的干扰。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `thread-chat-view`: 用户消息需要支持结构化 Skill 引用的只读展示，且不得把 Skill 引用混入正文。
- `plugin-mcp-skills`: Skill picker 发送的结构化引用需要在会话 timeline 中保持可见、可识别、可回放。
- `agent-output-rendering`: 命令/工具卡片的折叠态摘要需要面向移动端阅读优化，优先展示动作或命令，而不是长路径等低优先级元数据。

## Impact

- 影响前端 timeline 数据类型、用户消息渲染、Skill 引用发送后的乐观消息展示。
- 影响 app-server `ThreadItem.userMessage` 到移动端 timeline item 的转换逻辑。
- 影响 `ToolCard` 或相关卡片摘要逻辑，尤其是 `toolKind: "command"` 的标题内容。
- 需要补充单元测试覆盖 Skill 引用转换、用户消息展示，以及命令工具卡标题摘要。
