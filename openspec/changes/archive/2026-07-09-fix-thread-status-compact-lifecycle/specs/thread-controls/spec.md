## MODIFIED Requirements

### Requirement: 压缩上下文需要确认且禁用输入
会话状态明确为 `idle` 时点击「压缩上下文」SHALL 弹出确认对话框（说明该操作不可逆）；确认后调用 `POST /api/codex/threads/:threadId/compact`，并通过页面进行中状态给出反馈，但 MUST NOT 本地追加「正在压缩上下文…」timeline 系统消息；完成后 MUST 由 app-server live item / compact 事件在 timeline 插入系统消息。会话非 `idle` 时 SHALL 不提供可点击的压缩入口。抽屉中的 compact 可用性 MUST 来自实时 thread status，不得被 stale `detail.status` 或 stale `running` 单独锁死。

#### Scenario: 确认对话框
- **WHEN** 用户在抽屉点击「压缩上下文」
- **AND** 当前 thread status 为 `idle`
- **THEN** 系统 MUST 弹出确认对话框
- **AND** 文案 MUST 提示该操作不可逆

#### Scenario: 进行中显示反馈
- **WHEN** 压缩接口在响应中且未完成
- **THEN** 页面 MUST 显示「正在压缩上下文…」或等价进行中反馈
- **AND** timeline MUST NOT 本地追加「正在压缩上下文…」系统消息
- **AND** 抽屉和上下文详情面板 MUST 不再提供第二个可点击压缩入口

#### Scenario: 会话非空闲禁止压缩
- **WHEN** 当前会话状态不是 `idle`
- **THEN** 抽屉 MUST 不展示可点击的「压缩上下文」操作
- **AND** 前端 MUST 不调用压缩接口

#### Scenario: 运行中禁用文案
- **WHEN** 当前 thread status 为 `active`
- **THEN** 抽屉 MUST 显示运行中不可压缩或等价文案
- **AND** 该文案 MUST 优先于通用“当前状态不可压缩”

#### Scenario: 恢复后重新判断
- **WHEN** 当前 thread status 为 `notLoaded` 或 `systemError`
- **AND** 用户通过 UI 恢复会话成功
- **THEN** 抽屉 MUST 使用恢复后最新 thread status 重新判断 compact 可用性
- **AND** 若恢复后 status 为 `idle`，抽屉或后续打开的抽屉 MUST 提供可点击压缩入口

#### Scenario: 完成插入系统消息
- **WHEN** 压缩完成
- **THEN** timeline MUST 通过 app-server live item / compact 事件插入一条「压缩上下文已完成」的系统消息（居中细线 + 灰色小字）
- **AND** 页面 MUST 结束 compact 进行中反馈

#### Scenario: 失败后可继续操作
- **WHEN** compact 请求失败
- **THEN** 页面 MUST 结束 compact 进行中反馈
- **AND** 抽屉下次打开时 MUST 基于最新 thread status 展示可压缩、运行中不可压缩或恢复后再压缩
- **AND** 页面 MUST NOT 要求用户刷新才能恢复按钮状态
