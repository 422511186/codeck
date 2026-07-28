## ADDED Requirements

### Requirement: Full-content user messages update visible body
客户端 SHALL 在 full-content 读取成功并通过 identity 校验后，将完整正文应用到所有支持文本正文的可见 timeline entry，包括 `user-message`。用户消息的可见气泡、复制内容以及后续基于该条消息的重试、rewind 和 fork 操作 MUST 使用已加载的完整正文，MUST NOT 只更新 footer 或 store 而继续显示旧 preview。

#### Scenario: Truncated user message expands in place
- **WHEN** timeline 渲染一条带 `contentRef` 的 truncated `user-message`
- **AND** 用户点击「读取完整内容」且响应与当前 entry identity 匹配
- **THEN** 用户消息气泡 MUST 原位显示完整正文
- **AND** 该 entry 的 completeness MUST 变为 complete
- **AND** timeline MUST NOT 继续显示旧 preview 作为用户消息正文

#### Scenario: User message actions use loaded full text
- **WHEN** truncated `user-message` 的完整正文已成功加载
- **AND** 用户随后对该消息执行重发、rewind 或 fork
- **THEN** 操作载荷 MUST 使用完整正文
- **AND** MUST 保留原 entry 的 turn identity、图片、Skill 与普通文件附件元数据
