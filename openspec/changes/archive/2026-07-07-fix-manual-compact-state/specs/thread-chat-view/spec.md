## MODIFIED Requirements

### Requirement: 压缩上下文需弹确认对话框
压缩上下文 SHALL 仅在会话状态明确为 `idle` 时允许发起。用户点击后 SHALL 弹出确认对话框，确认后才调用后端；请求 pending 期间页面 SHALL 给出进行中反馈，但 MUST NOT 本地追加「正在压缩上下文…」timeline 系统消息；完成后 timeline 的系统消息 MUST 来自 app-server live item / compact 事件。

#### Scenario: 弹出确认
- **WHEN** 用户点击「压缩上下文」
- **THEN** 系统 MUST 弹出确认对话框，说明压缩不可逆

#### Scenario: 确认压缩
- **WHEN** 用户在对话框中确认
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`
- **AND** 页面 MUST 显示压缩进行中反馈
- **AND** timeline MUST NOT 立即追加本地「正在压缩上下文…」系统消息
- **AND** 压缩完成后 timeline MUST 通过 app-server live item / compact 事件插入「压缩上下文已完成」系统消息

#### Scenario: 非空闲禁止压缩
- **WHEN** 当前会话状态不是 `idle`
- **THEN** 系统 MUST 不展示可点击的「压缩上下文」入口
- **AND** 系统 MUST 不调用 `POST /api/codex/threads/:threadId/compact`
