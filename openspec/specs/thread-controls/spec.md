# thread-controls Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 会话头部布局
会话页顶部 SHALL 固定显示：返回按钮、会话名（两行省略号截断）、Plan/Build segmented 控件、`⋮` 次级菜单按钮；滚动时头部 MUST 保持 sticky 不消失。模型/思考档位选择 SHALL 移到 composer 底部工具栏展示，不再作为会话头部固定元素。

#### Scenario: 渲染头部
- **WHEN** 用户进入某会话
- **THEN** 头部 MUST 同时显示返回、会话名、Plan/Build、`⋮`
- **AND** 会话名 MUST 至多两行省略号截断
- **AND** 头部 MUST 不显示模型选择按钮

#### Scenario: 滚动行为
- **WHEN** 用户向下滚动 timeline
- **THEN** 头部 MUST 保持 sticky 不隐藏

### Requirement: Plan/Build 每会话独立
Plan/Build 模式 SHALL 每个会话独立保存；系统初始默认值为 `Build`，但新建会话 MUST 使用设置页中的全局默认模式；切换 MUST 只影响下一条用户消息，不影响当前正在执行的 turn。

#### Scenario: 未修改设置时新建会话默认
- **WHEN** 用户尚未修改全局默认模式
- **AND** 用户新建会话
- **THEN** Plan/Build segmented MUST 默认选中 `Build`

#### Scenario: 设置全局默认 Plan 后新建会话
- **WHEN** 用户在设置页把全局默认模式设为 `Plan`
- **AND** 用户新建会话
- **THEN** Plan/Build segmented MUST 默认选中 `Plan`

#### Scenario: 切换不影响当前 turn
- **WHEN** agent 正在跑某个 turn
- **AND** 用户切换 Plan/Build
- **THEN** 当前 turn 的权限 MUST 不变
- **AND** 下一次 user 消息 MUST 使用新模式

#### Scenario: Plan → Build 提示
- **WHEN** 用户从 Plan 切到 Build
- **THEN** UI MUST 显示薄警告标识（如颜色变化或小图标）
- **AND** MUST 不弹确认对话框
- **AND** MUST 不在每次发送时做二次确认

### Requirement: Plan 末尾「转 Build 执行」按钮
当 thread 处于 Plan 模式且最近一次 turn 完成后 SHALL 在 timeline 末尾提供「转 Build 执行」按钮。

#### Scenario: 一键转 Build
- **WHEN** 用户点击「转 Build 执行」
- **THEN** 系统 MUST 把会话 Plan/Build 切换为 Build
- **AND** MUST 自动以原 Plan 内容触发一次 Build 模式下的发送

### Requirement: 模型切换粒度
模型 SHALL 有全局默认值（设置页可改）；每个会话可在 composer 底部工具栏点击模型/思考档位 chip 独立切换；切换器列表 SHALL 每次打开时调用 `GET /api/codex/models` 拉取。

#### Scenario: 全局默认
- **WHEN** 用户在设置页设置全局默认模型
- **THEN** 之后新建的会话 MUST 默认使用该模型

#### Scenario: 会话内切换
- **WHEN** 用户在 composer 底部工具栏点击模型/思考档位 chip
- **THEN** 系统 MUST 调用 `GET /api/codex/models` 拉取最新列表
- **AND** 用户选定模型后 MUST 调用 `POST /api/codex/threads/:threadId/settings` 持久化
- **AND** composer 底部工具栏 MUST 更新显示当前模型和思考档位

#### Scenario: Header does not duplicate model picker
- **WHEN** 会话页渲染空闲态 composer
- **THEN** 模型/思考档位 chip MUST 在 composer 底部工具栏可见
- **AND** 会话头部 MUST 不重复显示模型选择按钮

### Requirement: `⋮` 底部抽屉菜单
点击 `⋮` SHALL 弹出底部抽屉，包含以下会话级操作：重命名、归档、压缩上下文。

#### Scenario: 弹出抽屉
- **WHEN** 用户点击会话头部 `⋮`
- **THEN** 系统 MUST 弹出底部抽屉
- **AND** 抽屉 MUST 包含「重命名、归档、压缩上下文」三项
- **AND** MUST 不包含「Fork」
- **AND** MUST 不包含「删除」

### Requirement: 重命名通过弹窗输入
点击「重命名」SHALL 弹出输入框对话框；确认后调用 `POST /api/codex/threads/:threadId/name`。

#### Scenario: 重命名
- **WHEN** 用户在抽屉点击「重命名」
- **THEN** 系统 MUST 弹出输入框对话框（预填当前名）
- **AND** 确认后 MUST 调用对应后端接口
- **AND** 成功后 MUST 更新头部和列表中的会话名

### Requirement: 归档通过 toast + 撤销
点击「归档」SHALL 立刻关闭抽屉、调用 `POST /api/codex/threads/:threadId/archive`、在屏幕底部显示 toast，并提供「撤销」按钮在限定时间内调用 `POST /api/codex/threads/:threadId/unarchive`。

#### Scenario: 归档操作
- **WHEN** 用户在抽屉点击「归档」
- **THEN** 抽屉 MUST 立刻关闭
- **AND** 前端 MUST 调用 archive 接口
- **AND** 屏幕底部 MUST 显示 toast 与「撤销」按钮

#### Scenario: 撤销归档
- **WHEN** 用户在 toast 消失前点击「撤销」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/unarchive`
- **AND** 会话 MUST 回到「进行中」列表

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

### Requirement: 会话级运行状态不在头部显式标记
会话头部 SHALL 不额外显示运行/静止状态点；状态信息通过 timeline 中的微动效与底部按钮（发送/中断）已有的状态变化表达。

#### Scenario: 无额外状态点
- **WHEN** 用户在会话头部观察
- **THEN** 头部 MUST 不显示运行状态指示点或徽标

