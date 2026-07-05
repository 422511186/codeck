## MODIFIED Requirements

### Requirement: Agent 跑中显示状态栏与中断
当当前 thread 处于运行态（has active turn）时，底部 composer SHALL 保持可见并允许用户准备下一次发送内容。composer SHALL 将右侧发送按钮切换为中断按钮；中断按钮是运行中的唯一主要执行操作。运行中准备的文本、图片和 Skill 引用 SHALL 只作为下一次手动发送的草稿，不得自动发送，也不得发送到当前正在执行的 turn。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 底部 composer MUST 继续显示普通输入框、`+` 添加入口、权限模式 chip、模型/思考档位 chip 和已选上下文区域
- **AND** composer 右侧 MUST 显示中断按钮
- **AND** composer 右侧 MUST 不显示发送按钮
- **AND** 系统 MUST NOT 清空当前草稿、已选图片或已选 Skill

#### Scenario: 运行中准备下一条输入
- **WHEN** thread 处于运行态
- **AND** 用户编辑输入框、选择图片或选择 Skill
- **THEN** 系统 MUST 保存这些内容作为该 thread 的待发送 composer 状态
- **AND** 这些内容 MUST NOT 触发标准发送流程
- **AND** 这些内容 MUST NOT 调用 `turn/steer`

#### Scenario: 运行结束后发送准备好的内容
- **WHEN** thread 从运行态恢复静止
- **AND** composer 中存在非空文本且图片状态允许发送
- **THEN** composer 右侧 MUST 恢复显示发送按钮
- **AND** 用户点击发送后系统 MUST 按标准发送流程提交文本、图片和 Skill 引用

#### Scenario: 点击中断
- **WHEN** 用户点击运行中 composer 右侧的中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** composer 中已准备但尚未发送的文本、图片和 Skill 引用 MUST 保留

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口
- **AND** 运行中输入的普通文本 MUST 不作为 steer 请求发送
