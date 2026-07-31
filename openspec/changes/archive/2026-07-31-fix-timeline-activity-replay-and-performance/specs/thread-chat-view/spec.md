## MODIFIED Requirements

### Requirement: 会话首屏读取使用有界最近 turns
会话聊天页在浏览器刷新、首次进入或 snapshot repair 时 SHALL 使用有界最近 timeline items 作为首屏数据源，MUST NOT 默认读取完整历史 turns，也 MUST NOT 为一个 item page 无条件展开最近一组完整 turns。默认首屏窗口 SHALL 使用受限 item 数量与响应字节预算，并保留继续向上分页加载更早历史的 cursor。

#### Scenario: 刷新长会话
- **WHEN** 浏览器刷新并进入一个包含大量历史 turns 或单个超大 turn 的会话
- **THEN** 首次 timeline page MUST 只返回最近有界 items
- **AND** 页面 MUST 在该窗口数据到达后显示聊天界面和输入区
- **AND** 更早历史 MUST 只能通过向上分页继续加载

#### Scenario: Item owner fast path avoids broad full turns
- **WHEN** `thread/items/list` 返回的当前 page 可为每个可见 item 提供 turnId
- **THEN** 服务端 MUST 直接从当前 item page 派生 turn ownership 和 manifest
- **AND** MUST NOT 再请求一个覆盖多 turns 的 `itemsView: full` page

#### Scenario: Missing item ownership uses bounded resolver
- **WHEN** 当前 item page 中存在缺少 turnId 的可见 items
- **THEN** 服务端 MUST 使用有 RPC、item 和字节上限的 owner resolver
- **AND** resolver MUST 在当前 page items 已全部解析或预算耗尽时停止
- **AND** MUST NOT 无条件展开最近 30 个完整 turns
- **AND** 无法解析时 MUST 返回不完整/repair-required 语义或禁止依赖完整 manifest 的破坏性动作

#### Scenario: Snapshot repair 不全量拉取历史
- **WHEN** timeline event stream 报告某 thread 存在可归属 gap
- **THEN** 页面 MUST 执行有界 snapshot repair 或等价尾部窗口修复
- **AND** repair MUST replace 当前未知尾部
- **AND** repair MUST NOT 因长会话默认拉取完整历史 turns

#### Scenario: 空会话不请求历史窗口
- **WHEN** 会话尚无任何 turns
- **THEN** 页面 MUST 立即显示可用输入区
- **AND** MUST NOT 为了空 timeline 发起无意义的历史分页请求

### Requirement: Rollout supplement uses bounded scan budgets
会话聊天页和后端适配层 SHALL 将 rollout JSONL supplement 作为可跳过的窗口补充源。系统 MUST 不为首屏、分页、snapshot repair、turn item 补齐或 context usage 默认读取、切分或解析完整 rollout 文件；supplement MUST 使用按文件 revision 复用的有界扫描或增量索引，按当前 timeline window、当前分页或目标 turn 的 `turnId` 过滤，并受文件大小、行数、耗时、RPC 和内存预算约束。

#### Scenario: Oversized rollout does not block thread detail
- **WHEN** 用户打开包含大 rollout JSONL 的 thread
- **AND** 主 `thread/read` 和最近 items window 已可返回
- **THEN** 后端 MUST 在 supplement 预算耗尽时跳过或延后 supplement
- **AND** thread detail MUST 仍返回主 timeline window
- **AND** 客户端 MUST 不要求用户刷新页面才能看到主 timeline

#### Scenario: Cold scan does not read complete rollout
- **WHEN** supplement cache 尚不存在
- **AND** rollout 文件大小仍低于某个全局最大 source budget
- **THEN** 后端 MUST 进行有界尾部或目标范围扫描
- **AND** MUST NOT 仅因文件低于最大 budget 就从头读取完整 rollout
- **AND** 预算内找不到目标 turn 时 MUST 跳过该次 supplement

#### Scenario: Metadata and page share one file revision scan
- **WHEN** 同一次首屏或 repair 周期并发读取 metadata 与 latest page
- **AND** 两者引用同一 rollout path 和文件 revision
- **THEN** 后端 MUST 复用同一个进行中的 scan 或已完成索引结果
- **AND** activity supplement 与 context usage MUST NOT 各自重复扫描同一未变化文件

#### Scenario: Appended rollout reads only new bytes
- **WHEN** 已缓存 rollout offset 后文件以 append-only 方式增长
- **THEN** 后端 MUST 从已确认 offset 之后继续读取
- **AND** MUST NOT 为新增记录重新扫描已索引前缀
- **AND** 文件截断、替换或 revision 回退时 MUST 丢弃旧索引并走有界冷路径

#### Scenario: Page supplement scans only page turns
- **WHEN** 用户向上分页加载更早历史
- **AND** rollout JSONL 中包含大量不属于该 page 的 turns
- **THEN** supplement MUST 只尝试补齐该 page 的 `turnId`
- **AND** 窗口外记录 MUST NOT 消耗该 page 的 supplement 记录预算

#### Scenario: Context usage avoids full rollout parse
- **WHEN** header 或 context sheet 需要展示上下文用量
- **THEN** 系统 MUST 优先使用 app-server summary、live `token_usage_updated`、本地缓存或共享的有界 rollout 索引
- **AND** MUST NOT 为了计算 context usage 完整解析历史 rollout JSONL

#### Scenario: Completion retries reuse unchanged supplement state
- **WHEN** completion repair 因持久化延迟在固定上限内重试
- **AND** rollout 文件 revision 未变化
- **THEN** 后续 retry MUST 复用已有 supplement 索引或结果
- **AND** MUST NOT 为每次 retry 重复扫描同一文件前缀
