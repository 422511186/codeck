## ADDED Requirements

### Requirement: Reasoning remains stable across live, completion and repair
reasoning 输出 SHALL 在 live delta、reasoning started、item completion、raw response completion 和 snapshot repair 之间使用稳定 item identity 合并。完成项文本为空时 MUST NOT 清空已公开显示的 reasoning 文本；repair 后旧 reasoning delta MUST NOT 重复追加。

#### Scenario: Empty reasoning completion preserves live text
- **WHEN** reasoning delta 已显示文本
- **AND** 后续 completion item 的 reasoning 文本为空
- **THEN** timeline MUST 保留已显示 reasoning 文本
- **AND** reasoning card MAY 标记为完成

#### Scenario: Historical repair keeps reasoning once
- **WHEN** snapshot repair 返回已完成 reasoning item
- **AND** 旧 generation 的 reasoning delta 后到
- **THEN** 前端 MUST 忽略旧 delta
- **AND** timeline MUST 只显示一张对应 reasoning card

### Requirement: Tool output remains stable across live, completion and repair
命令、MCP、dynamic tool、file output 等工具输出 SHALL 在 delta、completion item 和 snapshot repair 之间按稳定 item identity 合并。completion item 没有聚合输出时 MUST NOT 清空已流式显示的输出；snapshot 已覆盖的工具输出 delta MUST NOT 重复追加。

#### Scenario: Empty tool completion preserves streamed output
- **WHEN** command/tool output delta 已显示输出
- **AND** 后续 completion item 没有聚合输出
- **THEN** timeline MUST 保留已显示输出
- **AND** 工具卡片状态 MUST 根据 completion 更新为 success 或 failed

#### Scenario: Replayed tool output is not duplicated
- **WHEN** snapshot repair 已包含工具输出 `one\ntwo\n`
- **AND** 补发 delta 再次包含 `two\n`
- **THEN** timeline MUST NOT 把输出变成 `one\ntwo\ntwo\n`

### Requirement: Completed items update in place
agent message、reasoning、tool 和 diff 的完成项 SHALL 更新对应 live entry 的内容和状态，不得因为 completion 到达较晚而追加到 timeline 错误位置。

#### Scenario: Agent completion updates live entry
- **WHEN** agent message delta 已创建 live entry
- **AND** 后续收到同 item id 的 completed agent message
- **THEN** 前端 MUST 原位更新该 entry
- **AND** entry 的 turn metadata MUST 保留

