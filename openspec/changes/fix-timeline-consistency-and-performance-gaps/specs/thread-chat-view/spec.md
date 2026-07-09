## MODIFIED Requirements

### Requirement: 每条消息显示相对时间且始终用相对时间
timeline 上每条用户、agent、system 和可见 activity 消息 SHALL 在头部或等价元信息区域显示相对时间，不论时间是否超过一天，始终使用相对时间格式。相对时间文本 MUST 不挤压主要消息内容，且在移动端窄宽度下保持换行或省略稳定。

#### Scenario: 近期消息
- **WHEN** 消息发生在不久前
- **THEN** 时间 MUST 显示如「3 分钟前」「刚刚」

#### Scenario: 久远消息
- **WHEN** 消息发生在数天或数月前
- **THEN** 时间 MUST 仍使用相对时间（如「3 天前」「2 个月前」）

#### Scenario: Activity 消息显示时间
- **WHEN** timeline 中渲染可见 activity、system 或 tool 输出行
- **THEN** 该行 MUST 显示与普通消息一致的相对时间或等价可见时间元信息
- **AND** 时间元信息 MUST NOT 导致移动端消息正文重叠

### Requirement: Timeline 数据读取必须保持有界
会话聊天页 SHALL 在首屏、分页、snapshot repair、turn item 补齐和 rollout supplement 中使用有界 timeline window。系统 MUST NOT 为了补充 activity、context usage、repair 或分页而默认读取完整 turns 历史或完整 rollout JSONL；rollout supplement MUST 在扫描或解析过程中按当前窗口 turnId 过滤，并在预算耗尽时跳过补充。

#### Scenario: 首屏读取保持最近窗口
- **WHEN** 用户进入包含大量历史 turns 的会话页
- **THEN** 系统 MUST 使用 metadata 加最近 turns window 初始化 timeline
- **AND** MUST NOT 请求 `thread/read includeTurns=true`
- **AND** MUST NOT 因补充 rollout activity 或 context usage 读取完整 rollout JSONL

#### Scenario: 分页读取有默认限制
- **WHEN** 用户向上滚动触发更早历史分页
- **THEN** 前端和后端 MUST 使用默认分页 limit
- **AND** 后端 MUST 对客户端传入的 limit 做上限钳制
- **AND** 单次分页 MUST NOT 返回未受限的完整历史

#### Scenario: Repair 使用有界窗口
- **WHEN** timeline event stream 报告可归属 gap 或 turn completion 需要修复
- **THEN** snapshot repair MUST 读取当前 thread 的最近窗口或目标 turn 相关窗口
- **AND** MUST NOT 因 repair 默认加载完整会话历史

#### Scenario: Supplement 解析时过滤窗口
- **WHEN** rollout JSONL 包含大量窗口外 turns
- **AND** 当前 timeline window 只允许少量 turnId
- **THEN** supplement MUST 在扫描或解析过程中忽略窗口外 turn
- **AND** MUST NOT 先完整物化窗口外事件再过滤

### Requirement: Rollout supplement 不得阻塞主 timeline
会话聊天页 SHALL 把 rollout JSONL supplement 视为可降级补充信息。系统 MUST 优先保证主 timeline 可渲染和可流式更新；当 supplement 无法在有界预算内完成时，MUST 跳过或延后 supplement，而不是阻塞首屏、分页或 repair。

#### Scenario: 大 rollout 文件
- **WHEN** 当前 thread 的 rollout JSONL 很大
- **THEN** 读取 thread detail 或分页 MUST 仍在有界 timeline window 内完成
- **AND** 系统 MAY 暂时缺少部分历史 activity supplement
- **AND** 主 timeline MUST NOT 因完整 JSONL 解析而卡顿

#### Scenario: Supplement 只处理当前窗口
- **WHEN** 当前 timeline window 只包含最近 N 个 turns
- **THEN** rollout supplement MUST 只尝试补齐该窗口内可识别 turn 的 activity/context 信息
- **AND** MUST NOT 为窗口外 turns 生成或合并 timeline entries

#### Scenario: Supplement 预算耗尽时降级
- **WHEN** supplement 扫描达到文件大小、行数、时间或内存预算
- **THEN** 系统 MUST 停止该次 supplement 补齐并返回主 timeline
- **AND** MUST NOT 阻塞首屏、分页或 snapshot repair 完成
