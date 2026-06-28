# agent-output-rendering Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 所有长输出默认折叠为卡片
Agent 流式产生的所有「长内容」（命令调用、文件 diff、推理过程、MCP 工具调用、计划事件之外的长块）SHALL 默认以折叠卡片形式插入 timeline，用户点击后就地展开 / 收起，不弹出新页或抽屉。

#### Scenario: 默认折叠
- **WHEN** agent 输出命令、diff、推理、MCP 工具调用等内容
- **THEN** timeline MUST 用折叠卡片占位
- **AND** 卡片 MUST 默认收起

#### Scenario: 就地展开
- **WHEN** 用户点击折叠卡片
- **THEN** 卡片 MUST 在原位置就地展开
- **AND** MUST 不跳转到任何新页面或弹出抽屉

### Requirement: 命令折叠态只显示命令
当 agent 调用 shell 命令时 SHALL 在 timeline 上以折叠卡片呈现，折叠状态下只显示命令本身（如 `npm test`），不显示输出内容。

#### Scenario: 命令折叠呈现
- **WHEN** agent 发起一次 shell 命令调用
- **THEN** 折叠卡片 MUST 显示完整命令行
- **AND** MUST 不预览任何输出

#### Scenario: 展开后查看输出
- **WHEN** 用户点击命令卡片展开
- **THEN** 卡片 MUST 显示该命令的完整输出
- **AND** 输出区 MUST 限制最高 N 行（建议 24 行），超出部分内部可滚动

### Requirement: 正在运行的命令卡片显示 spinner
agent 当前仍在执行的命令卡片 SHALL 在右侧显示 spinner 并附「运行中」标签，与已完成命令区分。

#### Scenario: 运行中命令
- **WHEN** `command_output_delta` 还在持续到达
- **THEN** 命令卡片右侧 MUST 显示 spinner
- **AND** MUST 附「运行中」标签

#### Scenario: 命令完成
- **WHEN** 该命令的输出流结束
- **THEN** spinner 和「运行中」标签 MUST 消失

### Requirement: 命令失败用左侧红色色条
命令以非 0 退出码结束时 SHALL 在折叠卡片左侧显示红色色条，用于一眼区分成功与失败。

#### Scenario: 命令失败
- **WHEN** 命令退出码 ≠ 0
- **THEN** 卡片左侧 MUST 显示红色色条

#### Scenario: 命令成功
- **WHEN** 命令退出码 = 0
- **THEN** 卡片左侧 MUST 不显示色条

### Requirement: MCP 工具调用与命令同构呈现
agent 调用 MCP 工具时 SHALL 在 timeline 上使用与 shell 命令一致的折叠卡片样式。

#### Scenario: MCP 工具卡片
- **WHEN** agent 触发一次 MCP 工具调用
- **THEN** timeline MUST 用与命令卡片相同的折叠卡片呈现
- **AND** 折叠态 MUST 显示工具名与服务器名
- **AND** 展开后 MUST 显示完整调用结果

### Requirement: 文件 diff 每个文件一张卡片
当 agent 修改文件、`turn_diff_updated` 事件到达时 SHALL 为每个被修改文件生成一张折叠卡片，多个文件不合并到同一张卡。

#### Scenario: 单文件改动
- **WHEN** agent 修改了 1 个文件
- **THEN** timeline MUST 出现 1 张 diff 卡片

#### Scenario: 多文件改动
- **WHEN** agent 一次修改了 N 个文件
- **THEN** timeline MUST 出现 N 张 diff 卡片，依次排列

### Requirement: diff 卡片折叠态显示文件路径与行数变化
diff 卡片折叠状态下 SHALL 显示文件路径以及增删行数（如 `+12 / -5`）。

#### Scenario: 折叠态信息
- **WHEN** diff 卡片处于折叠状态
- **THEN** 卡片 MUST 显示文件相对路径
- **AND** MUST 显示该文件的 `+N / -M` 行数变化

### Requirement: diff 展开使用 unified diff 样式
diff 卡片展开后 SHALL 使用 unified diff 渲染，行内显示 + / - 前缀和新增、删除染色。

#### Scenario: 展开 diff
- **WHEN** 用户展开 diff 卡片
- **THEN** 内容 MUST 以 unified diff 形式渲染
- **AND** 新增行 MUST 用绿色（或浅绿底色）
- **AND** 删除行 MUST 用红色（或浅红底色）

### Requirement: diff 卡片纯展示不带操作
diff 卡片 SHALL 不提供任何「采纳」「回滚」「撤销」之类的操作按钮，仅供查看。

#### Scenario: 卡片操作约束
- **WHEN** diff 卡片渲染（无论折叠或展开）
- **THEN** 卡片 MUST 不显示采纳、撤销、回滚等操作按钮

### Requirement: 推理过程默认折叠为「思考中…」并保留可展开
`reasoning_delta` 事件在 agent 进行中 SHALL 渲染为「思考中…」折叠卡片；turn 完成后 SHALL 保留为「推理过程」卡片，仍默认折叠，可点击展开查看完整推理文本。

#### Scenario: 进行中
- **WHEN** agent 仍在产生 `reasoning_delta`
- **THEN** timeline MUST 显示一张「思考中…」折叠卡片
- **AND** 卡片 MUST 有微动效以表明在进行

#### Scenario: turn 完成
- **WHEN** 该 turn 的 reasoning 流结束
- **THEN** 卡片 MUST 保留在 timeline 中
- **AND** 卡片标题 MUST 改为「推理过程」
- **AND** 卡片 MUST 仍默认折叠
- **AND** 用户点击 MUST 可展开查看完整推理文本

### Requirement: 推理卡片折叠态高度与其他卡片一致
推理过程卡片折叠状态下的高度 SHALL 与命令、diff、MCP 等其他折叠卡片保持一致，不显得突兀。

#### Scenario: 高度一致
- **WHEN** 推理卡片处于折叠状态
- **THEN** 其外观高度 MUST 与其他折叠卡片一致

### Requirement: 计划事件在 timeline 顶部固定计划条
当一个 turn 内出现 `plan_delta` 时 SHALL 在 timeline 顶部以 sticky 形式渲染计划条；用户可手动折叠，默认展开。

#### Scenario: 出现计划
- **WHEN** turn 内出现 `plan_delta`
- **THEN** 系统 MUST 在 timeline 顶部渲染一个 sticky 计划条
- **AND** 计划条 MUST 默认展开

#### Scenario: 用户折叠
- **WHEN** 用户点击计划条上的折叠按钮
- **THEN** 计划条 MUST 折叠为单行标题
- **AND** 用户再次点击 MUST 重新展开

### Requirement: 计划步骤完成态显示勾选与灰色
计划条内已完成的步骤 SHALL 显示勾选标记并使用灰色文字。

#### Scenario: 已完成步骤
- **WHEN** 某个计划步骤已完成
- **THEN** 该步骤前 MUST 显示勾选标记
- **AND** 文字 MUST 使用灰色

### Requirement: 计划步骤不可点击跳转
计划步骤 SHALL 仅作展示，不允许点击跳转到 timeline 中对应位置。

#### Scenario: 步骤点击
- **WHEN** 用户点击计划条中的某个步骤
- **THEN** 系统 MUST 不执行任何跳转或滚动

### Requirement: 临时进行中状态使用微动效
表示「进行中」的临时状态（思考中、运行中、上传中等）SHALL 使用微动效（如 spinner 或脉冲），不使用大型加载动画。

#### Scenario: 视觉一致
- **WHEN** 多种进行中状态同时存在
- **THEN** 动效 MUST 风格一致
- **AND** MUST 不遮挡正文阅读

### Requirement: 错误统一以内嵌错误卡片呈现
所有错误（turn 跑挂、命令失败、`warning` 事件、网络异常等）SHALL 在 timeline 上以内嵌错误卡片呈现，不弹 alert、不跳页。

#### Scenario: 错误卡片样式
- **WHEN** 出现错误事件
- **THEN** timeline MUST 插入一张错误卡片
- **AND** 卡片 MUST 显示错误简述

#### Scenario: 错误卡片无重试
- **WHEN** 错误卡片渲染
- **THEN** 卡片 MUST 不显示「重试」按钮

### Requirement: Timeline 上 token 消耗不显示
即便后端发送 `token_usage_updated` 事件，timeline SHALL 不显示任何 token 消耗或耗时数据；该信息仅在设置页可见。

#### Scenario: 不显示成本
- **WHEN** 收到 `token_usage_updated`
- **THEN** timeline MUST 不渲染任何 token 数字或耗时

### Requirement: Markdown code blocks follow theme colors
Agent 消息中的 Markdown fenced code block SHALL 使用应用主题 token 渲染背景、文字、边框和滚动区域。语法高亮库的默认样式 MUST NOT 把代码块背景固定为与当前主题不匹配的颜色。

#### Scenario: Light theme code block
- **WHEN** 用户在明亮主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用明亮主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定暗色背景覆盖整个代码区域

#### Scenario: Dark theme code block
- **WHEN** 用户在暗黑主题下查看包含 fenced code block 的 agent 消息
- **THEN** 代码块背景 MUST 使用暗黑主题的代码块背景 token
- **AND** 代码文字、边框和行内高亮 MUST 保持可读，不得出现固定浅色背景覆盖整个代码区域

### Requirement: Markdown code copy button remains visible
Markdown 代码块的复制按钮 SHALL 在明亮主题和暗黑主题下都清晰可见、可点击，并使用当前主题 token 表达默认状态和复制成功状态。

#### Scenario: Copy button in light theme
- **WHEN** 用户在明亮主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button in dark theme
- **WHEN** 用户在暗黑主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分
- **AND** 按钮文字 MUST 可读

#### Scenario: Copy button success state
- **WHEN** 用户点击代码块复制按钮且复制成功
- **THEN** 按钮 MUST 显示复制成功状态
- **AND** 成功状态 MUST 在当前主题下保持可读

