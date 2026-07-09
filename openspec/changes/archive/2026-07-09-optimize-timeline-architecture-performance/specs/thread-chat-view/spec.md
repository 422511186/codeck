## ADDED Requirements

### Requirement: Rollout supplement uses bounded scan budgets
会话聊天页和后端适配层 SHALL 将 rollout JSONL supplement 作为可跳过的窗口补充源。系统 MUST 不为首屏、分页、snapshot repair、turn item 补齐或 context usage 默认读取、切分或解析完整 rollout 文件；supplement MUST 按当前 timeline window、当前分页或目标 turn 的 `turnId` 过滤，并受文件大小、行数、耗时或内存预算约束。

#### Scenario: Oversized rollout does not block thread detail
- **WHEN** 用户打开包含大 rollout JSONL 的 thread
- **AND** 主 `thread/read` 和最近 turns window 已可返回
- **THEN** 后端 MUST 在 supplement 预算耗尽时跳过或延后 supplement
- **AND** thread detail MUST 仍返回主 timeline window
- **AND** 客户端 MUST 不要求用户刷新页面才能看到主 timeline

#### Scenario: Page supplement scans only page turns
- **WHEN** 用户向上分页加载更早历史
- **AND** rollout JSONL 中包含大量不属于该 page 的 turns
- **THEN** supplement MUST 只尝试补齐该 page 的 `turnId`
- **AND** 窗口外记录 MUST NOT 消耗该 page 的 supplement 记录预算

#### Scenario: Context usage avoids full rollout parse
- **WHEN** header 或 context sheet 需要展示上下文用量
- **THEN** 系统 MUST 优先使用 app-server summary、live `token_usage_updated`、本地缓存或有界尾部扫描
- **AND** MUST NOT 为了计算 context usage 完整解析历史 rollout JSONL

### Requirement: Timeline viewport recycles offscreen rows
移动端 timeline SHALL 使用可回收的渲染窗口。系统 MUST 只挂载可见区域和上下 buffer 内的 rows；当用户长时间向上或向下浏览时，窗口外 rows MUST 被回收，并用稳定 spacer 或等价布局机制保持滚动位置。

#### Scenario: Long browse does not retain all historical rows
- **WHEN** thread timeline 包含数百条历史 rows
- **AND** 用户从尾部连续向上浏览多个窗口
- **THEN** DOM 中 `[data-timeline-row='true']` 的数量 MUST 保持在有界预算内
- **AND** 已离开 buffer 的尾部 rows MUST 不继续挂载在主 timeline DOM 中

#### Scenario: Prepending history preserves scroll anchor
- **WHEN** 用户滚到顶部附近触发更早 turns 分页
- **AND** 新 rows prepend 到当前 timeline 前方
- **THEN** viewport MUST 维持用户正在阅读内容的视觉锚点
- **AND** MUST 不因为 spacer 高度变化跳到最新消息或空白区域

#### Scenario: New live output respects user scroll position
- **WHEN** 用户不在 timeline 底部
- **AND** active turn 收到新的 live delta 或 activity event
- **THEN** viewport MUST 不强制滚到最新
- **AND** 跳到最新入口 MUST 仍能把用户带回尾部

### Requirement: Timeline updates are isolated from unrelated page state
会话聊天页 SHALL 将 timeline 高频更新与 header、composer、模型/权限选择器、context sheet、goal editor、rename dialog 和 action sheet 的状态隔离。timeline delta、pagination、repair 或 supplement merge MUST 只更新需要消费 timeline slice 的组件和必要状态。

#### Scenario: Delta does not reset composer state
- **WHEN** 用户正在输入文本、选择图片或选择 Skill
- **AND** timeline 收到高频 agent/tool/reasoning delta
- **THEN** composer 草稿、图片选择和 Skill 选择 MUST 保持不变
- **AND** composer MUST 不因每个 delta 被重新挂载

#### Scenario: Repair does not close unrelated sheets
- **WHEN** 用户打开模型、权限、context usage 或 goal 面板
- **AND** 当前 thread 完成一次 snapshot repair 或 pagination merge
- **THEN** 面板 MUST 保持打开
- **AND** 除非用户切换 thread，repair MUST 不重置该面板的本地交互状态
