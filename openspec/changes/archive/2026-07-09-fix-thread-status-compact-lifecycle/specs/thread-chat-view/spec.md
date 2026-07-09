## MODIFIED Requirements

### Requirement: 压缩上下文需弹确认对话框
压缩上下文 SHALL 仅在当前会话状态明确为 `idle` 时允许发起。会话页 MUST 以实时 thread status 作为 compact 可用性的主状态来源，初始 thread detail 只能作为首屏 fallback。用户点击后 SHALL 弹出确认对话框，确认后才调用后端；请求 pending 期间页面 SHALL 给出进行中反馈，但 MUST NOT 本地追加「正在压缩上下文…」timeline 系统消息；完成后 timeline 的系统消息 MUST 来自 app-server live item / compact 事件。失败后页面 MUST 展示错误并刷新当前 thread status，使入口不会被 stale `detail.status` 或 stale `running` 永久锁死。

#### Scenario: 弹出确认
- **WHEN** 用户点击「压缩上下文」
- **AND** 当前 thread status 为 `idle`
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

#### Scenario: 运行中显示运行中禁用原因
- **WHEN** 当前 thread status 为 `active`
- **THEN** compact 入口 MUST 显示运行中不可压缩的反馈
- **AND** 页面 MUST NOT 因本地 `detail.status` 陈旧而显示“当前状态不可压缩”

#### Scenario: 压缩失败后刷新状态
- **WHEN** 用户确认压缩后后端返回失败或请求超时
- **THEN** 页面 MUST 结束 compact pending 状态
- **AND** timeline MUST 追加一条压缩失败错误
- **AND** 页面 MUST 读取 summary 或使用响应中的 thread status 同步当前状态
- **AND** compact 入口 MUST 基于同步后的状态重新渲染

#### Scenario: 状态事件解除本地 active
- **WHEN** 首屏 detail status 为 `active`
- **AND** 后续 event stream 或 summary 返回该 thread status 为 `idle`
- **THEN** 页面 MUST 停止显示 processing UI
- **AND** compact 入口 MUST 在没有 pending compact 时恢复为可点击

#### Scenario: 不可恢复状态提供恢复路径
- **WHEN** 当前 thread status 为 `notLoaded` 或 `systemError`
- **THEN** compact 入口 MUST NOT 直接调用 compact API
- **AND** UI MUST 提供明确的恢复后再压缩路径或可重试错误反馈
- **AND** 恢复成功后 MUST 重新基于最新 thread status 判断 compact 是否可用

### Requirement: Context usage detail sheet
上下文进度区域 SHALL 可点击并打开底部详情面板。详情面板 MUST 展示总 token、模型上下文窗口、百分比、输入 token、输出 token、推理输出 token，并提供“压缩上下文”入口；压缩入口 MUST 复用现有确认对话框，确认后才调用压缩接口。详情面板中的压缩入口 MUST 与会话头部菜单使用同一 thread status 和 compact pending 状态，不得使用陈旧 detail 状态单独判断。

#### Scenario: 打开详情面板
- **WHEN** 用户点击 header 下方可用的上下文进度区域
- **THEN** 系统 MUST 从底部打开上下文用量详情面板
- **AND** 面板 MUST 显示 `totalTokens / modelContextWindow` 与百分比
- **AND** 面板 MUST 显示输入、输出和推理输出 token 明细

#### Scenario: 从详情发起压缩
- **WHEN** 用户在上下文用量详情面板点击「压缩上下文」
- **AND** 当前 thread status 为 `idle`
- **THEN** 系统 MUST 关闭详情面板并打开现有压缩确认对话框
- **AND** 只有用户在确认对话框确认后，系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`

#### Scenario: 详情面板非 idle 禁用压缩
- **WHEN** 上下文用量详情面板打开
- **AND** 当前 thread status 不是 `idle` 或 compact request pending
- **THEN** 面板 MUST 不显示可点击的压缩按钮
- **AND** 面板 MUST 显示与头部菜单一致的禁用原因

#### Scenario: 无进度时不可打开详情
- **WHEN** 当前会话没有可用上下文窗口进度
- **THEN** header 下方未知占位条 MUST 不提供上下文用量详情入口
