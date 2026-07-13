## ADDED Requirements

### Requirement: Truncated agent output is visibly incomplete
agent message、reasoning、tool output、command output 和 diff 的正文不完整时，渲染层 SHALL 显示明确的 truncated/partial 状态和读取完整内容控件。系统 MUST 不以普通 `...` 文本冒充完整正文。

#### Scenario: Truncated tool preview
- **WHEN** tool output 仅包含 inline preview 和 contentRef
- **THEN** activity detail MUST 显示已省略 bytes/内容状态
- **AND** MUST 提供读取完整内容的明确命令

#### Scenario: Complete content loaded
- **WHEN** 用户读取全部 full-content chunks
- **THEN** 原 card/block MUST 原位显示完整内容
- **AND** 展开状态、复制入口和 timeline 顺序 MUST 保持不变

### Requirement: Long content loading remains bounded
读取完整内容时 SHALL 分 chunk 更新目标 row/block，MUST 不阻塞完整 timeline 派生或一次挂载所有历史长正文。复制完整内容只有在内容 complete 时直接复制本地全文；partial 状态 MUST 明确提示继续读取或按 chunk 服务端复制策略处理。

#### Scenario: Multiple megabyte tool output
- **WHEN** 用户展开数 MiB tool output
- **THEN** 客户端 MUST 按 chunk 读取并只更新目标 activity block
- **AND** 其他可见 Markdown、diff 和 activity blocks MUST 不重新派生

#### Scenario: Full-content request fails
- **WHEN** contentRef 请求失败或返回 repair-required
- **THEN** card MUST 保留已有 preview
- **AND** MUST 显示明确错误和可重试状态，不得变为空白
