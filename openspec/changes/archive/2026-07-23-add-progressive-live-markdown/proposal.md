## Why

当前 live agent 消息在整个回答完成前强制纯文本渲染，用户会看到“整段输出完才突然变成 markdown”的突兀跳变。需要在不把每个 token 都做完整高亮解析的前提下，让已完成段落尽早呈现 markdown。

## What Changes

- live agent 消息改为渐进渲染：已稳定完成的块用 Markdown，未完成尾巴继续轻量纯文本
- 保持历史消息的 Lazy Markdown 与完成后的全量 Markdown 能力
- 明确“完成块”边界：闭合代码块、段落边界等，避免未完成 fence/表格导致错误结构
- 更新相关测试：live 期间完整块可出现 markdown，未完成尾巴仍为纯文本

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `thread-chat-view`: 允许流式期间对已完成块做 Markdown，而不是整条 live 消息全程纯文本
- `agent-output-rendering`: 将“streaming 必须整条轻量文本”调整为“未完成尾巴轻量、已完成块可渐进 Markdown，且不得每个 delta 全量重高亮”

## Impact

- 前端：`src/web/components/Timeline.tsx` 的 `AgentMessage` live 渲染路径
- 可能新增纯函数：streaming markdown 切分 helper（便于单测）
- 测试：`tests/unit/web-timeline.test.tsx` 及相关 helper 单测
- 不影响 timeline 事件流、服务端协议
