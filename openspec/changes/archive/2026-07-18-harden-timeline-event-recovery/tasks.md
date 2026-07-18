## 1. 共享契约与红灯基线

- [x] 1.1 为 `HistoryStamp`、`streamSequence`、可选 `fragmentSequence`、canonical source locator、repair window anchors/pageWatermark 和 scoped gap payload 补充共享类型与序列化失败测试，覆盖 legacy payload 兼容输入。
- [x] 1.2 实现共享 event/page/repair 类型及 runtime 校验，使 metadata、latest-page、history-page、overlay 和 visible event 使用同一字段语义，且不手改 `docs/generated/`。
- [x] 1.3 建立 gateway → event client → timeline engine 的跨层 fixture，先复现 `A1(stream 1), B1(stream 2), A2(stream 3)` 被误判 fragment gap 的 P0 问题。
- [x] 1.4 建立可重复使用的竞态测试驱动器，能够控制 boot、generation、stream/fragment sequence、HTTP 响应时机、listener 注册和 runtime overlay watermark。

## 2. 服务端事件身份与恢复来源

- [x] 2.1 先补失败测试覆盖 gateway 重启 eventId 碰撞、generation 归零、旧 Last-Event-ID、同 boot duplicate notification 和跨 boot replay 拒绝。
- [x] 2.2 在 gateway 每次启动时生成稳定 `bootId`，将进程级计数器明确为 `streamSequence`，并让 eventId、backlog cursor、HistoryStamp 和日志使用新身份域。
- [x] 2.3 为可追加字段实现按 `{threadId,generation,turnId,itemId,field}` 隔离的 `fragmentSequence`；无法可靠合成时省略该字段，禁止复用全局 streamSequence。
- [x] 2.4 先补失败测试覆盖全局 backlog gap、rollback barrier 和 overflow 同时影响多个 thread、cursor 早于 owner retention，以及 barrier 必须先于新 generation event 广播。
- [x] 2.5 实现覆盖 replay horizon 的 per-sequence owner ledger、`affectedThreadIds`/逐 thread barrier 和 rollback generation 广播；ledger/boot 无法覆盖时发送 `scope: all-tracked`，客户端只 repair 本地 cached/visible threads。
- [x] 2.6 先补失败测试覆盖 latest page 在持久化滞后时缺少 live item、repair 构建期间又到达 watermark 后 event，以及 metadata/page stamp 不一致。
- [x] 2.7 让 bounded latest-page 在上游 page 读取完成后于同步临界区原子捕获 `{pageWatermark,overlaySnapshot}`，合并同 stamp、watermark 内的 overlay，并返回 inclusive window anchors、`preservedThrough`、cursor 与 completeness。

## 3. 浏览器事件队列与 HistoryStamp 屏障

- [x] 3.1 先补失败测试覆盖 timer 已 flush 的旧 event A、仍在 batch 的新 event B、listener 注册后错误交付 B→A，以及 drain 中到达 event C 的顺序。
- [x] 3.2 将 `pendingEvents` 与 `pendingDeltaBatches` 收敛为单一有序 delivery queue，listener 恢复时先 drain 旧 envelope，新 event 必须排在队尾，batch 只控制 commit 边界。
- [x] 3.3 先补失败测试覆盖多个 thread 的 listener buffer overflow、ownerless batch overflow、gap/rollback 使 pending batch 失效和新 stamp 事件越过 barrier。
- [x] 3.4 实现按 thread 的 delivery epoch、完整 owner gap 集合和 flush 前 stamp/suppression 复验，跨 boot 或不可排序队列转为 scoped repair。
- [x] 3.5 更新 event client/store 只对同 identity/field 的 `fragmentSequence` 执行连续检查；legacy 事件依赖 `{bootId,eventId}`/revision 幂等，不做文本前缀 suppression。

## 4. Timeline 强身份、排序与账本

- [x] 4.1 先补失败测试覆盖同 turn 相同/包含文本的不同 agent/reasoning itemId、重复 tool/file 执行、同 ID 跨 generation 重用和无条件 `:live` completion 错绑。
- [x] 4.2 将 engine identity 统一为 `{HistoryStamp,turnId,itemId}`，optimistic user 使用 `clientUserMessageId`；移除不同强 identity 间的文本、metadata、路径和数组位置合并。
- [x] 4.3 为缺 itemId 输入实现 canonical source locator 与显式 synthetic alias；无法取得稳定 absolute locator 时分配不可合并 identity 并请求 bounded repair。
- [x] 4.4 将 rollout/session supplement 匹配改为一对一消费，并补两次相同工具执行、重复 file path 和 `agent,tool,agent` 文本锚点的顺序测试。
- [x] 4.5 让 before/after anchor 按完整 HistoryStamp + turn + item identity 解析并优先于 source-local ordinal；歧义 anchor 必须失败关闭为 repair/保留当前位置。
- [x] 4.6 修正 event/revision/suppression ledger 分段与容量：legacy 无 generation suppression 在 barrier 后失效，每个逻辑 event 只占一个容量槽，补超过声明窗口的重放测试。

## 5. 权威窗口修复与分页协调

- [x] 5.1 先补页面失败测试覆盖 initial read pending 时只发生 SSE 更新、旧 metadata/page 回写 idle、旧 repair Promise 清除新 generation token 和旧 history page prepend 到新历史。
- [x] 5.2 让 initial、repair 和 history-page 请求捕获 `{threadId,HistoryStamp,mutation/delivery epoch,request token}`，并在提交与 cleanup 时逐项校验；repair key 加入 reason 与目标 turn/item。
- [x] 5.3 为 live、snapshot/repair/supplement 和 local/optimistic entry 分别记录 stream fence、baselineWatermark 和 client mutation fence；实现 `replace-latest-window` 删除已覆盖或无 fence的 pre-baseline stale entry，并保留 watermark 后 live、unresolved optimistic item 和更旧历史。
- [x] 5.4 实现 HistoryStamp 原子 transition：同 boot generation bump 按 `preservedThrough` rebase；boot 改变按唯一 common-prefix rebase，无法证明时清空该 thread 缓存窗口并重建。
- [x] 5.5 让 repair window 与已加载旧页通过 anchor/cursor 桥接，强 identity 去重重叠 page；`nextCursor: null` 必须清除旧 cursor，旧 stamp cursor/response 不得提交。
- [x] 5.6 修正 turn-detail coordinator：后续页失败保留已成功页面并返回 partial/repair-required，重复 identity 选择更新 revision/更完整正文，移除 first-wins 与固定页数假完整。
- [x] 5.7 保留 completion repair 的 `{threadId,turnId,HistoryStamp,reason,attempt}`，瞬时失败或 persistence lag 只递增 attempt；旧 token 的 success/failure/finally 不得清理新 repair。

## 6. 正文完整性单调合并

- [x] 6.1 先补失败测试覆盖普通 live 全文被 truncated snapshot 覆盖、user/diff 的 `complete + preview`、空 completion 丢 contentRef、空 truncated reasoning 在 finalize 消失和冲突 complete candidates。
- [x] 6.2 为所有可见 kind 提取统一 `ContentCandidate`，实现 `(integrity,includedBytes,authority,revision)` 比较和 prefix compatibility；不可排序冲突必须保留当前正文并标记 scoped repair-required。
- [x] 6.3 分离 lifecycle status 与 content completeness，落实 status-only 空正文白名单；agent/user/reasoning/diff/error 空 completion 不得完成或清空正文。
- [x] 6.4 让 continuation 与正文候选同步合并：有效 contentRef 不得被空 completion 删除，full-content chunks 原位完成正文，repair-required 保留到成功修复。
- [x] 6.5 调整 turn finalize，仅删除真正无正文、无 contentRef、无诊断价值的占位 reasoning，并验证 tool/command/file 状态更新不改变可见顺序。

## 7. App-server notification 与字节流适配

- [x] 7.1 先补 adapter 失败测试覆盖当前 `item/fileChange/patchUpdated`、废弃 `outputDelta` 兼容、同 turn 两个无 ID response items 和跨分页 ordinal 重置。
- [x] 7.2 实现 `patchUpdated` 归一化及 file item 强身份原位完成；无 ID response/rollout item 使用 response/event canonical locator，禁止 type 或页内 ordinal identity。
- [x] 7.3 先补 emoji bytes 拆成 2+2 chunk、stdout/stderr 交错、两个 process 交错及 `capReached: true` 的失败测试。
- [x] 7.4 使用按 connection/process/stream 隔离的流式 `TextDecoder` 聚合 base64 bytes，在 completion、generation barrier 与连接关闭时释放状态，并把 capReached 转为 truncated continuation/repair-required。
- [x] 7.5 扩展 oversize reference builder 到所有可见 kind，保留 HistoryStamp、identity、sourceOrder、originalBytes、preview 和 contentRef；无法生成 continuation 时发送 scoped repair-required envelope。

## 8. Turn start 模糊失败幂等

- [x] 8.1 先补失败测试模拟服务端已接受 `turn/start` 但 HTTP 响应超时，确认当前 retry 会生成新 ID 并启动第二个 turn；再覆盖 gateway boot 变化后的未决重试。
- [x] 8.2 让失败 optimistic user entry 持久保存 `clientUserMessageId`、payload fingerprint、发起 bootId 和 outcome；同 boot ambiguous retry 复用原 ID，用户编辑或明确新动作才生成新 ID。
- [x] 8.3 延长并按 thread 管理同 boot 的 start idempotency record，使重复请求返回同一 turn/result；明确拒绝必须证明 app-server 未创建 turn。
- [x] 8.4 boot 改变后先通过 app-server client-id 查询能力或 bounded latest-page 唯一确认原动作；无法证明时返回 `ambiguous-start-unresolved` 且不得再次调用 app-server `turn/start`。
- [x] 8.5 更新失败消息交互与中文错误状态，允许刷新恢复或由用户明确确认“作为新发送动作”提交，同时保留原附件与 skill 引用。

## 9. 组合验证与兼容收尾

- [x] 9.1 运行并修复 timeline engine、store events、event client、thread page、runtime、events adapter、SSE route 和 request coordinator 的定向测试，确保所有新增红灯场景转绿。
- [x] 9.2 增加服务重启、交错 fragment、首屏 SSE 竞态、rollback generation、watermark 后 live、persistence lag 和 ambiguous start 的端到端组合 fixture。
- [x] 9.3 验证 legacy payload：缺 boot/stamp 的 snapshot 只能初始化空状态，旧 `sequence` 只作 stream cursor，旧 file output delta 不得与新 patchUpdated 重复。
- [x] 9.4 运行 `npm run typecheck`、`npm run test`、`npm run build` 与 `openspec validate harden-timeline-event-recovery --type change --strict`，记录实际通过数量和任何显式跳过项。
- [x] 9.5 检查人工文档均使用中文、未手改 `docs/generated/`、未扩大完整 timeline API；用 forced gateway restart 和当前真实会话的桌面/手机视口 smoke test 验证迁移、默认折叠、点击展开与失败关闭路径，并保存验收截图。

## 10. Codex App 对齐的紧凑会话展示

- [x] 10.1 先补 user message 转换失败测试，覆盖完整 ambient browser context、附件说明 + request marker、普通 XML/Markdown 和不完整 marker，证明只清洗可信注入包装并保留图片、Skill 引用与消息身份。
- [x] 10.2 实现纯 `visibleUserMessageText` 清洗 helper，并在 snapshot、history、live completion 与 optimistic/retry 共用的 user entry 归一化入口应用，禁止在 JSX 中临时修改 identity 或发送 payload。
- [x] 10.3 先补 Timeline 失败测试，覆盖完成态 reasoning 全部隐藏、running turn 最多一个临时 `Thinking...`、新 activity 到达后占位消失，以及 user/assistant/activity 均无相对时间。
- [x] 10.4 实现 reasoning 展示过滤和单一运行占位，移除 `TimelineRelativeTime` 及其样式；底层 reasoning identity、正文、completeness 与 contentRef 必须保持不变。
- [x] 10.5 先补密集 activity 失败测试：同一段 reasoning、read、Skill、Subagent、command、file、MCP tool 在折叠态只占一个自然动作标题；第一次展开只显示按原顺序排列的动作行，stdout/diff 保持隐藏；第二次点击单项才显示详情，失败标记可见，重复 Subagent 按 `agentThreadId` 计数。
- [x] 10.6 新增纯 timeline presentation 分类/标题 helper 并接入 `Timeline`：结构化 metadata 优先，`SKILL.md` 路径和 Subagent JSON 仅作严格 fallback；标题禁止“N 个文件”统计串，动作行必须显示具体 path/command，解析失败降级为通用工具。
- [x] 10.7 先补真实 goal continuation user item 的转换失败测试，要求完整 `source="goal"` 包装只显示唯一 objective，并证明普通、不完整或多 objective 的相似 XML 原样保留。
- [x] 10.8 扩展 `visibleUserMessageText` 严格提取可信 goal objective，禁止把 continuation/budget/audit 内置提示或空白 user row带入 JSX，同时保留底层消息 identity 与附件元数据。
- [x] 10.9 先补 session supplement 失败测试，覆盖大于 1 MB rollout 的有界源窗口、单/多 nested `tools.exec_command`、read/list/search/command 映射、stdout 分段匹配、动态参数失败关闭与稳定子调用 identity。
- [x] 10.10 实现按 page turn ID 过滤的有界 rollout reader 与 custom exec 静态提取器，接入 detail/page supplement 和 contentRef 续读；不得执行输入、无界读取超大文件或覆盖原生 file/MCP item。
- [x] 10.11 先补 activity 两级交互与视觉契约测试：顶层无装饰图标和计数标题，第一次展开有语义图标/具体动作但无 stdout/diff，第二次展开显示状态化 stdout 或结构化 diff，手机宽度无水平溢出。
- [x] 10.12 使用 `lucide-react` 重做 activity、stdout 与 diff UI，并删除旧 `InlineActivitySection`、emoji/字符图标、直接展开详情和废弃样式；保持长内容有界预览、复制与 contentRef 行为。
- [x] 10.13 先补图片预览失败测试，覆盖本地 preview route 加载失败、无原生破图图标、尺寸稳定失败占位、重试后成功与弹层失败关闭。
- [x] 10.14 重做 `ImageThumb`/预览弹层加载状态，失败时卸载 `<img>` 并显示中文重试占位，保留附件 identity、受控 preview route 与手机宽度。
- [x] 10.15 先补上下文压缩生命周期失败测试，覆盖 `item/started(contextCompaction)` 立即可见、同 identity completed 原位替换、旧 started 不覆盖完成态、刷新历史只显示完成态。
- [x] 10.16 在 app-server notification adapter、runtime overlay 与 Web timeline 归一化链路中实现 context compaction running/success 状态，并与 Codex App 的 lifecycle 规则对齐。
- [x] 10.17 先补折叠后历史补页失败测试，覆盖内容不足一屏自动加载、连续 cursor 补页、到达开头停止、同 cursor 并发去重和 prepend 锚点不跳动。
- [x] 10.18 抽取统一 `loadOlderHistory`，为 timeline 内容容器接入尺寸变化检测，在折叠后无滚动距离时自动补页，保留 HistoryStamp/request guard 与失败关闭。
- [x] 10.19 重启真实服务后核对当前会话 API 与 DOM，确认 recovered rollout actions 包含 read/search/list/bash command、Skill、Subagent、MCP 与 file edit；缺失类别必须在 adapter/supplement 层修复后再截图验收。
- [x] 10.20 先补真实默认路径与分页稳定性失败测试：app-server 返回的 `CODEX_HOME/sessions` rollout 可被受控只读扫描，其他工作区外路径仍拒绝；历史页重叠项不得改写当前可见正文，prepend 后首个可见锚点与屏幕位置保持不变。
- [x] 10.21 修复真实 rollout 路径策略、分页重叠合并与滚动锚定；上拉和折叠自动补页期间不得出现消息跳动、正文突然变长或重复补录，并用当前真实会话连续滚动验收。
- [x] 10.22 先补 Timeline 视觉契约失败测试：非 Thinking 的顶层折叠摘要显示一个主要动作 Lucide 语义图标；短 user message 为右对齐内容宽气泡，长消息受最大宽度约束且无蓝色左边条。
- [x] 10.23 实现 activity summary 语义图标与 Codex App 风格 user bubble，保留图片、Skill、失败重试和长按菜单，并在当前真实会话的桌面/390px 手机视口重新截图。
- [x] 10.24 先补 event client 与页面红灯测试：连续错误发出真实 `1/5`、`2/5` attempt，open/close 归零；thread 内只显示一个带 Wi-Fi 图标的轻量重连活动行，且不存在旧全宽警告 banner。
- [x] 10.25 实现重连 attempt 传递、共享轻量状态行与 thread timeline 集成，并在服务重启的真实桌面/390px 手机视口截图确认开始可见、次数原位更新和恢复后消失。
