## Why

当前 timeline 事件链路在全局事件序号、客户端 fragment 连续性、首屏快照、缺口修复和 history generation 之间缺少一致的权威边界。已确认的竞态会导致实时正文缺段、旧快照永久删除新消息、rollback 后旧内容回流、不同 item 被文本 fallback 合并，以及 truncated 内容失去续读能力；现有测试全部通过但没有覆盖这些跨层时序。

这些问题位于移动端聊天的核心数据路径，并且会在断线恢复、服务重启、并发工具输出和持久化延迟等正常运行条件下触发，需要通过一次跨服务端事件传输、前端 reducer 和恢复协调器的统一修复建立可验证的一致性协议。

## What Changes

- 分离事件流全局顺序与单 item fragment 顺序：全局 cursor 只用于传输重放，fragment 连续性只使用同 identity 的独立序号；所有事件身份加入不可碰撞的服务启动 epoch。
- 将 backlog 缺口、rollback generation bump 和 listener overflow 归属到完整的受影响 thread 集合，并保证客户端按 thread 建立 delivery barrier 后再恢复。
- 定义 latest-page repair 的权威窗口语义：替换无法确认的最新尾部、保留已加载的更旧分页历史，并合并同 generation 的 runtime live overlay；旧 initial、repair 和 history-page 响应不得覆盖更新后的状态。
- 使 metadata、latest page、repair 请求、pagination cursor、event ledger、snapshot suppression 和 identity matching 全部绑定同一 history generation；新 generation 不得复用旧响应、旧正文或旧去重账本。
- 移除跨强 identity 的文本相同/包含去重和无条件 `:live` 合并；只有稳定 identity 或显式 source anchor 能合并条目，不同 itemId 的 agent、reasoning、tool 和 file items 必须独立保留并维持事件位置。
- 统一所有可见 item kind 的正文完整性合并：complete 正文不得被较短 preview 覆盖，空 completion 不得删除有效 `contentRef`，带 continuation 的空 reasoning 不得在 finalize 时消失。
- 修正 app-server notification 适配，支持当前 `item/fileChange/patchUpdated`，为合法的无 ID response item 生成不碰撞身份，并以流式 UTF-8 解码保存跨 chunk 字符和截断状态。
- 让 repair 请求按 thread、generation、reason 和目标 turn/item 去重；重试必须保持原始恢复身份，旧 generation 的完成或失败不得清除新 generation 的 repair。
- 让 `turn/start` 的模糊失败继续使用原 `clientUserMessageId` 查询或重试，只有确认上一动作未被接受或用户明确开始新发送动作时才生成新幂等键。
- 对齐 Codex App/VS Code 的会话展示语义：完成态 reasoning 只保留在 normalized 数据中，不再渲染持久 `Thinking` 行；同 turn 的连续工具活动合并为一个自然动作标题，第一次展开只显示 read/edit/command/Skill/Subagent/MCP 等动作清单，第二次点击单项才显示 stdout、diff 或参数详情。
- 从超大 rollout 的有界源窗口按当前 page turn IDs 过滤补齐 app-server 未暴露的 custom tool call；只静态提取可证明的 `exec_command` 等已知子调用，恢复 read/list/search/command/Skill/Subagent 语义，无法证明的调用保守降级或隐藏外层编排项。
- 重做 activity detail：stdout 使用命令头、状态、等宽可滚动输出与复制入口；diff 使用紧凑文件头、增删统计、双行号和语义着色；顶层移除无意义图标和生硬的“N 个文件”计数标题。
- 为顶层 activity 摘要补充主要动作的 Lucide 语义图标，并将 user message 改为 Codex App 风格的右对齐、内容自适应浅灰气泡，取消全宽灰带和蓝色左边条。
- 将断线重连提示改为 Codex App 风格的轻量活动行：使用 Wi-Fi 语义图标、真实重试次数和 `正在重新连接 N/5` 文案，thread 内跟随 timeline 展示，移除全宽警告色横幅。
- 清洗 Codex 注入到服务端 user item 的已知 ambient context、附件说明和 goal internal context 包装，只展示真实用户请求或目标 objective，同时保留图片、skill 引用和稳定消息身份；移除 timeline 的逐条相对时间。
- 对齐 Codex App 的上下文压缩生命周期：自动压缩开始时立即显示运行状态，完成后以同一 item 原位更新，并修复会话图片附件的破图降级展示。
- 修复活动折叠后内容不足一屏时无法滚到顶部加载历史的问题：视口未填满时自动有界补页，并用当前真实会话确认 read、Subagent、bash/command 等动作均可恢复和展示。
- 增加跨 gateway、event client、timeline engine、页面恢复和协议 adapter 的组合回归测试，覆盖已审计出的最小时序。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`: 明确全局传输 cursor、per-item fragment sequence、boot epoch、generation barrier、thread-scoped gap、权威尾部替换、稳定 identity 与跨来源顺序规则。
- `timeline-content-completeness`: 强化所有可见 item kind 的单调完整性合并、空 completion、continuation 保留、分页 partial 结果和 UTF-8 chunk 语义。
- `agent-output-rendering`: 移除不同强 identity 间的等价文本去重，并把 normalized reasoning/tool 数据与紧凑展示策略分离；完成态 reasoning 隐藏，工具按 Skill、Subagent、文件、命令和通用工具聚合折叠。
- `frontend-request-deduplication`: 使 initial read、repair 和 history pagination 的请求 key、取消和结果提交绑定 generation，并保持 completion repair 的原始作用域。
- `thread-chat-view`: 明确首屏读取、实时事件和权威 latest-page repair 的提交顺序，以及只替换未知最新尾部、保留已加载历史的窗口语义。
- `turn-interaction`: 区分明确拒绝与结果未知的 `turn/start` 失败，保证模糊失败重试复用原发送动作的幂等身份。
- `appserver-remaining-protocols`: 补齐当前 file change notification、无 ID response item 与 command/process 字节流的事件归一化要求。

## Impact

- 服务端事件 gateway 与恢复来源：`src/server/app-server/runtime.ts`、`src/server/app-server/events.ts`、`src/server/app-server/session-timeline.ts`、`src/app/api/codex/events/route.ts`。
- 前端事件接收与恢复协调：`src/web/events/client.ts`、`src/app/threads/[threadId]/page.tsx`、`src/web/api/requestCoordinator.ts`。
- Timeline 状态与适配：`src/web/state/timeline-engine.ts`、`src/web/state/timeline-adapter.ts`、`src/web/state/store.ts` 及共享 API/event 类型。
- Timeline 展示派生：新增纯展示分类/清洗 helper，调整 `src/web/components/Timeline.tsx`，不改变底层 entry identity、恢复窗口或公开 API。
- 发送幂等：`turn/start` route、服务端幂等缓存和失败用户消息的 retry metadata。
- 测试：新增跨层 fixture 和定向竞态测试，并更新现有错误地固化文本 fallback、repair merge 或废弃 notification 的断言。
- UI 图标统一使用 `lucide-react` 的语义线性图标；公开 API/event payload 将新增或明确 epoch、sequence scope、generation 和 repair scope 字段，旧进程内事件不保证跨服务重启继续重放。
