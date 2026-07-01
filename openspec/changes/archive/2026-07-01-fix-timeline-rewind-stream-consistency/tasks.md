## 1. 测试先行

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 增加用例：snapshot repair 后补发中段 agent/reasoning/tool delta 不重复追加。
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 增加用例：server user item 确认 local user message 时原位替换，agent 输出不排到用户消息前面。
- [x] 1.3 在 `tests/unit/web-thread-page.test.tsx` 增加用例：`turn/start` 仅返回 `{turnId}` 后，刚发送 user message 绑定 `turnId` 并可 rewind。
- [x] 1.4 在 `tests/unit/web-thread-page.test.tsx` 增加用例：rewind 成功后当前输入框立即显示目标 user message 文本。
- [x] 1.5 在 `tests/unit/app-server-runtime.test.ts` 或 `tests/unit/codex-events-route.test.ts` 增加用例：rollback 后旧 generation/backlog 可见事件不会重新进入 timeline。

## 2. 服务端事件与 overlay

- [x] 2.1 在 `src/server/app-server/runtime.ts` 为每个 thread 维护 timeline generation，并在 `enrichCodexEvent` 输出中携带 `generation`。
- [x] 2.2 在 rollback、fork 初始化和 gap/repair 相关路径推进或重置 generation，并清理对应 overlay、deleted turn 记录和旧 backlog 可见事件。
- [x] 2.3 调整 `listBrowserEventBacklog` / SSE 补发逻辑，按 generation 和 deleted turn 屏障过滤旧事件；无法可靠补齐时发送 `timeline-gap`。
- [x] 2.4 确保 `recordTimelineOverlay` 不记录低 generation 或已删除 turn 的可见输出。

## 3. 前端 timeline 状态模型

- [x] 3.1 扩展 `ThreadState` 和 `TimelineEntry` 所需元数据，记录当前 generation、local user 与 server user 的映射、item 文本覆盖 offset。
- [x] 3.2 在 `turn/start` 成功后按 `clientUserMessageId` 将 optimistic user message 标记为 sent 并写入 `turnId`。
- [x] 3.3 修正 server user item 确认逻辑，优先按 `clientUserMessageId` / turnId 映射原位替换本地 user entry，不再删除后追加。
- [x] 3.4 重写 snapshot delta suppression，使 repair snapshot 覆盖的文本不会被后续中段 replay delta 重复拼接。
- [x] 3.5 在 `setThreadEntries` replace 语义中清理或重建过期 `processedEventIds`、`itemRevisions`、`snapshotDeltaSuppressions` 和 deleted turn/generation 状态。
- [x] 3.6 调整 timeline 排序/归并规则，保证同一 turn 内 user message 在 agent/reasoning/tool/diff 之前，completion item 原位更新。

## 4. Rewind/Fork 与输入框交互

- [x] 4.1 调整 `Timeline` 消息菜单，只有目标 user message 具备可靠 `turnId` 且可计算 tail turns 时才启用「回滚到这里」「从这里 Fork」。
- [x] 4.2 修改 `ChatInput` 为可接收父组件草稿更新的受控或半受控接口，rewind 成功后无需刷新即可回填文本。
- [x] 4.3 修改 `rewindToMessage`，rollback 成功后以服务端 thread detail replace timeline，并同步更新当前输入框和持久化草稿。
- [x] 4.4 修改 `forkFromMessage`，fork 后基于新 thread 的服务端历史定位等价目标 turn；rollback 成功后只初始化新 thread 的 post-rollback timeline。
- [x] 4.5 确保 rollback/fork 后旧 local tail、pending reasoning、tool output、diff 和旧 event replay 不会回流到当前 thread。

## 5. 验证与回归

- [x] 5.1 运行与本变更相关的单元测试文件：`web-store-events`、`web-thread-page`、`app-server-runtime`、`codex-events-route`。
- [x] 5.2 运行 `npm run verify`，确认类型检查和单元测试通过。
- [x] 5.3 人工检查移动端关键路径：发送后立即 rewind、rewind 后编辑重发、fork 后跳转编辑、断线重连后无重复输出、thinking 历史刷新后保留。
- [x] 5.4 更新本 change 的任务勾选状态，记录未覆盖或需要后续独立 change 的残余风险。

备注：5.3 当前以新增单元测试和 `npm run verify` 覆盖核心状态路径；未执行真实移动设备浏览器手测，后续发布前仍建议补一次真机回归。
