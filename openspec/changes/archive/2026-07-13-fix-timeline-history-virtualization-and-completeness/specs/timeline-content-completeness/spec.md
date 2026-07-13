## ADDED Requirements

### Requirement: Timeline responses expose explicit completeness
thread snapshot、turn pagination、turn item detail、session supplement 和 full-content response SHALL 返回结构化 completeness 状态。系统 MUST 区分 complete、partial、truncated 和 repair-required，MUST NOT 以空 cursor、空数组或文本省略号隐式表示不完整。

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
任何因 item、response 或 event budget 被截断的用户可见正文 SHALL 通过 opaque `contentRef` 和 cursor 分块读取完整内容。contentRef MUST 绑定主体 identity、source locator、source revision 和允许字段；cursor MUST 绑定 contentRef、revision 和 chunk byte offset并防篡改。content read MUST 复用鉴权、thread ownership、workspace roots 和审计边界，MUST NOT 接受任意客户端文件路径。

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

### Requirement: Turn item pagination never stops silently
turn item detail coordinator SHALL 持续读取 source pages 直到 `nextCursor = null`、达到显式累计 response budget或 source 返回 repair-required。系统 MUST NOT 使用固定 5 页上限后返回看似完整的 entries。

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

### Requirement: Completeness merges monotonically in timeline engine
timeline engine SHALL 按 identity 合并正文和 completeness。complete 正文 MUST 不被同 identity 的 truncated/partial snapshot 覆盖；更权威完整正文 MAY 替换旧 preview，repair-required MUST 保留诊断直到成功 repair。

#### Scenario: Realtime complete before truncated refresh
- **WHEN** realtime 已形成完整 agent/tool 正文
- **AND** refresh snapshot 只包含同 identity 的 truncated preview
- **THEN** engine MUST 保留完整正文
- **AND** 可见 item completeness MUST 不降级为 truncated

#### Scenario: Full content completes preview
- **WHEN** truncated item 的 full-content chunks 全部读取完成
- **THEN** engine MUST 原位更新同 identity 正文
- **AND** completeness MUST 变为 complete 且 entry 顺序不变
