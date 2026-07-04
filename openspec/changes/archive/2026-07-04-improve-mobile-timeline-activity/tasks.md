## 1. 事件与数据契约

- [x] 1.1 阅读生成协议中 Skills 相关通知类型，确认 Skills 加载/变更事件的 method 名称、payload 字段和 thread/turn 归属能力
- [x] 1.2 在 `src/shared/codex.ts` 或相关共享类型中补充浏览器可消费的 Skills 事件或带 scope 的 settings invalidation 类型
- [x] 1.3 在 `src/server/app-server/events.ts` 中归一化 Skills 加载/变更通知，并保留 `eventId`、`sequence`、`revision`、`generation` 等事件身份
- [x] 1.4 在 `rawResponseTimelineItem()` 中补齐 `message` / `agent_message` 等 raw response item 的可读化转换，避免默认显示原始 JSON
- [x] 1.5 为 read/list/search、shell/bash、MCP/dynamic、file/image/web 等工具活动保留可用于摘要的结构化元数据，缺失时提供通用兜底
- [x] 1.6 审计生成协议和真实事件样本中最终 assistant 回复的通知 variant，覆盖 `item/agentMessage/delta`、`item/completed`、`rawResponseItem/completed`、`turn/completed` 以及当前 app-server 可能使用的等价 method
- [x] 1.7 确认 `turn_completed`、item id、turn id、revision 和 generation 在浏览器事件中的关联方式，使后续 repair 能判断“该 turn 已完成但没有可见 server entry”

## 2. Store 与缓存失效

- [x] 2.1 为 Skills 事件增加 store 消费逻辑：无 thread 归属时只做 Skills picker 缓存失效，不追加当前会话 timeline
- [x] 2.2 为具备 thread/turn 归属的 Skills 加载事件创建可见 timeline 活动源 entry，并复用现有事件去重、generation 和 revision 判断
- [x] 2.3 为 ChatInput 的 Skills picker 增加缓存版本或失效信号，使 Skills 变更后下一次打开会重新请求 `/api/codex/skills`
- [x] 2.4 修复失败用户消息重试时丢失 `skillReferences` 的问题，确保重试请求和新 timeline 用户消息继续携带 Skill chips
- [x] 2.5 跟踪 active turn 是否已经收到可见 server entry；当 `turn_completed` 到达或等待超过阈值仍没有可见 entry 时，触发 snapshot repair/read thread
- [x] 2.6 为 `startTurn` 只返回 `{ turnId }` 的路径补齐兜底合并逻辑，确保没有 live item 事件时也能从 thread history 修复回复，并避免迟到 live event 重复插入

## 3. Timeline 活动分组

- [x] 3.1 新增纯函数将 `TimelineEntry[]` 派生为移动端 `TimelineRenderBlock[]`，按 turn 聚合连续 reasoning/tool/command/diff/skill 活动
- [x] 3.2 实现 activity block 摘要模型，支持 `Thinking`、`Skills loaded`、`Read files`、`Searched files`、`Ran commands`、`Used tools`、`Files changed` 和失败状态
- [x] 3.3 实现纯文本预览清洗和短路径展示，移除 Markdown 控制标记并避免绝对路径或长 JSON 占据折叠态
- [x] 3.4 确保 activity 分组不改变 rewind、fork、snapshot repair、跳到最新和自动滚动使用的底层 timeline entry 语义

## 4. 移动端 UI 呈现

- [x] 4.1 将 Reasoning/Thinking UI 文案改为运行中 `Thinking...`、完成后 `Thinking`，并保持可展开查看公开 reasoning 内容
- [x] 4.2 新增或改造 Activity UI 组件，使摘要默认轻量显示，展开后展示原始工具、命令、参数、输出、路径和 diff 详情
- [x] 4.3 将文件变更默认呈现为 `Files changed · N · +A -R` 汇总，展开后仍可逐文件查看 unified diff
- [x] 4.4 调整工具、命令、diff、Skills 活动的移动端 spacing、字号、溢出和失败态，确保手机宽度下不互相重叠

## 5. 测试与验证

- [x] 5.1 为 app-server 事件转换补充单元测试，覆盖 Skills 通知、raw response message/agent_message、read/list/search/tool fallback
- [x] 5.2 为 store 事件消费补充单元测试，覆盖 Skills 缓存失效、thread-scoped Skills activity、重复事件和旧 generation 忽略
- [x] 5.3 为 timeline 派生分组补充单元测试，覆盖 Thinking、工具活动聚合、失败摘要、diff 汇总和展开详情数据
- [x] 5.4 为移动端 React 渲染补充测试，覆盖 `Thinking` 标题、activity 摘要、Skill chips 重试保留和长文本/路径不溢出
- [x] 5.5 为发送消息后的实时可见性补充测试，覆盖 `startTurn` 只返回 `turnId`、live agent item 正常到达、`turn_completed` 到达但无可见 entry 时触发 repair、repair 后迟到 live event 不重复
- [x] 5.6 为权限切换后的发送路径补充手动验证，至少覆盖 `:workspace + auto_review`（界面文案为“替我审批”）场景，确认回复无需刷新可见且该权限语义不被误判为 full access
- [x] 5.7 运行相关测试集：`npm test -- tests/unit/app-server-events.test.ts tests/unit/app-server-timeline-item.test.ts tests/unit/web-store-events.test.ts tests/unit/web-timeline-conversion.test.ts tests/unit/web-timeline.test.tsx tests/unit/web-chat-input.test.tsx tests/unit/user-input.test.ts tests/unit/codex-turn-start-route.test.ts`
- [x] 5.8 使用手机视口手动检查一条包含 Thinking、Skills、read/search、bash、diff 和最终回答的 turn，确认首屏信息层级、无需刷新可见性与展开交互符合 spec

## 6. 真实 Codex App 活动源追踪

- [x] 6.1 以真实线程对比 Codex App 与 Web：记录主 `thread/read` timeline、SSE live events、raw response events、turn item 分页和 Codex App 截图中的 activity 差异。
- [x] 6.2 确认「已读取文件 / 已运行命令」是否来自未接入的 app-server notification、未支持的 `thread/turns/items/list`、raw response item，还是 Codex App 本地活动账本。
- [x] 6.3 已确认本次真实缺口不需要新增 app-server notification 适配；现有 `src/server/app-server/events.ts` 已覆盖 commandExecution started/completed/output delta 的归一化。
- [x] 6.4 若活动来自 turn item 分页，补齐 gateway/API 对 `thread/turns/items/list` 的支持，并让 snapshot repair 能合并该分页中的 command/read/search 活动。
- [x] 6.5 为真实缺口补回归测试：模拟一个 turn 中有命令执行但主 timeline 只有 agent 文本，确认 Web 能通过新数据源显示 `Read files` / `Ran commands` activity。
- [x] 6.6 在手机视口重新验证 Docker 部署类 turn，确认执行命令、读取文件、构建失败/成功状态和最终回答都无需刷新可见。
- [x] 6.7 修复同一 turn 内 activity 被 role rank 提前集中到用户消息之后的问题，确保 assistant 消息与 activity 按真实顺序穿插展示，并补充回归测试。
