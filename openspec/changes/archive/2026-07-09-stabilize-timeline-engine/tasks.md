## 1. 测试基线与归一化模型

- [x] 1.1 新增 timeline engine 类型草案，覆盖 snapshot、pagination、live event、batch、overlay、turn item、rollout supplement、optimistic user 和 rollback/fork replace 输入
- [x] 1.2 为用户消息回显去重补失败测试，覆盖 optimistic user、`turn/start` 返回、server user item、相同文本重复发送和 Skill/图片附件保留
- [x] 1.3 为 agent/reasoning/tool/diff 去重补失败测试，覆盖 live delta、completed item、snapshot repair、overlay 和 rollout supplement 多来源合并
- [x] 1.4 为上下文压缩消息去重补失败测试，覆盖 live compact、snapshot compact、overlay compact 和 rollout activity compact
- [x] 1.5 为同 turn 顺序补失败测试，覆盖多 user item、steer、reasoning/tool/agent 交错、diff 与 command activity 相对顺序
- [x] 1.6 为 generation 隔离补失败测试，覆盖 rollback/fork 后 item id 复用、旧 generation late event、deleted-turn barrier 和 snapshot suppression

## 2. Timeline engine 实现

- [x] 2.1 新增或抽出 `src/web/state/timeline-engine.ts`，实现 `applyTimelineInput` 纯函数 reducer 和 normalized state
- [x] 2.2 实现 `identityKey` 派生规则，优先使用 `clientUserMessageId`、generation、turnId、itemId、tool call id、event id，文本相似仅作为受限 fallback
- [x] 2.3 实现 `orderKey` 派生规则，按 turn order、server item order、event sequence、source order 保留同 turn 真实顺序
- [x] 2.4 实现 event id、revision、snapshot suppression 和 deleted-turn barrier 账本，并按 thread generation 隔离
- [x] 2.5 实现 ordered distinct turns selector，供 rewind/fork 尾部 turn 计算和可用性判断使用
- [x] 2.6 增加 engine diagnostics 计数或状态，用于记录身份缺失、身份冲突、fallback 去重、repair request 和丢弃旧 generation event

## 3. 前端 store 与事件流接入

- [x] 3.1 将 `setThreadEntries`、`mergeThreadEntries`、`prependEntries`、snapshot repair 和 pagination merge 改为构造 `TimelineInput` 后提交 timeline engine
- [x] 3.2 将 SSE live event、event batch、replay、listener buffer 和 `timeline-gap` 处理改为通过 timeline engine upsert，不再绕过统一身份/排序规则
- [x] 3.3 将 optimistic user message、`turn/start` 确认、server user item 确认和 completion 后 repair 合并到同一 user identity 流程
- [x] 3.4 确保 batch 仅作为 UI commit 优化，batch flush 前发生 gap、rollback 或 generation bump 时重新校验或丢弃未提交 delta
- [x] 3.5 调整 listener 空窗和 buffer overflow 逻辑，能确定 threadId 时产生对应 thread 的 bounded repair，无法确定时非破坏性降级
- [x] 3.6 保留近期 processed event id 和 revision 信息，使 repair/replay 后不会重复追加已处理 live 输出

## 4. 服务端读取与 supplement 有界化

- [x] 4.1 审查并调整 `thread/read`、`thread/turns/list`、snapshot repair 和 turn item 补齐路径，确保默认 limit 和服务端 limit 上限一致生效
- [x] 4.2 修改 `session-timeline.ts` 的 rollout supplement，使首屏、分页和 repair 只补齐当前 window/page/目标 turn 范围内的信息
- [x] 4.3 修改 context usage 获取策略，避免为了 header 或 timeline 信息完整解析完整 rollout JSONL
- [x] 4.4 为 rollout supplement 增加预算和可跳过策略，超出预算时不阻塞主 timeline 返回
- [x] 4.5 调整服务端 backlog/replay 逻辑，遵守 generation 和 deleted-turn barrier；无法可靠过滤时发送带 threadId 的 `timeline-gap`

## 5. 渲染与消息操作收敛

- [x] 5.1 将 Timeline 渲染改为消费 normalized entries 或可见窗口 selector，移除渲染层重复去重和排序职责
- [x] 5.2 保持长 Markdown、reasoning、tool result、command output、diff 和 raw response fallback 的窗口化与懒渲染，避免全量 DOM/Markdown 工作
- [x] 5.3 调整 inline activity 分组，使分组内部按 engine orderKey 渲染，不按类型重排同 turn 活动
- [x] 5.4 将消息级 rewind/fork 的目标解析和尾部 turn 计算改为使用 engine-derived stable identity 与 ordered distinct turns
- [x] 5.5 在 turn 身份、generation、item identity 或尾部范围缺失/歧义时禁用 rewind/fork，并保留复制操作和可理解反馈
- [x] 5.6 确保 timeline 高频更新、repair 和 pagination 不重置 composer 草稿、图片附件、Skill 选择和打开中的非 timeline 面板

## 6. 回归验证

- [x] 6.1 增加长会话有界读取测试，验证首屏、分页、repair、turn item 补齐和 rollout supplement 不触发完整 turns 或完整 JSONL 读取
- [x] 6.2 增加运行中自动流式更新测试，覆盖正常 SSE、completion 后无可见输出、listener 空窗恢复和 reconnect gap repair
- [x] 6.3 增加 rewind/fork 回归测试，覆盖相同文本多 turn、同 turn 多 user/steer、fork-local target 缺失和 resend 后旧 late event 屏蔽
- [x] 6.4 增加性能回归测试或轻量 instrumentation，验证大会话分页、repair 和高频 delta 不导致整页重算或全量 DOM 挂载
- [x] 6.5 运行 `npm run typecheck` 和相关 Vitest 测试，最后运行 `npm run verify`；如完整验证受环境限制，记录未执行项和原因
