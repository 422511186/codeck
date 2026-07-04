## 1. 测试与性能基线

- [x] 1.1 为长会话 `setThreadEntries`、`mergeThreadEntries`、live delta 追加建立单元级性能/复杂度测试，断言不会出现近似二次增长。
- [x] 1.2 为 `Timeline` 渲染建立长列表测试，断言初始挂载 row 数量有上限，历史 agent Markdown 不会全部同步渲染。
- [x] 1.3 为 event stream 批处理建立测试，覆盖同 item delta 合并、重复 `eventId`、snapshot-covered delta、deleted turn 和不同 generation 分组。
- [x] 1.4 为首屏会话读取建立 route/client 测试，断言刷新长会话不会调用 `thread/read includeTurns=true` 返回全量 turns。
- [x] 1.5 为历史分页建立顺序测试，覆盖多页合并、`turnIndex` 重复或缺失、rewind/fork 计算仍基于稳定 `turnId`。

## 2. 有界首屏与分页修复

- [x] 2.1 调整后端 app-server client/gateway，使普通 `readThread` 支持 metadata + 最近有界 turns，并保留真实 `lastTurnId`、generation、snapshotSequence 和 goal。
- [x] 2.2 调整 `/api/codex/threads/:threadId` 响应，使首屏 timeline 默认使用最近窗口，并返回继续加载更早 turns 的 cursor。
- [x] 2.3 调整 snapshot repair 调用路径，使可归属 gap 优先执行有界尾部 repair，而不是长会话全量读取。
- [x] 2.4 修正 `thread/turns/list` 适配层的排序和 turn order 处理，避免页内 `turnIndex` 当作全局顺序。
- [x] 2.5 更新前端 `readThread`、`listTurnsBefore` 和 thread state cursor 逻辑，确保刷新后默认滚到最新且向上分页继续可用。

## 3. Timeline Event Stream 批处理与 Overlay

- [x] 3.1 在 SSE 客户端或 store dispatch 前增加 delta batcher，按 `threadId + turnId + itemId + kind + generation` 聚合同窗口文本 delta。
- [x] 3.2 确保 batcher 对每个原始事件逐条执行 `eventId` 记录、duplicate suppression、generation barrier、revision stale 和 snapshot suppression。
- [x] 3.3 确保 `timeline-gap`、`server-request`、turn lifecycle、settings 更新等控制事件绕过文本批处理或及时 flush。
- [x] 3.4 将服务端 `agent_message_delta` 纳入 timeline overlay 聚合，并在 refresh/resume/repair snapshot 中暴露当前 agent message 尾部文本。
- [x] 3.5 为服务端 backlog 和浏览器无 listener buffer 的溢出路径补齐带 `threadId` 的 gap 行为。

## 4. Timeline Store 索引化

- [x] 4.1 设计并实现 entries 内部索引结构，至少覆盖 `entry.id`、等价输出 identity、turn order、local user confirmation 和 generation-scoped revision/suppression。
- [x] 4.2 重写 `replaceOrAddEntry`、`appendTextToEntry`、`mergeThreadEntries`、`setThreadEntries` 的热点路径，避免每次更新全量近似二次扫描。
- [x] 4.3 保持对 UI 暴露的 `entries: TimelineEntry[]` 兼容，避免一次性改动所有组件。
- [x] 4.4 保留并扩展现有 rewind、fork、duplicate after resend、snapshot repair、deleted-turn barrier 相关单元测试。
- [x] 4.5 为 store 更新次数和 entries 引用变化添加测试，确保被 suppression 的 delta 不触发可见 rerender。

## 5. 会话页订阅拆分与 Timeline 窗口化

- [x] 5.1 将 `ThreadPage` 拆分为 header、plan bar、timeline viewport、composer、actions sheets/dialogs 等组件，并让组件订阅最小 store slice。
- [x] 5.2 预计算 live agent entry、用户消息 action 可用性、turn order 和分页状态，停止在每个 `TimelineRow` 中扫描完整 entries。
- [x] 5.3 选择并接入动态高度虚拟列表库，或实现等价移动端窗口裁剪组件。
- [x] 5.4 保证窗口化后进入会话默认滚到最新、向上分页保持阅读位置、不在底部时新消息不强制滚动、跳到最新按钮仍正确。
- [x] 5.5 验证长按用户消息菜单、图片预览、审批卡片、错误卡片和系统消息在窗口化后仍可用。

## 6. 输出渲染懒加载与长内容上限

- [x] 6.1 调整 agent Markdown 渲染策略：live 和离屏历史先走轻量文本，进入可见窗口并空闲后再 Markdown 渲染。
- [x] 6.2 将代码高亮和 Mermaid 渲染延迟到对应 block 可见或用户展开时执行，并保持主题样式和错误展示。
- [x] 6.3 调整 `BaseCard`、`DiffCard`、`ToolCard`、`ReasoningCard`，确保折叠态不构造完整长内容 DOM。
- [x] 6.4 为命令输出、工具结果、reasoning、diff 和超长 agent 消息增加默认展示上限及查看/复制完整内容路径。
- [x] 6.5 增加测试覆盖截断预览、展开查看完整内容、复制完整代码块和完整 diff 可访问路径。

## 7. app-server 复用与进程生命周期治理

- [x] 7.1 明确配置语义：保留 `spawn` 作为单 Web 后端便捷启动，推荐生产和多 Web 后端使用 `external` 复用单个 app-server。
- [x] 7.2 新增 `spawn-or-connect` 或等价模式；固定 host/port 时先连接已有 app-server，连接失败后再进入启动流程。
- [x] 7.3 为自动启动增加跨进程锁、pid/endpoint 元数据和陈旧锁检测，避免多个 Web 后端同时启动多个 app-server。
- [x] 7.4 增加退出清理：当前 Web 后端拥有的子进程在 `SIGINT`、`SIGTERM`、正常 close 时关闭；异常退出后的残留进程后续可被识别和复用或标记陈旧。
- [x] 7.5 为固定端口已有服务、端口占用但不可用、并发启动、父进程异常退出、陈旧 pid/lock 编写测试。
- [x] 7.6 调整状态诊断和中文文档，说明当前模式、是否复用、是否拥有子进程和清理策略；状态接口不得暴露原始 app-server URL 或 token。

## 8. 验证与收尾

- [x] 8.1 运行 `npm run typecheck` 和相关单元测试，修复类型和行为回归。
- [x] 8.2 运行长会话刷新和流式输出性能测试，记录优化前后关键指标：首屏 turns 数、store 更新次数、挂载 row 数量和 Markdown 渲染数量。
- [x] 8.3 使用手机尺寸浏览器验证会话刷新、连续 agent 输出、向上分页、回到底部、interrupt、rewind、fork 和审批流程。
- [x] 8.4 验证 app-server lifecycle：`external` 复用、自动模式并发启动、异常退出残留识别、状态诊断和重复启动防护。
- [x] 8.5 更新必要的中文文档或测试说明，记录长会话性能验证方法、app-server 复用建议和已知限制。
- [x] 8.6 执行 `openspec validate optimize-thread-chat-performance` 和最终 `npm run verify`。
