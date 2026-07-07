## ADDED Requirements

### Requirement: Timeline file activities use diff view
移动端 timeline 中的文件变更 activity 展开后 SHALL 使用结构化 diff view 展示变更内容。diff view MUST 显示文件路径、增删统计、hunk、行号和新增/删除染色，并 MUST 保留复制完整 diff 的路径。系统 MUST NOT 在文件变更 activity 展开后只以纯文本 `<pre>` 展示 diff。

#### Scenario: Diff entry expands with structured diff view
- **WHEN** timeline 中 `body.kind` 为 `diff` 的文件变更 activity 被展开
- **THEN** 展开区域 MUST 显示该文件路径和 `+N -N` 统计
- **AND** 展开区域 MUST 以 diff view 显示 hunk、旧行号、新行号以及新增/删除染色
- **AND** 展开区域 MUST 提供复制完整 diff 的操作

#### Scenario: File tool activity expands with structured diff view
- **WHEN** timeline 中 `toolKind` 为 `file` 的 activity 包含 diff、patch 或文件输出文本
- **AND** 用户展开 `Files changed` 摘要
- **THEN** 展开区域 MUST 使用 diff view 或等价可读 diff fallback 展示该文本
- **AND** 用户 MUST 不需要再展开文件子行才能看到变更内容

#### Scenario: Multiple file activities stay one-layer
- **WHEN** 一个 activity section 中包含多个文件变更 entry
- **AND** 用户展开 `Files changed` 摘要
- **THEN** 展开区域 MUST 按 entry 顺序直接显示每个文件的路径、统计和 diff view
- **AND** MUST NOT 为每个文件再渲染需要点击的第二层展开按钮

#### Scenario: Long diff remains bounded
- **WHEN** 文件变更 diff 超过默认展示上限
- **THEN** 展开态 MUST 只渲染有界预览
- **AND** 用户 MUST 能复制完整 diff 文本
- **AND** 折叠态 MUST NOT 构造完整 diff rows DOM
