# chat-input-area Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
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

### Requirement: 普通输入框回车不发送
会话页底部普通输入框 SHALL NOT 使用 `Enter` 触发标准发送流程；`Enter` MUST 保持文本输入行为，不得作为发送快捷键。全屏编辑器 SHALL 继续把 `Enter` 作为换行输入。

#### Scenario: 普通输入框回车不发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户在普通输入框按下 `Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程
- **AND** MUST NOT 清空输入框或对应草稿
- **AND** MUST NOT 阻止输入框的默认回车输入行为

#### Scenario: 普通输入框不可发送时按回车
- **WHEN** 普通输入框为空白、图片正在上传、仅有图片无文本或 thread 正在运行
- **AND** 用户按下 `Enter`
- **THEN** 系统 MUST NOT 触发发送
- **AND** MUST 保持现有内容和控件状态

#### Scenario: 普通输入框发送按钮发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户点击底部 composer 的「发送」按钮
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

#### Scenario: 全屏编辑器回车仍换行
- **WHEN** 用户在全屏编辑器中按下 `Enter`
- **THEN** 系统 MUST 插入换行
- **AND** MUST NOT 触发发送流程

### Requirement: 发送规则
发送按钮 SHALL 仅在输入框包含文本（或图片 + 文本）且非空白时可点；空消息（仅图片但无文本）SHALL 被禁止发送。

#### Scenario: 空消息
- **WHEN** 输入框文本为空白
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 仅图片无文本
- **WHEN** 用户已选图但文本为空
- **THEN** 发送按钮 MUST 不可点

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

### Requirement: 草稿按会话保存
未发送的输入框内容 SHALL 按 `threadId` 保存到 `localStorage`，切换会话或刷新页面后恢复。

#### Scenario: 切换会话
- **WHEN** 用户在会话 A 输入未发送内容
- **AND** 切换到会话 B
- **THEN** 会话 B 的输入框 MUST 显示其自己的草稿（如果存在）
- **AND** 切回会话 A 时 MUST 恢复 A 的草稿

#### Scenario: 发送后清空
- **WHEN** 用户成功发送一条消息
- **THEN** 该会话对应的草稿 MUST 被清空

### Requirement: 图片相册选单张
输入框左侧 SHALL 提供相册图标，点击仅打开相册选择（不调用相机），单条 turn 仅允许一张图片。

#### Scenario: 选图
- **WHEN** 用户点击相册图标
- **THEN** 系统 MUST 打开相册选择
- **AND** MUST 不打开相机

#### Scenario: 已选图
- **WHEN** 已经选过一张图且未发送
- **THEN** 再点击相册 MUST 替换原图，而非追加

### Requirement: 未发送图片缩略图与失败处理
选好图但未发送时 SHALL 在输入框上方显示缩略图，可点击 `✕` 移除；上传中显示进度环；上传失败时缩略图变红、点击重试。

#### Scenario: 选完图
- **WHEN** 用户从相册选定一张图
- **THEN** 输入框上方 MUST 显示缩略图
- **AND** 缩略图 MUST 提供 `✕` 移除按钮

#### Scenario: 上传中
- **WHEN** 用户已点发送、图片正在上传
- **THEN** 缩略图上 MUST 叠加进度环

#### Scenario: 上传失败
- **WHEN** `POST /api/codex/uploads/images` 失败
- **THEN** 缩略图 MUST 变红
- **AND** 点击 MUST 重试上传

### Requirement: turns/start 失败的可重试呈现
当用户已点发送、`POST /api/codex/turns/start` 返回失败时 SHALL 把 timeline 上的用户消息标红并提供重试按钮。

#### Scenario: 接口失败
- **WHEN** `turns/start` 返回失败
- **THEN** timeline 上对应的用户消息 MUST 变红
- **AND** MUST 提供「重试」按钮
- **AND** 错误细节 MUST 在内嵌错误卡片中显示
