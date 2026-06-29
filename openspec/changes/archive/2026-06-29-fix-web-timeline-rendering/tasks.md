## 1. 测试先行

- [x] 1.1 为 `src/web/components/ImagePreview.tsx` 增加 Linux/POSIX 绝对路径、Windows 绝对路径、相对路径和浏览器原生 URL 的 `imagePreviewSrc()` 单元测试
- [x] 1.2 为 `ReasoningCard` 增加运行态已有文本可见或可展开的组件测试，并保留无文本时“思考中…”测试
- [x] 1.3 为 `src/web/state/store.ts` 增加 `reasoning_delta` 连续追加和 `item_updated` 完成态替换的测试
- [x] 1.4 为 `src/server/app-server/events.ts` 增加 command/process output、reasoning summary part、raw response 或工具进度 notification 的归一化测试
- [x] 1.5 为 `src/server/app-server/client.ts` / `src/web/state/timeline.ts` 增加新增 `ThreadItem` 类型映射和未知执行项兜底展示测试

## 2. Timeline 事件映射

- [x] 2.1 扩展 `timelineItem()`，覆盖 `collabAgentToolCall`、`subAgentActivity`、`sleep`、`hookPrompt` 等当前 generated `ThreadItem` 中的用户可见类型
- [x] 2.2 为未知但用户可见的执行类 item 增加通用 tool/system timeline 兜底，避免静默返回 `null`
- [x] 2.3 扩展 `normalizeAppServerNotification()`，处理 `command/exec/outputDelta`、`process/outputDelta`、`rawResponseItem/completed`、`item/mcpToolCall/progress`、`item/reasoning/summaryPartAdded`
- [x] 2.4 确保实时 command/process 输出使用稳定 id 合并到同一张 running 卡片，完成事件到达后更新为最终状态

## 3. 推理卡片展示

- [x] 3.1 调整 `ReasoningCard`，在 `done=false` 且存在 `text` 时展示已到达推理文本，并保留运行中状态
- [x] 3.2 确认完成态 `item_updated` 会替换运行态推理卡片，标题和折叠行为符合 `agent-output-rendering` 规格
- [x] 3.3 确认移动端布局下推理文本不会撑破卡片或遮挡后续 timeline 内容

## 4. 图片预览路径

- [x] 4.1 修复 `imagePreviewSrc()`，Linux/POSIX 绝对本地路径和相对上传路径都通过 `/api/codex/images/preview?path=...`
- [x] 4.2 保留 `blob:`、`data:`、`http:`、`https:` 作为可直接加载的浏览器原生图片 URL
- [x] 4.3 确认 `/api/codex/images/preview` 仍由服务端路径白名单控制，不扩大可读取文件范围

## 5. 验证

- [x] 5.1 运行相关单测：图片预览、ReasoningCard、store events、app-server events、timeline conversion
- [x] 5.2 运行 `npm run typecheck`
- [x] 5.3 运行 `npm test`
- [x] 5.4 手动用远端浏览器验证：上传图片可预览、推理文本可见、命令/探索过程在当前会话 timeline 中可见

## 6. Live timeline 稳定性补充

- [x] 6.1 为 `ThreadPage` 增加测试：打开 active 会话时首屏 `readThread` 后不立即重复 polling 读取同一 thread
- [x] 6.2 为 `ThreadPage` 增加测试：`startTurn` 返回的滞后 thread snapshot 不会清空已经通过 WebSocket/store 追加的 live agent/reasoning/tool entries
- [x] 6.3 为 `ThreadPage` 或 store 增加测试：running polling snapshot 使用 merge 规则，保留本地 live delta，并允许 completed snapshot 更新同 id entry
- [x] 6.4 为 `events.ts` / store 增加测试：`item/reasoning/summaryPartAdded` 或 reasoning `item/started` 会创建空的 running reasoning entry，前端立即显示「思考中…」卡片
- [x] 6.5 实现 ThreadPage running snapshot merge 策略，替换发送后和 polling 中的无条件 `setThreadEntries`
- [x] 6.6 实现 running polling 去抖或延迟，避免首屏 active thread 读取后立刻重复 `readThread`
- [x] 6.7 实现 reasoning start/summary part 占位卡片，确保无文本阶段也显示推理框
- [x] 6.8 确认 Web 发起 turn 时不会丢失 app-server 的 reasoning summary 配置；必要时在 `startTurn()` 参数中显式传递 `summary`
- [x] 6.9 引入类型保真的工具进度事件，避免把 `item/mcpToolCall/progress` 等非 fileChange 事件映射成 `file_output_delta`
- [x] 6.10 增加测试：MCP/dynamic/sub-agent/collaboration 工具进度不会渲染为 fileChange，真实 fileChange 仍渲染为 fileChange
- [x] 6.11 重新运行相关单测、`npm run typecheck` 和 `npm test`
- [x] 6.12 用远端 Web 会话验证：打开会话请求不再重复、发送消息后输出持续追加、推理框立即出现，工具进度不再全部显示为 fileChange
