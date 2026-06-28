## ADDED Requirements

### Requirement: 普通输入框回车发送
会话页底部普通输入框 SHALL 支持按 `Enter` 触发标准发送流程；全屏编辑器 SHALL 继续把 `Enter` 作为换行输入。

#### Scenario: 普通输入框回车发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户在普通输入框按下 `Enter`
- **THEN** 系统 MUST 阻止默认换行
- **AND** MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

#### Scenario: 普通输入框不可发送时按回车
- **WHEN** 普通输入框为空白、图片正在上传、仅有图片无文本或 thread 正在运行
- **AND** 用户按下 `Enter`
- **THEN** 系统 MUST NOT 触发发送
- **AND** MUST 保持现有内容和控件状态

#### Scenario: 全屏编辑器回车仍换行
- **WHEN** 用户在全屏编辑器中按下 `Enter`
- **THEN** 系统 MUST 插入换行
- **AND** MUST NOT 触发发送流程

## MODIFIED Requirements

### Requirement: 底部输入区固定单行 + 全屏编辑器
会话页底部在 thread 静止时 SHALL 固定显示空闲态 composer；composer SHALL 包含一级图片入口、文本输入区、全屏编辑入口和发送按钮。输入区 SHALL 优先保持单行，内容超过 3 行时 MUST 内部滚动而非继续撑高；点击全屏编辑入口后 SHALL 弹出全屏编辑器。

#### Scenario: 默认输入
- **WHEN** thread 静止且用户在会话页打字
- **THEN** 底部 composer MUST 显示图片入口、普通输入框、全屏编辑入口和发送按钮
- **AND** 普通输入框 MUST 优先单行显示
- **AND** 内容超过 3 行时 MUST 内部滚动而非继续撑高

#### Scenario: 图片入口保持一级可见
- **WHEN** thread 静止且底部 composer 渲染
- **THEN** 图片入口 MUST 作为一级操作可见
- **AND** 用户 MUST 能直接打开相册选择图片

#### Scenario: 进入全屏
- **WHEN** 用户点击全屏编辑入口
- **THEN** MUST 弹出全屏编辑器
- **AND** 编辑器顶部 MUST 显示「取消」与「发送」按钮
- **AND** 主体 MUST 是全屏输入区域

#### Scenario: 全屏中按回车
- **WHEN** 用户在全屏编辑器中按回车键
- **THEN** MUST 插入换行
- **AND** MUST 不发送消息

#### Scenario: 全屏发送
- **WHEN** 用户点击全屏编辑器顶部的「发送」
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 全屏编辑器 MUST 关闭

### Requirement: Agent 跑中显示状态栏与中断
当当前 thread 处于运行态（has active turn）时，底部发送区 SHALL 切换为运行态状态栏。状态栏 SHALL 显示 agent 正在生成的状态提示，并把中断按钮作为唯一主要操作。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 底部发送区 MUST 显示运行态状态栏
- **AND** MUST 显示「正在生成…」或等价状态提示
- **AND** MUST 显示中断按钮
- **AND** MUST 不显示普通输入框、图片入口、全屏编辑入口、发送按钮或重发入口

#### Scenario: 点击中断
- **WHEN** 用户点击中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** 输入区 MUST 在 thread 恢复静止后重新显示空闲态 composer

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口

### Requirement: 「↺ 重发上一条」按钮
底部输入区 SHALL 保留「重发上一条」能力，仅当 thread 静止且存在可重发的上一条 user 消息时可用。重发入口 SHALL 作为次级操作呈现，不得在运行态显示，也不得挤占发送按钮的主要位置。

#### Scenario: 静止时点击
- **WHEN** thread 静止且最后一条 turn 的 user 消息可获取
- **AND** 用户触发「重发上一条」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/rollback`（默认 1 个 turn）
- **AND** rollback 成功后 MUST 把原 user 消息文本充填到输入框
- **AND** 用户 MUST 能在发送前修改文本

#### Scenario: 运行中
- **WHEN** thread 处于运行态
- **THEN** 「重发上一条」入口 MUST 不显示
- **AND** 用户 MUST 不可触发 rollback
