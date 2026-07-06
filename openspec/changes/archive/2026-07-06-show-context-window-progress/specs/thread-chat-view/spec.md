## ADDED Requirements

### Requirement: Header context window progress
会话聊天页 SHALL 在 sticky header 下方显示当前会话上下文窗口区域。当系统拥有该会话最近一次 `modelContextWindow` 和最近一次请求 token 用量时，进度区域 MUST 显示一条细进度线和百分比；当缺少可靠用量或窗口大小时，系统 MUST 显示不可点击的未知占位条，且不得伪造百分比。

#### Scenario: 显示可用上下文进度
- **WHEN** 当前会话存在最近一次上下文用量，且 `modelContextWindow` 大于 0
- **THEN** header 下方 MUST 显示上下文进度线
- **AND** 进度线 MUST 按 `totalTokens / modelContextWindow` 显示占用比例
- **AND** 进度区域 MUST 显示四舍五入后的百分比

#### Scenario: 缺少用量或窗口大小时显示未知占位
- **WHEN** 当前会话没有最近一次上下文用量，或 `modelContextWindow` 为空、为 0 或小于 0
- **THEN** header 下方 MUST 显示上下文未知占位条
- **AND** 占位条 MUST 不显示可计算百分比
- **AND** 占位条 MUST 不提供上下文用量详情入口

#### Scenario: 进度颜色按阈值变化
- **WHEN** 上下文进度百分比小于 60
- **THEN** 进度线 MUST 使用健康色
- **WHEN** 上下文进度百分比大于等于 60 且小于 80
- **THEN** 进度线 MUST 使用琥珀色
- **WHEN** 上下文进度百分比大于等于 80 且小于 95
- **THEN** 进度线 MUST 使用橙色
- **WHEN** 上下文进度百分比大于等于 95
- **THEN** 进度线 MUST 使用红色
- **AND** 系统 MUST NOT 因达到任一阈值而弹出提示或自动展示压缩按钮

### Requirement: Context usage updates and local restore
会话聊天页 SHALL 通过现有 `token_usage_updated` 浏览器事件更新线程级上下文用量，并按 `threadId` 在本地缓存最近一次可靠用量。重新打开或刷新会话时，系统 MUST 先使用会话详情中的历史上下文用量，其次恢复该会话缓存值；后续实时事件 MUST 覆盖已有值。

#### Scenario: 实时事件更新进度
- **WHEN** 前端收到当前会话的 `token_usage_updated` 事件
- **THEN** 线程状态 MUST 保存该事件最近一次请求用量中的 `totalTokens`、`inputTokens`、`outputTokens`、`reasoningOutputTokens` 和 `modelContextWindow`
- **AND** header 下方上下文进度 MUST 使用最新事件重新渲染
- **AND** 系统 MUST 将最近一次用量写入该 `threadId` 的本地缓存

#### Scenario: 打开会话恢复历史用量
- **WHEN** 用户打开某个会话，且会话详情从历史 `token_count` 记录恢复出最近一次上下文用量
- **THEN** 系统 MUST 将该用量写入线程状态和本地缓存
- **AND** header 下方上下文进度 MUST 显示真实百分比而不是未知占位

#### Scenario: 打开会话恢复缓存
- **WHEN** 用户打开某个会话，且该会话存在本地缓存的最近上下文用量
- **THEN** 系统 MUST 在收到新的实时事件前使用缓存值显示上下文进度

#### Scenario: 实时事件覆盖缓存
- **WHEN** 会话已使用缓存值显示上下文进度
- **AND** 前端收到同一会话新的 `token_usage_updated` 事件
- **THEN** 系统 MUST 使用新事件覆盖线程状态和本地缓存

### Requirement: Context usage detail sheet
上下文进度区域 SHALL 可点击并打开底部详情面板。详情面板 MUST 展示总 token、模型上下文窗口、百分比、输入 token、输出 token、推理输出 token，并提供“压缩上下文”入口；压缩入口 MUST 复用现有确认对话框，确认后才调用压缩接口。

#### Scenario: 打开详情面板
- **WHEN** 用户点击 header 下方可用的上下文进度区域
- **THEN** 系统 MUST 从底部打开上下文用量详情面板
- **AND** 面板 MUST 显示 `totalTokens / modelContextWindow` 与百分比
- **AND** 面板 MUST 显示输入、输出和推理输出 token 明细

#### Scenario: 从详情发起压缩
- **WHEN** 用户在上下文用量详情面板点击「压缩上下文」
- **THEN** 系统 MUST 关闭详情面板并打开现有压缩确认对话框
- **AND** 只有用户在确认对话框确认后，系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`

#### Scenario: 无进度时不可打开详情
- **WHEN** 当前会话没有可用上下文窗口进度
- **THEN** header 下方未知占位条 MUST 不提供上下文用量详情入口
