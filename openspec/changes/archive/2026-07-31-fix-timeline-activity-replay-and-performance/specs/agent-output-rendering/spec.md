## ADDED Requirements

### Requirement: File change activity uses one canonical visible item
移动端 timeline SHALL 将 turn 级 diff 视为 item 级 file change 缺失时的 provisional fallback。同一 HistoryStamp 和 turn 内一旦存在带稳定 itemId 的 file delta、completed item、snapshot item 或 repair item，系统 MUST 只渲染 item 级 file activities，并 MUST 不再把 turn 级 diff 显示为第二条文件修改活动。

#### Scenario: Turn diff is replaced by item-scoped file activity
- **WHEN** 客户端先收到 `turn_diff_updated` 并显示 provisional 文件活动
- **AND** 随后同一 generation 和 turn 收到带稳定 itemId 的 file activity
- **THEN** timeline MUST 移除或抑制 provisional turn diff
- **AND** 同一修改 MUST 只显示一条 canonical file activity

#### Scenario: Late turn diff does not duplicate canonical file activity
- **WHEN** 同一 turn 已存在一个或多个带稳定 itemId 的 file activities
- **AND** 随后收到 `turn_diff_updated`
- **THEN** 该 turn diff MUST NOT 创建新的可见 activity
- **AND** 已有 item 级 file activities MUST 保持原 identity 和顺序

#### Scenario: Turn diff remains available as fallback
- **WHEN** 某 turn 只收到 `turn_diff_updated`
- **AND** 没有任何 item-scoped file event 或 snapshot item 到达
- **THEN** timeline MUST 继续显示一条 provisional 文件活动
- **AND** 用户 MUST 仍能查看可用 diff 与增删统计

#### Scenario: Refresh preserves one file activity
- **WHEN** live 阶段先后出现 turn diff 与 canonical file item
- **AND** snapshot repair 或浏览器刷新只返回 canonical file item
- **THEN** 刷新前后 MUST 都只显示 canonical file activity
- **AND** activity 数量、identity 和展开详情 MUST 收敛一致

## MODIFIED Requirements

### Requirement: Timeline 活动按 turn 聚合为可展开摘要
移动端 timeline SHALL 将同一 turn 内连续的 Thinking、工具调用、shell/bash、read/list/search、文件变更和验证类输出聚合为轻量 activity block。activity block SHALL 默认只展示中性的动作摘要行，并允许用户先展开 activity block 查看动作列表，再展开单条动作查看原始活动详情。顶层摘要 MUST 不表达成功、失败或运行状态。

#### Scenario: 默认显示活动摘要
- **WHEN** 一个 turn 内产生多个 reasoning、tool、command 或 diff entry
- **THEN** timeline MUST 默认显示一个或多个 activity block 摘要
- **AND** 摘要 MUST 不把每个底层 entry 都以同等重量的独立卡片铺满首屏
- **AND** 摘要 MUST 不默认显示底层动作列表

#### Scenario: 展开后保留原始详情
- **WHEN** 用户展开 activity block 并继续展开其中某条动作
- **THEN** 系统 MUST 显示被聚合的原始活动详情
- **AND** 详情 MUST 包含原始命令、工具名、参数、输出、路径、diff 或错误信息中可用的内容

#### Scenario: 活动分组不改变 timeline 事实源
- **WHEN** timeline 执行 rewind、fork、snapshot repair 或 SSE delta 幂等处理
- **THEN** 系统 MUST 继续基于底层 timeline entry 的稳定身份和 turn metadata 处理
- **AND** activity block MUST NOT 引入新的可见重复项或丢弃底层事件

#### Scenario: 顶层摘要保持中性
- **WHEN** 被聚合的活动同时包含 running、success 或 failed command/tool entries
- **THEN** activity block 第一层 MUST 只显示发生了哪些动作
- **AND** 第一层可见文本、状态图标和 accessible name MUST 不显示成功、失败或运行状态
- **AND** 用户展开后 MUST 能在具体动作行和详情中识别失败或运行状态

### Requirement: 活动摘要使用移动端可扫读文案
活动摘要 SHALL 使用短文案表达动作类别和数量，例如 `Read files · 6`、`Searched files · 1`、`Ran commands · 2`、`Files changed · 7 · +55 -36`。摘要 SHALL 避免显示执行状态、完整绝对路径、长 JSON 参数或 Markdown 原始标记。

#### Scenario: read/list/search 动作摘要
- **WHEN** 工具或命令活动包含 read、list、search 等结构化动作
- **THEN** 摘要 MUST 分别显示读取文件、浏览目录或搜索文件的动作类别和数量
- **AND** 展开后 MUST 能查看具体路径或搜索结果摘要

#### Scenario: shell/bash 命令摘要
- **WHEN** 工具活动表示 shell/bash 命令
- **THEN** 摘要 MUST 显示命令动作或数量
- **AND** 摘要 MUST 不附加成功、失败或运行状态
- **AND** cwd、完整命令、状态和长输出 MUST 放在展开后的动作行或详情中

#### Scenario: 纯文本预览清洗
- **WHEN** 摘要预览来自 Markdown、reasoning 文本、工具参数或输出
- **THEN** 预览 MUST 移除明显 Markdown 控制标记
- **AND** 预览 MUST 在移动端宽度内截断或换行，不能横向溢出

#### Scenario: 未识别工具兜底
- **WHEN** 系统收到尚未识别的工具或 raw response variant
- **THEN** timeline MUST 显示通用活动摘要
- **AND** 展开详情 MUST 保留可读的工具名、类型、参数或结果
- **AND** 系统 MUST NOT 只显示未经整理的大段 JSON 作为默认摘要

### Requirement: Activity failure status is localized and visible
移动端内联活动日志 SHALL 在具体动作行和详情中使用中文展示失败状态。activity block 第一层 MUST 保持中性；用户展开活动后 MUST 能定位失败动作，并查看可用于诊断的命令、参数、stderr、result 或 output 文本。

#### Scenario: Failed activity keeps neutral group summary
- **WHEN** 内联 activity section 中存在失败的 command 或 tool entry
- **THEN** activity block 第一层 MUST 不显示“失败”、`Failed` 或失败状态图标
- **AND** 用户展开 activity block 后，失败动作行 MUST 使用中文状态或警示图标标识

#### Scenario: Failed activity details
- **WHEN** 用户打开失败 entry 的动作详情
- **THEN** 展开区域 MUST 显示失败 entry 的命令或工具身份
- **AND** 展开区域 MUST 显示可用的错误输出、result、output 或参数文本
- **AND** 详情 MUST NOT 显示英文 `Failed`
