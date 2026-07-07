## ADDED Requirements

### Requirement: Thinking details render in one layer
移动端 timeline 中的 Thinking 活动 SHALL 保留内联活动日志摘要，但展开后 MUST 直接显示公开 reasoning 内容。系统 MUST NOT 在展开区域再次显示一个需要点击的 Thinking 子行。

#### Scenario: Completed thinking expands directly
- **WHEN** timeline 渲染已完成且包含公开文本的 Thinking 活动
- **AND** 用户展开 Thinking 摘要
- **THEN** 展开区域 MUST 直接显示公开 reasoning 文本
- **AND** MUST NOT 再显示第二个 `Thinking` 展开按钮

#### Scenario: Running thinking expands directly
- **WHEN** timeline 渲染运行中且已有公开文本的 Thinking 活动
- **AND** 用户展开 `Thinking...` 摘要
- **THEN** 展开区域 MUST 直接显示当前已到达的公开 reasoning 文本
- **AND** 摘要仍 MUST 表达运行中状态

### Requirement: File change details render in one layer
移动端 timeline 中的文件变更活动 SHALL 保留文件变更汇总摘要，但展开后 MUST 直接显示每个文件的 diff 或文件输出详情。系统 MUST NOT 要求用户先展开文件变更汇总、再展开单个文件行，才能看到 diff 内容。

#### Scenario: Single file change expands directly
- **WHEN** timeline 渲染单个文件变更
- **AND** 用户展开文件变更摘要
- **THEN** 展开区域 MUST 直接显示该文件路径、增删行数和 diff 内容
- **AND** MUST NOT 再显示一个需要点击的文件子行

#### Scenario: Multiple file changes expand as file blocks
- **WHEN** timeline 渲染多个连续文件变更
- **AND** 用户展开文件变更摘要
- **THEN** 展开区域 MUST 按文件显示每个文件的路径、增删行数和 diff 或文件输出
- **AND** 每个文件详情 MUST 在同一展开区域内可读

### Requirement: Activity failure status is localized and visible
移动端内联活动日志 SHALL 使用中文展示失败状态。失败活动展开后 MUST 优先显示可用于定位问题的命令、参数、stderr、result 或 output 文本，不应把错误详情隐藏在第三层交互之后。

#### Scenario: Failed activity summary
- **WHEN** 内联活动 section 中存在失败的 command 或 tool entry
- **THEN** 摘要行 MUST 显示中文失败状态
- **AND** MUST NOT 显示英文 `Failed`

#### Scenario: Failed activity details
- **WHEN** 用户展开包含失败 entry 的活动摘要
- **THEN** 展开区域 MUST 显示失败 entry 的命令或工具身份
- **AND** 展开区域 MUST 显示可用的错误输出、result、output 或参数文本
- **AND** 用户 MUST NOT 需要再展开第三层才能看到错误详情
