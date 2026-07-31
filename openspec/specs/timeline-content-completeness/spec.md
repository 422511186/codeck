# timeline-content-completeness Specification

## Purpose
TBD - created by archiving change fix-timeline-history-virtualization-and-completeness. Update Purpose after archive.
## Requirements
### Requirement: Timeline responses expose explicit completeness
thread snapshot、turn pagination、turn item detail、session supplement 和 full-content response SHALL 返回结构化 completeness 状态。系统 MUST 区分 complete、partial、truncated 和 repair-required，MUST NOT 以空 cursor、空数组或文本省略号隐式表示不完整。客户端应用响应时 MUST 同步更新 completeness 与 cursor；权威响应返回 `nextCursor: null` 时 MUST 清除旧 cursor，并使 `reachedBeginning` 与已声明的窗口边界保持一致。

#### Scenario: Complete page
- **WHEN** source page 已读取到末尾且所有 item 正文均在预算内
- **THEN** response completeness MUST 为 `complete`
- **AND** `nextCursor` MUST 为 `null`

#### Scenario: Response budget reached
- **WHEN** page 或 thread response 达到 bytes budget 且 source 仍有未读取内容
- **THEN** response completeness MUST 为 `partial`
- **AND** MUST 返回可继续读取的 `nextCursor`

#### Scenario: Source gap
- **WHEN** cursor 无法恢复、source item 不存在或补充文件出现缺口
- **THEN** completeness MUST 为 `repair-required`
- **AND** MUST 包含可诊断 reason

#### Scenario: Final page clears an older cursor
- **WHEN** 客户端当前保存非空历史 cursor
- **AND** 同一 history generation 的权威最终页返回 `nextCursor: null`
- **THEN** 客户端 MUST 清除旧 cursor
- **AND** MUST NOT 保留 `{cursor: <old>, reachedBeginning: true}` 的矛盾状态

### Requirement: Timeline payload budgets use UTF-8 bytes
系统 SHALL 对单 item、page、thread response、realtime event 和 full-content chunk 设置显式 UTF-8 bytes budget。默认预算 MUST 分别为 96 KiB、1 MiB、2 MiB、256 KiB 和 2 MiB，配置覆盖 MUST 仍受安全上限约束。page、response 和 event budget MUST 按最终序列化 payload 计算，包含 envelope、metadata、cursor、preview 和 completeness，返回或发送 bytes MUST 不超过硬上限。

#### Scenario: Multibyte text budget
- **WHEN** 正文包含中文、emoji 或其他多字节字符
- **THEN** budget MUST 使用 UTF-8 bytes 计算
- **AND** MUST NOT 使用 JavaScript `string.length` 作为网络 payload 大小

#### Scenario: Item exceeds inline budget
- **WHEN** 单 item 正文超过 96 KiB 默认 inline budget
- **THEN** inline item MUST 返回 UTF-8 边界安全的 preview
- **AND** MUST 返回 originalBytes、includedBytes、contentRef 和 truncated completeness

#### Scenario: Metadata pushes response over budget
- **WHEN** item bodies 在预算内但 envelope、cursor 和 completeness metadata 使最终 JSON 超过 response budget
- **THEN** builder MUST 继续减少可选 preview/items 后重新序列化
- **AND** 最终 response bytes MUST 不超过配置硬上限并返回 continuation

### Requirement: Truncated content remains retrievable
任何因 item、response 或 event budget 被截断的用户可见正文 SHALL 通过 opaque `contentRef` 和 cursor 分块读取完整内容。contentRef MUST 绑定主体 identity、source locator、source revision 和允许字段；cursor MUST 绑定 contentRef、revision 和 chunk byte offset并防篡改。content read MUST 复用鉴权、thread ownership、workspace roots 和审计边界，MUST NOT 接受任意客户端文件路径。只要有效 continuation 尚存，空 preview、空 completion 或 turn finalize MUST NOT 删除 entry、contentRef 或未完成状态。

#### Scenario: User expands truncated tool output
- **WHEN** 用户展开带 contentRef 的 truncated tool output
- **THEN** 客户端 MUST 请求 full-content chunk
- **AND** 后续 chunk MUST 按 cursor 追加直到 completeness 为 complete

#### Scenario: Invalid content reference
- **WHEN** contentRef 无效、过期或不属于当前 thread/session
- **THEN** 服务端 MUST 拒绝读取
- **AND** 客户端 MUST 显示 repair-required 或明确错误而不是空正文

#### Scenario: Idempotent chunk retry
- **WHEN** 客户端使用相同 contentRef 和 cursor 重试读取
- **THEN** 服务端 MUST 返回相同 byte range 和 nextCursor
- **AND** chunks MUST 不重叠且不得跳过正文 bytes

#### Scenario: Source revision changes
- **WHEN** contentRef 创建后 source revision 改变或 cursor token 被篡改
- **THEN** 服务端 MUST 返回 scoped `repair-required`
- **AND** MUST 不把不同 revision 的 chunks 拼接到同一正文

#### Scenario: Empty completion follows a retrievable preview
- **WHEN** timeline 已包含带有效 `contentRef` 的 truncated item
- **AND** 同 identity 的 completion 正文为空且没有证明完整正文合法为空
- **THEN** engine MUST 保留现有 preview、contentRef 和 continuation
- **AND** MUST NOT 将该 item 标记为 complete

#### Scenario: Empty reasoning preview survives turn finalization
- **WHEN** reasoning item 的 inline preview 为空但携带有效 `contentRef`
- **AND** turn 随后完成
- **THEN** normalized timeline MUST 保留 reasoning identity、contentRef 与未完整状态
- **AND** 展示层隐藏完成态 reasoning 时 MUST NOT 删除或错误完成该 continuation

### Requirement: Turn item pagination never stops silently
turn item detail coordinator SHALL 持续读取 source pages 直到 `nextCursor = null`、达到显式累计 response budget或 source 返回 repair-required。系统 MUST NOT 使用固定 5 页上限后返回看似完整的 entries。后续页失败时 coordinator MUST 保留已成功取得的页面并返回 partial 或 repair-required；跨页出现相同强 identity 时 MUST 按 revision、authority 和 completeness 合并为最完整版本，而不是永久保留首次版本。

#### Scenario: More than five pages
- **WHEN** 一个 turn 的 item detail 超过 5 页且仍在预算内
- **THEN** coordinator MUST 继续读取第 6 页及后续页
- **AND** 最终可见 item 顺序 MUST 保持 source 顺序

#### Scenario: Budget stops pagination
- **WHEN** 累计 detail response 达到 2 MiB 默认预算且仍有 nextCursor
- **THEN** coordinator MUST 返回 partial completeness 和 continuation cursor
- **AND** MUST 不把 reachedBeginning 标记为 true

#### Scenario: Cursor does not progress
- **WHEN** source 返回已见 cursor、cursor 环或非空 nextCursor 但零新增 identity/bytes
- **THEN** coordinator MUST 立即停止分页并返回 scoped `repair-required`
- **AND** MUST 不继续无限请求或把 response 标记为 complete

#### Scenario: Later detail page fails
- **WHEN** turn item detail 的前一页已成功返回 entries
- **AND** 后续页请求失败或返回 repair-required
- **THEN** coordinator MUST 返回已成功取得的 entries 和 partial 或 repair-required completeness
- **AND** MUST NOT 将已取得内容替换为空数组

#### Scenario: Later page completes an earlier item
- **WHEN** 前一页包含某 identity 的 partial revision
- **AND** 后一页包含同 identity 的更新 revision 或 complete 正文
- **THEN** coordinator MUST 返回更权威、更完整的 item
- **AND** 整体 completeness MUST 与实际合并结果一致

### Requirement: Completeness merges monotonically in timeline engine
timeline engine SHALL 按强 identity 合并正文和 completeness，并对 agent、reasoning、user、tool、command、diff、file、error 和 system 等所有可见 kind 使用同一候选选择规则。正文兼容时 MUST 按 `(integrity, includedBytes, authority, revision)` 依次选择：经验证 complete、prefix-compatible partial/live、truncated preview 的 integrity 依次降低；覆盖 bytes 优先于 authority/revision tie-breaker。两个非前缀 complete 正文、相同 revision 的不同正文，或更高 revision 无 continuation 却缩短覆盖范围时 MUST 保留当前正文并标记 repair-required，不能任意挑选。complete 正文 MUST 不被同 identity 的 truncated/partial snapshot 覆盖；正文、contentRef 和 completeness MUST 来自相容候选，MUST NOT 产生 `complete` 状态配合 truncated 正文或丢失 continuation 的组合。未显式携带 completeness 的 realtime 正文不得仅因此被较短 truncated snapshot 降级。

#### Scenario: Realtime complete before truncated refresh
- **WHEN** realtime 已形成完整 agent/tool 正文
- **AND** refresh snapshot 只包含同 identity 的 truncated preview
- **THEN** engine MUST 保留完整正文
- **AND** 可见 item completeness MUST 不降级为 truncated

#### Scenario: Full content completes preview
- **WHEN** truncated item 的 full-content chunks 全部读取完成
- **THEN** engine MUST 原位更新同 identity 正文
- **AND** completeness MUST 变为 complete 且 entry 顺序不变

#### Scenario: Realtime body has no explicit completeness
- **WHEN** realtime delta 已形成较长且内部一致的正文，但未携带 completeness
- **AND** 同 identity 的 refresh 只返回较短 truncated preview 和 contentRef
- **THEN** engine MUST 保留较长 realtime 正文并合并有效 continuation
- **AND** MUST NOT 仅因 refresh 显式携带 completeness 就用 preview 覆盖正文

#### Scenario: User and diff content remain consistent with status
- **WHEN** complete user message 或 diff 正文已存在
- **AND** 同 identity 的 truncated snapshot 包含较短 preview
- **THEN** engine MUST 同时保留 complete 正文和 complete 状态
- **AND** MUST NOT 输出 complete metadata 配合 truncated body

#### Scenario: Empty complete candidate cannot discard continuation
- **WHEN** 当前 item 具有非空 preview、truncated completeness 和有效 contentRef
- **AND** 新权威候选声明 complete 但正文为空
- **THEN** engine MUST 保留原内容与 continuation并标记需要进一步确认
- **AND** 只有协议明确该 kind 的合法完整正文为空时 MAY 完成该 item

#### Scenario: Conflicting complete candidates require repair
- **WHEN** 同一强 identity 和相同 revision 出现两个非前缀 complete 正文
- **THEN** engine MUST 保留当前可见正文并记录 scoped repair-required
- **AND** MUST NOT 仅按来源优先级、文本长度或到达顺序静默选择一个正文

#### Scenario: Status-only completion does not replace content
- **WHEN** tool、command 或 file completion 合法只携带 status/metadata 而正文为空
- **THEN** engine MAY 更新 lifecycle status 和 metadata
- **AND** MUST 保留已有正文、contentRef 与内容 completeness
- **AND** agent、user、reasoning、diff 或 error 的空正文 MUST NOT 被视为 content complete 证据

### Requirement: Full-content read results are identity-scoped
读取完整内容的客户端 SHALL 将每次 full-content 请求绑定到发起时的 `threadId`、entry identity、`turnId` 和 `contentRef`。只有当响应返回时这些标识仍与当前可见 entry 完全匹配时，客户端 MUST 将 full-content 结果应用到本地 row/state 和 store。若任一标识已变化、entry 已被替换、thread 已切换或内容已被更高权威 snapshot/repair 取代，客户端 MUST 丢弃该响应并 MUST NOT 用过期正文覆盖当前 preview、continuation 或 completeness。

#### Scenario: Content ref changes while loading
- **WHEN** 用户开始读取某条 truncated entry 的完整内容
- **AND** 请求返回前同一 row 被 snapshot/repair 更新为新的 `contentRef`
- **THEN** 客户端 MUST 丢弃旧响应
- **AND** MUST NOT 用旧正文覆盖新 preview 或 continuation

#### Scenario: Thread changes while loading
- **WHEN** 用户在 thread A 中读取完整内容
- **AND** 响应返回前页面已切换到 thread B
- **THEN** 客户端 MUST 丢弃 thread A 的响应
- **AND** MUST NOT 将 thread A 的正文写回 thread B 的 store

#### Scenario: Matching identity allows update
- **WHEN** full-content 响应返回时 threadId、entry identity、turnId 和 contentRef 仍与发起时一致
- **THEN** 客户端 MUST 原位更新该 entry 的正文和 completeness
- **AND** MUST 保持该 entry 的可见顺序不变

### Requirement: Full-content user messages update visible body
客户端 SHALL 在 full-content 读取成功并通过 identity 校验后，将完整正文应用到所有支持文本正文的可见 timeline entry，包括 `user-message`。用户消息的可见气泡、复制内容以及后续基于该条消息的重试、rewind 和 fork 操作 MUST 使用已加载的完整正文，MUST NOT 只更新 footer 或 store 而继续显示旧 preview。

#### Scenario: Truncated user message expands in place
- **WHEN** timeline 渲染一条带 `contentRef` 的 truncated `user-message`
- **AND** 用户点击「读取完整内容」且响应与当前 entry identity 匹配
- **THEN** 用户消息气泡 MUST 原位显示完整正文
- **AND** 该 entry 的 completeness MUST 变为 complete
- **AND** timeline MUST NOT 继续显示旧 preview 作为用户消息正文

#### Scenario: User message actions use loaded full text
- **WHEN** truncated `user-message` 的完整正文已成功加载
- **AND** 用户随后对该消息执行重发、rewind 或 fork
- **THEN** 操作载荷 MUST 使用完整正文
- **AND** MUST 保留原 entry 的 turn identity、图片、Skill 与普通文件附件元数据

### Requirement: App-server full-content chunks use one source revision
app-server item 的 `contentRef` SHALL 绑定可验证的正文 revision。服务端 MUST 在返回首次 chunk、相同 cursor 重试和每个 continuation chunk 前确认当前解析正文仍属于该 revision；一旦正文 revision 改变，MUST 返回 scoped `repair-required/source-revision`，MUST NOT 返回新 revision 的正文 bytes。完整 item/page source 的 revision MUST 从创建 `contentRef` 时锁定；无法在注册时取得完整正文的 source MUST 最迟在第一次成功读取时锁定，并对所有后续读取保持不变。

#### Scenario: Item changes between chunks
- **WHEN** 用户读取 app-server item 的第一段 full-content 后，同 generation 的 item 正文在下一段请求前改变
- **THEN** continuation 请求 MUST 返回 `repair-required` 且 reason 为 `source-revision`
- **AND** MUST NOT 返回改变后正文在旧 byte offset 处的 chunk

#### Scenario: Item changes before first read
- **WHEN** snapshot/page 或完整 item event 已创建绑定正文 revision 的 `contentRef`，且 item 在第一次请求前发生变化
- **THEN** 第一次读取 MUST 返回 `repair-required/source-revision`
- **AND** MUST NOT 把新正文作为旧 reference 的完整内容

#### Scenario: Same cursor retry remains idempotent
- **WHEN** source revision 未改变且客户端用相同 `contentRef` 和 cursor 重试
- **THEN** 服务端 MUST 返回相同 byte range、正文和 next cursor

### Requirement: Full-content reference caches are bounded
服务端 SHALL 对 session 与 app-server full-content source 使用同一过期清理和数量上限，并 SHALL 对 cursor 与位置反向索引设置硬上限。淘汰 source 时 MUST 同步移除所有关联 cursor 和反向索引；淘汰后的 `contentRef` 或 cursor MUST 返回 scoped `repair-required/invalid-content-ref`，MUST NOT 回退到无界缓存或未绑定 revision 的读取。

#### Scenario: Source or cursor reaches the cap
- **WHEN** 持续的截断 item 注册 source 或 continuation 创建 cursor 超过保留上限
- **THEN** 服务端 MUST 淘汰最旧或已过期记录并保持 source/cursor 数量有界
- **AND** 被淘汰 source 的所有 cursor 及位置反向索引 MUST 同步删除

#### Scenario: Read races with source eviction
- **WHEN** full-content 读取已开始等待 app-server source，且并发注册淘汰了该 `contentRef`
- **THEN** 原读取 MUST 返回 `repair-required/invalid-content-ref`
- **AND** MUST NOT 为已淘汰 source 创建新的 cursor

﻿### Requirement: Full-content rehydrate recovers missing live thread
对 app-server content source 的 full-content 读取 SHALL 在 live thread 缺失时先 bare resume 再 rehydrate。content API MUST 在可恢复路径成功后返回正文 chunk；若 resume 后仍无法恢复 source，MUST 返回 scoped `repair-required`，MUST NOT 因 missing live thread 直接返回 502。

#### Scenario: Truncated content load after cold session
- **WHEN** 用户点击带有效 contentRef 的“读取完整内容”
- **AND** 对应 thread 尚未 live，首次 `thread/items/list` 失败为 missing-live-thread
- **THEN** gateway MUST bare resume thread
- **AND** MUST 重试 rehydrate
- **AND** 客户端 MUST 能拿到完整或后续 partial chunk

#### Scenario: Missing live thread does not surface as opaque 502
- **WHEN** content rehydrate 因 missing live thread 开始失败
- **AND** bare resume 后仍无法恢复
- **THEN** content API MUST 返回 200 且 chunk completeness 为 `repair-required`
- **OR** 返回明确可诊断错误
- **AND** MUST NOT 仅返回无上下文的 502 Bad Gateway

### Requirement: Historical user metadata survives pagination and refresh

历史 turns 分页和 thread 刷新 SHALL 保持用户消息已经公开或可安全恢复的 Skill、图片和普通文件 metadata。分页 item 缺少 `turnId` 时，系统 MUST 在当前页面用户正文存在唯一匹配的情况下恢复对应 Skill；已有结构化 `skillReferences` MUST 优先于 rollout 回退结果。无法唯一匹配时 MUST 保持未绑定，且 MUST NOT 把 Skill 绑定到重复正文的任意一条消息。

#### Scenario: Historical page recovers Skill without turn ID

- **WHEN** turns 分页返回一条缺少 `turnId` 的用户消息
- **AND** rollout supplement 包含与该消息正文唯一匹配的隐藏 Skill 输入
- **THEN** 分页 item MUST 包含对应的 `skillReferences`
- **AND** Skill 隐藏正文 MUST NOT 出现在 timeline 正文中

#### Scenario: Duplicate user text fails closed

- **WHEN** 当前分页中有两条正文相同的用户消息
- **AND** rollout supplement 只有一个与该正文匹配的 Skill 引用
- **THEN** 系统 MUST 不把该 Skill 绑定到任意一条用户消息

#### Scenario: Structured Skill metadata stays authoritative

- **WHEN** 用户消息已经携带结构化 `skillReferences`
- **AND** rollout supplement 同时发现一个或多个 Skill 引用
- **THEN** 系统 MUST 保留结构化 `skillReferences`
- **AND** MUST NOT 用 rollout 回退结果覆盖或替换已有结构化引用

#### Scenario: Refresh preserves detail metadata over sparse page items

- **WHEN** 刷新得到的详情 item 含有 Skill、图片或普通文件 metadata
- **AND** 同一消息的 initial page item 缺少部分或全部这些 metadata
- **THEN** 刷新后的 timeline MUST 保留详情中的缺失 metadata
- **AND** MUST 保留 page item 的消息 identity、正文和显示顺序

#### Scenario: Ambiguous refresh candidates are not merged

- **WHEN** page item 只能通过重复的正文匹配到多个详情 item
- **THEN** 刷新合并 MUST 不猜测候选
- **AND** MUST 保留 page item 当前 metadata，不错误附加详情 metadata
