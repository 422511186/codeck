## ADDED Requirements

### Requirement: 底部输入区固定单行 + 全屏编辑器
会话页底部 SHALL 固定显示一行输入框；输入框右侧 SHALL 提供 `⤢` 扩展图标，点击后弹出全屏编辑器。

#### Scenario: 默认输入
- **WHEN** 用户在会话页打字
- **THEN** 底部输入框 MUST 单行显示
- **AND** 内容超过 3 行时 MUST 内部滚动而非继续撑高

#### Scenario: 进入全屏
- **WHEN** 用户点击 `⤢` 图标
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

### Requirement: 发送规则
发送按钮 SHALL 仅在输入框包含文本（或图片 + 文本）且非空白时可点；空消息（仅图片但无文本）SHALL 被禁止发送。

#### Scenario: 空消息
- **WHEN** 输入框文本为空白
- **THEN** 发送按钮 MUST 不可点

#### Scenario: 仅图片无文本
- **WHEN** 用户已选图但文本为空
- **THEN** 发送按钮 MUST 不可点

### Requirement: Agent 跑中发送按钮变中断
当当前 thread 处于运行态（has active turn）时 SHALL 把发送按钮替换为中断按钮（`■`）。

#### Scenario: 进入运行态
- **WHEN** thread 状态变为运行中
- **THEN** 发送按钮 MUST 切换为中断样式
- **AND** 输入框 MUST 禁用以阻止用户继续打字

#### Scenario: 点击中断
- **WHEN** 用户点击中断按钮
- **THEN** 前端 MUST 调用 `POST /api/codex/turns/:threadId/interrupt`
- **AND** 输入框 MUST 立即恢复可输入

#### Scenario: 不暴露 steer
- **WHEN** thread 处于运行态
- **THEN** UI MUST 不提供 steer 入口

### Requirement: 「↺ 重发上一条」按钮
底部输入框右侧 SHALL 提供「↺ 重发」按钮，仅当 thread 静止且存在可重发的上一条 user 消息时可点。

#### Scenario: 静止时点击
- **WHEN** thread 静止且最后一条 turn 的 user 消息可获取
- **AND** 用户点击「↺ 重发」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/rollback`（默认 1 个 turn）
- **AND** rollback 成功后 MUST 把原 user 消息文本充填到输入框
- **AND** 用户 MUST 能在发送前修改文本

#### Scenario: 运行中
- **WHEN** thread 处于运行态
- **THEN** 「↺ 重发」按钮 MUST 灰掉不可点

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
