## ADDED Requirements

### Requirement: Persisted Codex warnings remain warnings

客户端恢复历史 timeline 时 MUST 识别已确认的 Codex 持久化系统提醒（包括 `Heads up: Long threads and multiple compactions...`，允许空白差异）并将其转为可去重的 warning notice。该兼容识别 MUST NOT 影响非匹配的真实 turn error。

#### Scenario: Long-thread reminder survives refresh

- **WHEN** thread/read 或 turn item history 将 `Heads up: Long threads and multiple compactions can cause the model to be less accurate. Start a new thread when possible to keep threads small and targeted.` 恢复为 error 文本
- **THEN** timeline adapter MUST 从 timeline 移除该 legacy error
- **AND** 会话 MUST 出现 `source: "app-server"` 的 warning notice
- **AND** 页面 MUST NOT 渲染“操作失败”错误卡片

#### Scenario: Real error remains an error

- **WHEN** 历史恢复的 error 文本不匹配已知 Codex warning
- **THEN** timeline adapter MUST 保留原 error entry
- **AND** 页面 MUST 继续使用真实错误的 alert 语义

#### Scenario: Replayed warning is deduplicated

- **WHEN** 同一 warning 同时出现在 snapshot、turn detail 和实时事件中
- **THEN** store MUST 只保留一个相同 warning notice
- **AND** timeline entry 数量 MUST 不因重复来源增加
