## Why

当前会话页的 timeline 在发送、流式输出、snapshot repair、rewind 和 fork 混合场景下存在状态不一致：新发送消息缺少可回滚的 turn 元数据、rewind 后输入框不能即时回填、旧输出可能在回滚后重现、断线修复或补发可能导致重复输出。  
这些问题直接破坏移动端 Web 的核心聊天体验，也会让用户无法可靠地基于历史 user message 执行 rewind/fork。

## What Changes

- 将刚发送的本地 user message 与 `turn/start` 返回的 `turnId` 绑定，保证无需刷新即可执行消息级 rewind/fork。
- rewind/fork 成功后使用服务端返回的 thread detail 作为唯一 timeline 来源，并同步更新当前输入框草稿状态。
- 引入客户端和服务端都可执行的 timeline generation / rollback barrier 语义，阻止旧 turn 的 late event、overlay 和 replay backlog 在回滚后重新进入 timeline。
- 修正 snapshot repair 与事件补发的幂等规则，避免 snapshot 已覆盖文本和后到 delta 重复拼接。
- 修正同一 turn 内 user message、agent message、reasoning、tool、diff 的排序与合并规则，避免 agent 输出显示在用户消息之前。
- 收紧消息级菜单可用条件：只有可可靠定位 `turnId` 并能计算尾部 turns 时才允许 rewind/fork。
- 补齐 timeline 一致性相关单元测试，覆盖发送后立即 rewind、rewind 后输入框回填、repair 后不重复、rollback 后旧事件不重现等场景。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 强化事件身份、历史 generation、snapshot repair 与 rollback 后 late event 屏蔽要求。
- `timeline-message-actions`: 强化新发送 user message 的 turn 元数据、rewind/fork 后本地状态替换和输入框回填要求。
- `thread-chat-view`: 强化缓存、事件流、snapshot repair 与发送后 timeline 顺序的一致性要求。
- `agent-output-rendering`: 强化 live delta、completion item、snapshot 合并后的去重与 reasoning/tool 输出保留要求。

## Impact

- 前端状态：`src/web/state/store.ts`、`src/web/state/timeline.ts`。
- 会话页交互：`src/app/threads/[threadId]/page.tsx`、`src/web/components/ChatInput.tsx`、`src/web/components/Timeline.tsx`。
- 事件流客户端：`src/web/events/client.ts`。
- 后端事件适配与 overlay：`src/server/app-server/events.ts`、`src/server/app-server/runtime.ts`、`src/app/api/codex/events/route.ts`。
- 相关 API 路由：`turn/start`、`thread/rollback`、`thread/fork`。
- 测试：timeline store、thread page、events route、app-server runtime 相关单元测试。
