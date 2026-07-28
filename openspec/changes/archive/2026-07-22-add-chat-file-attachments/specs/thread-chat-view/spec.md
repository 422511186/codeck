## ADDED Requirements

### Requirement: 用户消息展示普通文件附件
会话 timeline SHALL 将普通文件作为用户消息气泡内的结构化附件 chip 展示。文件 chip MUST 显示可读文件名和文件语义图标，MUST NOT 显示绝对路径，也 MUST NOT 在首版提供通用预览或下载操作。

#### Scenario: 普通文件与正文属于同一消息气泡
- **WHEN** timeline 渲染一条包含 `fileReferences` 的用户消息
- **THEN** Skill、图片、普通文件与正文 MUST 位于同一个用户消息气泡内
- **AND** 展示顺序 MUST 为 Skill、图片、普通文件、正文
- **AND** timeline MUST NOT 为普通文件创建独立消息行或第二个气泡

#### Scenario: 文件名适配手机宽度
- **WHEN** 一条消息包含多个普通文件或超长文件名
- **THEN** 文件 chip MUST 在完整 chip 之间自动换行
- **AND** 单个文件名 MUST 省略溢出内容
- **AND** 气泡 MUST 不产生横向滚动

#### Scenario: 路径不进入可见内容
- **WHEN** 普通文件引用包含服务端绝对路径
- **THEN** user bubble、复制文本、无障碍名称和 tooltip MUST NOT 暴露绝对路径
- **AND** 复制用户消息 MUST 只复制用户正文

#### Scenario: 首版文件 chip 不可打开
- **WHEN** 用户点击或长按普通文件 chip
- **THEN** 系统 MUST NOT 导航到本地路径
- **AND** MUST NOT 发起通用预览或下载请求

### Requirement: 普通文件附件可从历史恢复
Web SHALL 从可信 Files-mentioned 包装或结构化 timeline 元数据恢复普通文件附件。乐观消息、实时确认、snapshot repair、历史分页和页面刷新 MUST 对同一用户消息呈现一致的文件 chip。

#### Scenario: 乐观消息立即显示文件
- **WHEN** 用户发送带普通文件的消息
- **THEN** 本地乐观消息 MUST 立即显示所有文件 chip
- **AND** 文件顺序 MUST 与发送顺序一致

#### Scenario: 服务端历史恢复文件
- **WHEN** app-server user item 包含合法 Files-mentioned 包装
- **THEN** Web MUST 恢复对应 `fileReferences`
- **AND** MUST 只显示 marker 后的用户原始正文

#### Scenario: 过期文件仍显示历史 chip
- **WHEN** 历史包装中的文件本体已经被 24 小时清理器删除
- **THEN** timeline MUST 继续显示文件名 chip
- **AND** MUST NOT 因文件不存在而删除、隐藏或拆分该用户消息

### Requirement: Timeline 更新不得重置普通文件草稿
timeline 的 delta、repair、分页、窗口化重排和状态收敛 SHALL 与 composer 普通文件状态隔离。除非 thread 被用户切换，timeline 更新 MUST NOT 清空、重建或重复上传待发送普通文件。

#### Scenario: 高频 delta 到达
- **WHEN** 当前 turn 高频产生 agent delta
- **AND** composer 包含待发送普通文件
- **THEN** 普通文件队列、状态、选择顺序和文本草稿 MUST 保持不变

#### Scenario: Snapshot repair replace timeline
- **WHEN** snapshot repair 替换当前可见 timeline 窗口
- **THEN** composer 普通文件 MUST 保持不变
- **AND** repair MUST NOT 触发附件重新上传
