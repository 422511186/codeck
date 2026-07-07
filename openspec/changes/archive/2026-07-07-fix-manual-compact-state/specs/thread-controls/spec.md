## MODIFIED Requirements

### Requirement: 压缩上下文需要确认且禁用输入
会话状态明确为 `idle` 时点击「压缩上下文」SHALL 弹出确认对话框（说明该操作不可逆）；确认后调用 `POST /api/codex/threads/:threadId/compact`，并通过页面进行中状态给出反馈，但 MUST NOT 本地追加「正在压缩上下文…」timeline 系统消息；完成后 MUST 由 app-server live item / compact 事件在 timeline 插入系统消息。会话非 `idle` 时 SHALL 不提供可点击的压缩入口。

#### Scenario: 确认对话框
- **WHEN** 用户在抽屉点击「压缩上下文」
- **THEN** 系统 MUST 弹出确认对话框
- **AND** 文案 MUST 提示该操作不可逆

#### Scenario: 进行中显示反馈
- **WHEN** 压缩接口在响应中且未完成
- **THEN** 页面 MUST 显示「正在压缩上下文…」或等价进行中反馈
- **AND** timeline MUST NOT 本地追加「正在压缩上下文…」系统消息

#### Scenario: 会话非空闲禁止压缩
- **WHEN** 当前会话状态不是 `idle`
- **THEN** 抽屉 MUST 不展示可点击的「压缩上下文」操作
- **AND** 前端 MUST 不调用压缩接口

#### Scenario: 完成插入系统消息
- **WHEN** 压缩完成
- **THEN** timeline MUST 通过 app-server live item / compact 事件插入一条「压缩上下文已完成」的系统消息（居中细线 + 灰色小字）
