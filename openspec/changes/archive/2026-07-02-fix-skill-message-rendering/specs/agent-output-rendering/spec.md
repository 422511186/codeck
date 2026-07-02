## MODIFIED Requirements

### Requirement: 命令折叠态只显示命令
当 agent 调用 shell 命令时 SHALL 在 timeline 上以折叠卡片呈现，折叠状态下 SHALL 优先显示命令本身或命令摘要（如 `npm test`），不显示输出内容。若命令项同时包含工作目录等元数据，折叠态主标题 MUST 不让长路径优先于命令内容。

#### Scenario: 命令折叠呈现
- **WHEN** agent 发起一次 shell 命令调用
- **THEN** 折叠卡片 MUST 显示完整命令行或在空间不足时显示命令摘要
- **AND** MUST 不预览任何输出
- **AND** 工作目录等长元数据 MUST 不抢占命令标题的主要位置

#### Scenario: 展开后查看输出
- **WHEN** 用户点击命令卡片展开
- **THEN** 卡片 MUST 显示该命令的完整输出
- **AND** 输出区 MUST 限制最高 N 行（建议 24 行），超出部分内部可滚动
- **AND** 若存在工作目录等元数据，展开后 MUST 仍可查看

## ADDED Requirements

### Requirement: 工具卡片折叠态摘要面向移动端阅读优化
工具卡片折叠态 SHALL 优先展示用户能快速理解的动作、工具名或命令摘要，低优先级元数据（如 cwd、完整路径、长 JSON 参数）SHALL 放到次要区域或展开内容中。卡片 SHALL 保留可追踪性，但默认展示 MUST 避免把 agent 正文回答明显下推。

#### Scenario: 命令工具优先显示命令
- **WHEN** timeline 渲染 `toolKind` 为 `command` 的工具卡片
- **THEN** 折叠态标题 MUST 优先显示命令内容
- **AND** cwd MUST 不作为标题最前面的主要文本

#### Scenario: 非命令工具保留工具身份
- **WHEN** timeline 渲染 MCP、dynamic、file、web 或 image 工具卡片
- **THEN** 折叠态 MUST 显示工具身份或动作名称
- **AND** 长参数或长路径 MUST 不导致标题横向溢出
