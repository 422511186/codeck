## ADDED Requirements

### Requirement: 移动端活动以内联日志穿插展示
移动端 timeline SHALL 将 agent 运行中的工具、读取、搜索、命令、Skill/工具加载、文件变更和公开 reasoning 等活动渲染为 Codex App 风格的内联活动日志。内联活动日志 SHALL 作为消息流的一部分穿插在 assistant 消息之间，MUST NOT 显示统一的 `Activity` 标题、厚卡片边框、强调色左边框或独立卡片容器。

#### Scenario: 活动不显示 Activity 卡片
- **WHEN** 一个 turn 产生 tool、command、diff、reasoning 或 runtime loading 活动
- **THEN** timeline MUST 渲染具体活动标题和明细行
- **AND** timeline MUST NOT 显示 `Activity` 作为用户可见标题
- **AND** 活动 MUST NOT 使用厚卡片、蓝色左侧强调条或独立卡片容器

#### Scenario: 活动按真实顺序穿插
- **WHEN** 同一 turn 内真实顺序为 assistant 消息、工具活动、assistant 消息、文件变更、assistant 消息
- **THEN** timeline MUST 按该原始顺序渲染为 assistant 消息、内联活动日志、assistant 消息、内联活动日志、assistant 消息
- **AND** 系统 MUST NOT 将该 turn 的所有活动集中堆到用户消息下方或所有 assistant 文本之前

#### Scenario: 只合并连续活动
- **WHEN** 多个 activity entries 在同一 turn 中连续出现
- **THEN** timeline MAY 将这些连续 entry 派生为同一个内联活动日志组
- **AND** 合并 MUST 在遇到 assistant、user、system 或 error entry 时停止

### Requirement: 内联活动标题使用具体动作摘要
内联活动日志 SHALL 使用具体动作摘要作为标题，例如 `Loaded 4 tools`、`已读取 2 个文件已运行 1 条命令`、`Files changed · 3 · +42 -18`、`Thinking...` 或 `Thinking`。标题 MUST 表达发生了什么，MUST NOT 使用泛化的 `Activity`、`Used activity` 或类似无语义标签。

#### Scenario: Loaded tools 标题
- **WHEN** 活动组只包含 runtime Skill、tool instruction 或工具加载类活动
- **THEN** 标题 MUST 显示 `Loaded N tools` 或等价的具体加载摘要
- **AND** 明细 MUST 默认显示每个已知 Skill 或工具名称

#### Scenario: 文件读取和命令组合标题
- **WHEN** 活动组包含 read/search/list/command 等执行动作
- **THEN** 标题 MUST 汇总每类动作的数量
- **AND** 标题 MUST 能表达读取、搜索、浏览目录或运行命令中实际发生的动作

#### Scenario: 文件变更标题
- **WHEN** 活动组包含文件变更或 diff
- **THEN** 标题 MUST 显示被修改文件数量和总增删行数
- **AND** 标题 MUST 不要求用户展开才能知道有文件被改动

### Requirement: 短活动明细默认可见
内联活动日志 SHALL 默认显示短明细行。短明细包括 Skill/工具读取名称、文件读取路径、搜索目标、短命令名、简短工具动作和文件变更路径摘要。长输出、unified diff、完整命令 stdout/stderr、长 JSON 参数或结果 SHALL 放入展开详情。

#### Scenario: Skill 明细默认显示
- **WHEN** 活动组包含 runtime loaded tools 或 Skill 读取明细
- **THEN** timeline MUST 默认显示 `读取 <name> 技能` 或等价短明细
- **AND** 用户 MUST 不需要展开才能看到加载了哪些已知 Skill 或工具

#### Scenario: 文件读取明细默认显示
- **WHEN** 活动组包含 read、list 或 search 动作
- **THEN** timeline MUST 默认显示短路径、搜索词或动作名称
- **AND** 绝对路径、长参数和完整输出 MUST 不挤占默认明细

#### Scenario: 长详情折叠
- **WHEN** 活动包含完整命令输出、diff、长 JSON 或大段 reasoning 文本
- **THEN** 默认明细 MUST 只显示短摘要
- **AND** 用户展开后 MUST 能查看完整可用详情

## MODIFIED Requirements

### Requirement: 所有长输出默认折叠为卡片
Agent 流式产生的长详情内容（命令完整输出、文件 diff、MCP/dynamic 工具长结果、raw response fallback、公开 reasoning 长文本）SHALL 默认折叠在内联活动日志的详情区域中，用户点击后就地展开 / 收起，不弹出新页或抽屉。短活动本身 MUST 以内联日志行默认可见，MUST NOT 因为属于工具或 reasoning 就被强制显示为独立折叠卡片。

#### Scenario: 短活动默认可见
- **WHEN** agent 输出工具加载、读取文件、搜索、短命令名或文件变更摘要
- **THEN** timeline MUST 在内联活动日志中默认显示这些短明细
- **AND** MUST NOT 只用一张折叠卡片隐藏所有短明细

#### Scenario: 长详情就地展开
- **WHEN** 用户点击内联活动日志的展开按钮
- **THEN** 长详情 MUST 在原位置就地展开
- **AND** MUST 不跳转到任何新页面或弹出抽屉

### Requirement: 工具卡片折叠态摘要面向移动端阅读优化
工具、命令、MCP、dynamic、file、web、image 或 runtime loading 活动在移动端 SHALL 优先以内联活动日志行呈现。默认状态 SHALL 展示用户能快速理解的动作、工具名、命令摘要或短明细；低优先级元数据（如 cwd、完整路径、长 JSON 参数）SHALL 放到展开详情中。系统 SHALL 保留可追踪性，但默认展示 MUST 避免把 agent 正文明显下推。

#### Scenario: 命令工具优先显示命令
- **WHEN** timeline 渲染 `toolKind` 为 `command` 的工具活动
- **THEN** 默认明细 MUST 优先显示命令内容或短命令摘要
- **AND** cwd MUST 不作为默认明细最前面的主要文本

#### Scenario: 非命令工具保留工具身份
- **WHEN** timeline 渲染 MCP、dynamic、file、web 或 image 工具活动
- **THEN** 默认明细 MUST 显示工具身份或动作名称
- **AND** 长参数或长路径 MUST 不导致标题横向溢出

#### Scenario: 连续工具活动合并为内联日志
- **WHEN** 同一 turn 内连续出现多个 read、list、search、command、MCP、dynamic 或 runtime loading 活动
- **THEN** timeline MAY 将它们合并到同一个内联活动日志组
- **AND** 该日志组 MUST 使用具体动作摘要和默认可见短明细

### Requirement: 文件 diff 每个文件一张卡片
当 agent 修改文件或 `turn_diff_updated` 事件到达时，移动端 timeline SHALL 默认以内联活动日志显示文件变更汇总；用户展开后 SHALL 能按文件查看每个被修改文件的 diff 详情。多个文件默认 MUST 不以多张同等重量的折叠卡片挤占首屏。

#### Scenario: 单文件改动
- **WHEN** agent 修改了 1 个文件
- **THEN** timeline MUST 显示文件变更内联日志
- **AND** 默认明细 MUST 包含该文件路径或文件名以及增删行数
- **AND** 展开后 MUST 能查看该文件的 unified diff

#### Scenario: 多文件改动
- **WHEN** agent 一次修改了 N 个文件
- **THEN** timeline MUST 默认显示一条文件变更汇总，包含文件数量和总增删行数
- **AND** 展开后 MUST 能按文件查看 N 个 diff 详情

### Requirement: 推理过程默认折叠为「思考中…」并保留可展开
`reasoning_delta` 事件在 agent 进行中 SHALL 渲染为内联 `Thinking...` 活动日志；日志 SHALL 保留运行中状态，并在已经收到公开 reasoning 文本时允许用户展开查看已到达内容。turn 完成后 SHALL 保留为 `Thinking` 活动，仍默认只显示短摘要，可点击展开查看完整公开 reasoning 文本。

#### Scenario: 进行中且尚无文本
- **WHEN** agent 开始 reasoning 但尚未收到任何 `reasoning_delta` 文本
- **THEN** timeline MUST 显示一条运行中的 `Thinking...` 内联活动
- **AND** 活动 MUST 有微动效以表明在进行

#### Scenario: 进行中且已有文本
- **WHEN** agent 仍在产生 `reasoning_delta` 且至少已有一段推理文本到达
- **THEN** timeline MUST 显示运行中的 `Thinking...` 内联活动
- **AND** 用户 MUST 能展开查看已到达的公开推理文本
- **AND** 活动 MUST 继续显示运行中状态

#### Scenario: summary 分段事件不中断展示
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 后继续收到 `item/reasoning/summaryTextDelta`
- **THEN** timeline MUST 继续把 summary delta 追加到对应 Thinking 活动
- **AND** MUST 不因为 summary part 事件本身没有文本而丢弃后续推理内容

#### Scenario: summary 分段先创建思考活动
- **WHEN** WebSocket 或 SSE 收到 `item/reasoning/summaryPartAdded` 或 reasoning `item/started` 且尚无文本 delta
- **THEN** timeline MUST 立即显示一条运行中的 `Thinking...` 内联活动
- **AND** 后续 `item/reasoning/summaryTextDelta` 或 `item/reasoning/textDelta` MUST 追加到同一条 Thinking 活动

#### Scenario: reasoning summary 请求与展示链路完整
- **WHEN** Web 发起一个支持 reasoning 的 turn
- **THEN** 请求参数或会话设置 MUST 明确保留可公开展示的 reasoning summary 配置
- **AND** Web MUST 渲染 app-server 已公开发送的 reasoning summary/content/delta
- **AND** Web MUST NOT 伪造模型未公开发送的隐藏推理内容

#### Scenario: turn 完成
- **WHEN** 该 turn 的 reasoning 流结束
- **THEN** Thinking 活动 MUST 保留在 timeline 中
- **AND** 活动标题 MUST 改为 `Thinking`
- **AND** 活动 MUST 仍默认只显示短摘要
- **AND** 用户点击 MUST 可展开查看完整公开推理文本
