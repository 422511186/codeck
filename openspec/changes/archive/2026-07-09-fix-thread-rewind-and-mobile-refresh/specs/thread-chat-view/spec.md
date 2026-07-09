## ADDED Requirements

### Requirement: Mobile refresh recovers new thread detail
手机端刷新会话页时，系统 SHALL 对刚创建、尚未 materialized 或短暂未加载的 thread 提供可恢复读取路径。若 thread 已存在但 timeline 尚为空，页面 MUST 显示可交互的空会话，而不是直接进入不可用错误页。

#### Scenario: Refresh newly created empty thread
- **WHEN** 用户在手机端创建新会话并立即刷新 `/threads/{threadId}`
- **AND** app-server 首次读取该 thread 的 turns 时报告未 materialized、未加载或 first user message 前不可用
- **THEN** 页面 MUST 恢复为空 timeline 的会话详情
- **AND** 用户 MUST 能继续输入第一条消息

#### Scenario: Transient read failure retries before error
- **WHEN** 手机端刷新会话页时首次 `readThread` 遇到可恢复的 transient thread read 错误
- **THEN** 客户端 MUST 执行有限重试或 resume/read fallback
- **AND** 只有恢复失败后才显示错误页

#### Scenario: Existing cached timeline remains visible on read failure
- **WHEN** 刷新或修复读取失败
- **AND** 当前 store 已有该 thread 的 timeline entries
- **THEN** 页面 MUST 保留可见 timeline
- **AND** MUST 以非破坏方式展示读取失败反馈
