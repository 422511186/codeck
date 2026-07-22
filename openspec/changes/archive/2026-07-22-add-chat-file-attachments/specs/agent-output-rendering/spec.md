## MODIFIED Requirements

### Requirement: User messages hide trusted injected context
Web SHALL 从 app-server user item 中识别 Codex 明确注入的完整包装，并只显示其中的用户数据。已知 ambient/附件包装只有同时满足 `<in-app-browser-context source="ambient-ui-state">...</in-app-browser-context>` 或 `# Files mentioned by the user:` 包装，以及 `## My request for Codex:` 边界时，系统 MAY 提取 request 段；完整 `<codex_internal_context source="goal">...</codex_internal_context>` 包装只有包含唯一完整 `<objective>...</objective>` 时，系统 MAY 提取 objective。图片、普通文件、Skill 引用、`clientUserMessageId`、turn/item identity 和发送状态 MUST 保留。普通 XML、Markdown、代码块、不完整标签和用户主动输入的相似文本 MUST 原样显示。

#### Scenario: Ambient browser context is hidden
- **WHEN** server user text 包含完整 ambient browser context 和 `## My request for Codex:`
- **THEN** user bubble 与复制文本 MUST 只包含 marker 后的真实请求
- **AND** MUST 不显示注入说明、当前 URL 或包装标签

#### Scenario: Attachment metadata wrapper is hidden and attachments remain
- **WHEN** server user text 同时包含 `# Files mentioned by the user:`、request marker 和合法附件行
- **THEN** user bubble MUST 只显示真实请求
- **AND** 图片、Skill 与可恢复的普通文件附件 MUST 继续渲染
- **AND** MUST 不把临时文件路径作为用户正文显示

#### Scenario: Uploaded ordinary file metadata is recovered
- **WHEN** Files-mentioned 包装包含 uploadDir 内符合服务端上传命名规则的普通文件路径
- **THEN** Web MUST 恢复普通文件名称与稳定引用
- **AND** MUST NOT 把普通文件映射为图片或工具 mention

#### Scenario: Untrusted attachment row does not create a file chip
- **WHEN** 包装中的候选普通文件路径不符合受控上传路径规则
- **THEN** Web MUST NOT 为该行创建普通文件附件 chip
- **AND** MUST NOT 暴露该候选路径到可见正文、复制文本或无障碍标签

#### Scenario: Goal continuation displays its objective
- **WHEN** server user text 完整匹配 `source="goal"` 的 internal context，且只包含一个完整 objective
- **THEN** user bubble 与复制文本 MUST 显示 objective 正文
- **AND** MUST 不显示 continuation、budget、fidelity 或 completion audit 等内置提示，也不得渲染为空白 user row

#### Scenario: User-authored objective markup is preserved
- **WHEN** 用户主动输入普通 `<objective>`，或 goal internal context 缺少可信 source、完整外层边界或唯一 objective
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 猜测或提取局部 objective

#### Scenario: User-authored markup is preserved
- **WHEN** 用户正文包含普通 XML/Markdown，或只有相似 marker 但不构成完整已知包装
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 使用宽泛正则删除用户内容
