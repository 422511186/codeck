## 1. 测试基线

- [x] 1.1 为 app-server runtime 增加失败测试：overlay item 通过 `readThread` 暴露时必须携带 `turnId`，替换 base item 时不得丢失 base `turnId/turnIndex`
- [x] 1.2 为 app-server runtime 增加失败测试：`rollbackThread` 后被删除 turns 的 overlay 不得再次出现在后续 `readThread`
- [x] 1.3 为 web store 增加失败测试：agent/reasoning/tool/diff live entries 必须保存事件 `turnId`
- [x] 1.4 为 web store 增加失败测试：重复 `eventId` 或旧 revision delta 不得重复追加文本
- [x] 1.5 为 thread page 增加失败测试：running 状态不再固定短周期调用 `readThread` 拉取完整 timeline
- [x] 1.6 为 message rewind/fork 增加失败测试：刚完成的 live turn 无需刷新即可 rewind/fork，且 rollback 成功后不使用本地旧 entries fallback

## 2. Timeline 事件流契约

- [x] 2.1 定义浏览器 timeline event 类型，包含 `eventId`、`threadId`、`turnId`、`itemId`、`kind`、`revision` 或等价幂等字段
- [x] 2.2 在 app-server gateway 中为规范化 notification 分配稳定 `eventId` 和 per-thread revision/sequence
- [x] 2.3 新增 SSE endpoint，输出 `text/event-stream`，支持 `Last-Event-ID` 或等价游标
- [x] 2.4 实现事件补发缓存和 gap 信号；补发不可用时要求客户端执行 snapshot repair
- [x] 2.5 保留或迁移现有 WebSocket 分发时，确保其事件也通过同一规范化事件契约进入前端 store

## 3. 服务端 timeline overlay 与 history 生命周期

- [x] 3.1 修改 overlay 写入逻辑，使 overlay `MobileTimelineItem` 本体保留 `turnId`，必要时保留 `turnIndex`
- [x] 3.2 修改 overlay 应用逻辑，overlay 替换 base item 时合并并保留 base item 的 turn 元数据
- [x] 3.3 修改 `rollbackThread`，成功后清理被删除 turns 的 overlay item，并记录旧 turn tombstone/revision
- [x] 3.4 修改 `forkThread` / fork 后 rollback 路径，确保新旧 thread 的 overlay 缓存互不污染
- [x] 3.5 修改 `readThread` / `resumeThread` / turns pagination 相关路径，保证 snapshot 和 overlay item 元数据形状一致

## 4. 前端 store 幂等与 turn 元数据

- [x] 4.1 修改 live entry 创建逻辑，agent/reasoning/tool/system/diff entries 都从事件写入 `turnId`
- [x] 4.2 为 store 增加已处理 `eventId` / revision 水位，重复事件必须忽略
- [x] 4.3 修改 delta 追加逻辑，snapshot 或 completion 已覆盖的旧 delta 不得再次拼接
- [x] 4.4 修改 `item_updated` / completion 处理，保留现有 entry 的 turn 元数据并避免空 reasoning completion 清空已有文本
- [x] 4.5 修改 deleted turn / interrupted turn 事件过滤逻辑，使 rollback 后 late event 不会重新进入 timeline

## 5. 会话页运行中更新和 rewind/fork

- [x] 5.1 修改 `turn/start` route 和前端调用，运行中输出不再依赖 `turn/start` 后立即全量 `readThread`
- [x] 5.2 移除会话页 running 状态下固定短周期 `readThread` polling，改为事件流主路径
- [x] 5.3 实现事件流断线、gap 和手动 repair 时的一次性 `readThread` replace
- [x] 5.4 修改 rewind/fork 成功路径，严格使用服务端返回 thread detail replace，不再用 rollback 前本地 entries 切片兜底
- [x] 5.5 修改 rewind/fork 可用性判断，缺少可靠 `turnId` 或已知尾部范围时阻止操作并给出反馈
- [x] 5.6 修改会话缓存路径，已有内存 entries 时先渲染缓存，再后台连接事件流或执行必要 repair

## 6. Reasoning / tool / raw response 一致性

- [x] 6.1 统一 reasoning delta、reasoning completion、raw response reasoning 的 item identity 映射，避免 thinking 卡片重复
- [x] 6.2 补齐历史 `thread/read` reasoning 转换，公开 reasoning summary/content/raw response reasoning 刷新后仍显示
- [x] 6.3 确保 command/process/MCP/dynamic/file/web/image 等可见 tool 事件都通过事件流显示，未知可见事件落到 generic card
- [x] 6.4 确保 tool output completion 不会丢失运行中已追加的输出，也不会把相同输出重复拼接

## 7. 验证

- [x] 7.1 运行 timeline event stream、app-server runtime、web store、thread page 相关单元测试
- [x] 7.2 手动或自动验证长会话运行中不再持续请求 `/api/codex/threads/:threadId` 获取完整 timeline
- [x] 7.3 验证发送消息后 thinking/tool/agent 流式显示不重复，刷新后历史 thinking 仍存在
- [x] 7.4 验证发送后 turn 完成无需刷新即可 rewind/fork，rewind 后再次发送不会显示已删除旧消息
- [x] 7.5 运行 OpenSpec 校验并确认本 change artifacts 可被 apply 阶段识别
