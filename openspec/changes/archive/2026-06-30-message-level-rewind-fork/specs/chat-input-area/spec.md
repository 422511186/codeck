## MODIFIED Requirements

### Requirement: Agent 跑中显示状态栏与中断
当当前 thread 处于运行态（has active turn）时，底部发送区 SHALL 切换为运行态状态栏。状态栏 SHALL 显示 agent 正在生成的状态提示，并把中断按钮作为唯一主要操作。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 底部发送区 MUST 显示运行态状态栏
- **AND** MUST 显示「正在生成…」或等价状态提示
- **AND** MUST 显示中断按钮
- **AND** MUST 不显示普通输入框、图片入口、全屏编辑入口或发送按钮

#### Scenario: 点击中断
- **WHEN** 用户点击中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** 输入区 MUST 在 thread 恢复静止后重新显示空闲态 composer

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口

## REMOVED Requirements

### Requirement: 「↺ 重发上一条」按钮
**Reason**: 「重发上一条」只能表达会话最新位置的编辑重发，和新的消息级「回滚到这里」语义冲突。回滚入口必须绑定到用户选择的具体 user message。

**Migration**: 使用 `timeline-message-actions` 中的「回滚到这里」。底部输入区不再提供任何重发入口。
