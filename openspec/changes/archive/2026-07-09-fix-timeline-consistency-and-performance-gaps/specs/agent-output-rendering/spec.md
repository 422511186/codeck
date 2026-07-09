## MODIFIED Requirements

### Requirement: 长输出默认有界展示
命令输出、工具结果、reasoning 文本、diff、inline activity 展开详情和超长 agent 消息 SHALL 在默认展示状态下限制 DOM 文本量或行数。系统 MUST 保留查看完整内容的路径，但默认状态和普通展开态 MUST 避免把完整大文本直接挂载到主 timeline。

#### Scenario: 命令输出超过展示上限
- **WHEN** 命令输出超过默认展示上限
- **THEN** 折叠态 MUST 只显示命令摘要和状态
- **AND** 展开态 MUST 在内部滚动区域展示有限预览
- **AND** 用户 MUST 能通过明确操作查看或复制完整输出

#### Scenario: 工具结果超过展示上限
- **WHEN** MCP、dynamic、web 或 file 工具结果文本很长
- **THEN** 默认卡片 MUST 显示工具身份和摘要
- **AND** MUST NOT 将完整结果直接推入首屏 DOM

#### Scenario: Diff 超过展示上限
- **WHEN** diff 行数超过默认展示上限
- **THEN** 折叠态 MUST 只显示文件路径和增删统计
- **AND** 展开态 MUST 使用内部滚动或分段渲染显示 diff 预览
- **AND** 用户 MUST 能访问完整 diff 文本

#### Scenario: Inline activity 展开长文本
- **WHEN** 用户展开包含长参数、stdout、stderr、result、raw response 或 fallback 文本的 inline activity
- **THEN** 展开区域 MUST 使用有界预览、内部滚动或分段渲染
- **AND** MUST NOT 直接在主 timeline 中挂载完整长文本 `<pre>`

### Requirement: 长输出渲染预算必须保持有界
agent 输出渲染层 SHALL 在大会话和高频 delta 下保持有界 DOM 与 Markdown 工作量。长 Markdown、reasoning、命令输出、tool result、diff、inline activity 展开详情和 raw response fallback MUST 继续按可见窗口、折叠状态、展开状态或空闲时机懒渲染，MUST NOT 因 normalized entries 或 activity 展开引入全量挂载。

#### Scenario: 大会话滚动
- **WHEN** 会话包含大量历史 turns 和长工具输出
- **THEN** timeline MUST 只挂载可见窗口和必要 buffer 内的 rows
- **AND** 窗口外长 Markdown、diff 和 tool result MUST NOT 全量渲染到 DOM

#### Scenario: 高频 agent delta
- **WHEN** 当前 agent message 高频追加文本
- **THEN** 渲染层 MUST 只更新当前可见且受影响的输出区域
- **AND** MUST NOT 因每个 delta 重新计算或重新挂载整个历史 timeline

#### Scenario: Activity 展开不破坏预算
- **WHEN** 用户展开一个包含超长文本的 inline activity
- **THEN** timeline MUST 只挂载该 activity 的有限预览或可滚动片段
- **AND** 其他 timeline rows MUST NOT 因该展开操作重建完整长输出 DOM
