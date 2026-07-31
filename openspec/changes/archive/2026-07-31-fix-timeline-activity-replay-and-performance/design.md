## Context

当前 timeline 同时消费 app-server item page、live events/runtime overlay、完成态 item、`turn_diff_updated` 和 rollout JSONL supplement。展示层只按 normalized entries 的相邻关系聚合 activity，因此任何上游重复或错序都会直接表现为重复 edit、command 集中到消息末尾或刷新前后分组不一致。

已确认的四个缺口是：

1. 同一文件修改会同时产生 turn 级 diff entry 和 item 级 file tool entry；两者 identity 不同，实时阶段会显示两次，刷新后只保留持久化 item。
2. `mergeTurnSessionRecords` 找到 canonical base tool 后只消费 supplement record，却仍在 base 原位置输出该 tool。若 page 为 `agent A, agent B, command A, command B`，即使 supplement 证明真实顺序为 `command A, agent A, command B, agent B`，结果仍保持错误的末尾工具顺序。
3. activity block 第一层由 `presentation.failed` 直接渲染“失败”，且现行规格要求该状态可见；用户期望第一层只表达动作，状态下沉到动作行与详情。
4. latest page 名义上是 item 分页，但无 cursor 时会额外读取最近 30 个 `itemsView: full` turns；metadata 与 page 还会分别扫描同一 rollout 文件。长会话刷新或 completion repair 因此产生重复 RPC、重复磁盘扫描和放大的重试成本。

约束包括：继续使用 item 级有界分页；不修改公开 API 路径；不修改 `docs/generated/`；不通过展示层文本、路径或统计值猜测不同稳定 identity 等价；supplement 仍是可降级信息源。

## Goals / Non-Goals

**Goals:**

- live、completion repair、pagination 和刷新对同一文件修改只显示一个 canonical activity。
- canonical page 中位置错误但 identity 正确的 tool 能按唯一 rollout message anchor 回到真实位置。
- activity block 第一层保持中性，不显示成功、失败或运行状态；具体动作仍可定位错误。
- 首屏与 repair 在 item ownership、turn 读取和 rollout 扫描三个层面都保持有界，并复用同一文件 revision 的昂贵读取。
- 用真实错误形态贯穿 server、store、page 与 presentation 的回归测试。

**Non-Goals:**

- 不改变 activity 的两级展开结构、图标体系、摘要动作分类或移动端整体布局。
- 不合并两个不同稳定 itemId 的 file changes 或 commands。
- 不保证为所有旧 rollout 历史恢复完整 nested activity；预算不足时允许省略 supplement。
- 不增加新的后台轮询、数据库迁移或第三方依赖。

## Decisions

### 1. Item 级 file change 是 canonical 可见活动

`turn_diff_updated` 继续作为兼容旧 app-server 或 item 事件缺失时的 provisional turn-level fallback。只要同一 HistoryStamp 和 turn 收到任一带稳定 itemId 的 `file_output_delta`、file completed item、snapshot 或 repair item，item 级 entries 即成为 canonical 可见文件活动，provisional turn diff 必须从可见 timeline 移除或被抑制；后续 turn diff 不再创建第二条可见 activity。

多个不同 itemId 的 file changes 继续独立保留。系统不使用 diff 文本、路径或增删统计建立跨 identity 等价关系；turn diff 只按来源优先级退场，而不是按内容猜测与某个 item 合并。

备选方案是在 presentation 中折叠相同路径和统计。该方案会错误吞掉真实的重复编辑，也无法让 store、rewind、repair 和刷新共享同一事实源，因此不采用。

### 2. Supplement 匹配同时决定 canonical item 的位置

session reconciler 将“匹配 identity”和“输出位置”合并为一个 placement 过程：

1. 先为 supplement tool record 解析强 identity、source locator 或唯一 message-anchor interval。
2. 若命中已有 base tool，保留 base tool 的 canonical body、status 和 metadata，但在 supplement record 对应的位置输出它，并标记原 base index 已输出。
3. 后续遍历到该 base 原位置时跳过，避免末尾再次出现。
4. supplement 中不存在于 base 的 activity 继续按 anchor 插入；未匹配 base items 保持 base 来源内顺序。
5. message anchor 不唯一或只能依赖 tool metadata 时不移动、不消费，保留候选或标记 repair-required。

placement 必须受当前 page/turn window 约束。只有 anchor target 在当前 canonical window 内唯一可解析时才允许重定位；前端 adapter 只为服务端结果附加 source-order metadata，不负责二次排序。

备选方案是让展示层把所有 command 移到 assistant 前方。该方案无法区分中途 commentary 与最终回复，会重现上一轮已修复的问题，因此不采用。

### 3. 顶层 activity 摘要不携带执行状态

`ActivityPresentation` 可以继续计算失败状态供动作行或诊断使用，但顶层 disclosure 的可见文本、图标附加标记和 aria-label 均只描述动作摘要，不附加成功、失败或运行状态。用户展开后，失败动作行显示中文状态或警示图标；单条详情继续显示命令、参数、输出和状态。

这是一项规格变化，不是仅删除一个文案。相关测试必须同时断言顶层中性和展开后错误仍可定位。

备选方案是只隐藏“失败”文字但保留红色警示图标。该方案仍在第一层表达失败，与用户要求不一致，因此不采用。

### 4. Latest page 使用 item-bounded ownership resolution

`thread/items/list` 仍是 latest page 的主数据源，默认窗口按 timeline item 数量和响应字节预算限制。若返回 item 已携带 turnId，客户端直接从当前 page 派生 turn ownership 与 manifest，不再额外请求 `thread/turns/list itemsView: full`。

只有存在缺少 owner 的可见 items 时才进入 bounded owner resolver。resolver 可使用轻量 recent turn manifest 与按候选 turn 限制的 item page，找到当前 page 所需 owner 后立即停止；不得为了 30 个 timeline items 无条件展开最近 30 个完整 turns。无法在预算内解析 owner 时返回明确的不完整/repair-required 结果或跳过依赖完整 manifest 的破坏性动作，不能退化为完整历史读取。

legacy app-server 不支持 `thread/items/list` 时保留现有逐 turn 有界 fallback，但每次只读取完成当前 item page 所需的 turn，并维持 RPC、item 和字节上限。

### 5. Rollout supplement 使用增量索引并合并并发读取

gateway 维护按 rollout path 与文件 revision 标识的 bounded supplement cache。cache 至少记录已扫描 byte offset、尾部残行、按 turnId 分组的有限 records、最新 context usage 和进行中的 scan promise。

- 文件追加时只读取上次 offset 之后的字节并更新索引。
- 文件截断、替换或 revision 不兼容时丢弃旧索引。
- 冷启动只做有界尾部/范围扫描；若预算内找不到当前 window turn，直接跳过 supplement，不因文件小于 64 MB 就从头读取完整文件。
- 同一文件 revision 的 metadata 与 latest-page 并发请求复用同一个 scan promise；context usage 与 activity supplement 共享扫描结果。
- cache 与 per-turn records 有明确容量和淘汰上限，不能随长会话无限增长。

备选方案是完全移除 rollout supplement。它会丢失 app-server item page 未公开的 nested command、Skill 和部分工具活动，因此不采用。

### 6. 回归 fixture 使用真实错误输入

顺序 fixture 的 canonical base 必须是错误形态 `agent A, agent B, command A, command B`，supplement 为 `command A, agent A, command B, agent B`；断言 server 输出、store refresh 和 presentation 最终都收敛为真实顺序。文件 fixture 同时发送 `turn_diff_updated`、item-scoped patch/output 与 completed item，断言 live 和 refresh 都只有 canonical item activity。

性能测试通过可观测 reader/RPC 计数断言：owner metadata 完整时不调用 broad full-turn page；metadata 与 page 共用一次 rollout scan；append 只读取新增区间；completion retry 不重复扫描未变化 revision。

## Risks / Trade-offs

- [Risk] item 级 file event 丢失时过早抑制 turn diff 可能减少详情。→ 仅在稳定 itemId 的 file activity 已进入同 turn 后退场；完全没有 item 事件时保留 turn diff fallback。
- [Risk] canonical tool 重定位会改变已有 page 顺序。→ 只在强 identity 加唯一 message anchor interval 同时成立时移动；歧义时保持原位并请求 repair。
- [Risk] bounded owner resolver 可能增加少量 RPC。→ 优先使用 item 自带 turnId，按候选 turn 停止，并以总 RPC/item/byte budget 限制最坏成本。
- [Risk] rollout cache 在文件替换、压缩或多进程写入时失效。→ revision 绑定 path、size、mtime 与 offset 连续性；任何回退或不一致都清空并走可降级冷路径。
- [Risk] 顶层不再显示失败会降低未展开时的错误提示。→ 这是明确产品选择；动作行和详情仍保留中文失败状态及诊断输出。

## Migration Plan

1. 先增加能稳定复现三类行为与读取成本的失败测试。
2. 实现 file source precedence 和 canonical tool placement，再验证 refresh/live 顺序收敛。
3. 实现 item ownership fast path、bounded resolver 与 rollout cache/coalescing。
4. 最后调整顶层状态展示和对应规格测试。
5. 运行相关定向测试、`npm run verify`、`npm run build` 与 OpenSpec strict 校验。

不涉及持久化数据迁移。回滚时可整体回退该 change；公开 API、cursor 和现有 session 文件保持兼容。

## Open Questions

无阻塞问题。实现阶段若当前 app-server 的 `thread/items/list` 已稳定携带 turnId，则 owner resolver 主要作为兼容路径；否则按本设计启用轻量 manifest 加候选 turn item page。
