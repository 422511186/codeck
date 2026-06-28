## ADDED Requirements

### Requirement: 项目内会话列表是进入项目后的默认页
应用 SHALL 在用户进入某个项目后默认落到该项目的会话列表页，不弹出任何中间配置面板。

#### Scenario: 选择项目
- **WHEN** 用户在项目页点击某个项目
- **THEN** 系统 MUST 直接跳转到该项目的会话列表页

#### Scenario: 默认 tab
- **WHEN** 会话列表页加载
- **THEN** 系统 MUST 默认显示「进行中」tab，不显示「已归档」

### Requirement: 会话列表通过 tab 区分进行中与已归档
会话列表页 SHALL 通过两个 tab 区分活跃会话和归档会话，分别对应后端 threads 接口的 `archived=false` 和 `archived=true`。

#### Scenario: 切换到归档 tab
- **WHEN** 用户点击「已归档」tab
- **THEN** 系统 MUST 调用 `GET /api/codex/threads?archived=true` 拉取归档会话
- **AND** 渲染归档会话列表

#### Scenario: 切换回进行中 tab
- **WHEN** 用户点击「进行中」tab
- **THEN** 系统 MUST 渲染该项目下未归档的会话列表

### Requirement: 会话条目显示会话名与最后一条 user 消息
每条会话条目 SHALL 同时显示会话名（来自后端）和该会话最后一条 user 消息的预览文本。

#### Scenario: 普通会话
- **WHEN** 会话列表渲染某个会话条目
- **THEN** 条目顶部 MUST 显示会话名
- **AND** 条目中部 MUST 显示该会话最后一条 user 消息的截断预览

#### Scenario: 没有任何 user 消息
- **WHEN** 会话还没有任何 user 消息
- **THEN** 条目预览区 MUST 显示占位文案「（暂无消息）」

### Requirement: 进行中 tab 按最后活动时间倒序，运行中替代时间戳
「进行中」tab SHALL 按最后活动时间从新到旧排序，运行中会话 SHALL 用「正在运行」徽标替换时间戳位置。

#### Scenario: 默认排序
- **WHEN** 进行中 tab 渲染
- **THEN** 最近一条 turn / item 时间最新的会话 MUST 排在最上面

#### Scenario: 会话正在运行
- **WHEN** 某个会话当前有 turn 仍在执行
- **THEN** 该条目 MUST 在原本显示时间戳的位置改为显示「正在运行」徽标
- **AND** 排序仍以最后活动时间为准

#### Scenario: 已完成或静止会话
- **WHEN** 某个会话当前没有运行中的 turn
- **THEN** 该条目 MUST 显示最后活动的相对时间

### Requirement: 已归档 tab 按归档时间倒序
「已归档」tab SHALL 按会话被归档的时间从新到旧排序。

#### Scenario: 归档时间排序
- **WHEN** 已归档 tab 渲染
- **THEN** 最近被归档的会话 MUST 排在最上面

### Requirement: 进行中和已完成会话视觉混排不分组
进行中 tab 内 SHALL 不再额外按状态分组；已完成会话和进行中会话 MUST 在同一个有序列表里混排，仅靠每条的状态标识区分。

#### Scenario: 状态混排
- **WHEN** 进行中 tab 同时存在运行中和静止的会话
- **THEN** 列表 MUST 按统一的最后活动时间排序，不另外分「正在运行」分组

### Requirement: 新建会话使用悬浮按钮入口
会话列表页 SHALL 提供一个悬浮（FAB）「+ 新会话」按钮，点击直接创建新会话并跳转到聊天页。

#### Scenario: 点击悬浮按钮
- **WHEN** 用户点击「+ 新会话」悬浮按钮
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/start`，使用当前项目的 cwd
- **AND** 新会话 MUST 使用设置页中的全局默认 Plan/Build，系统初始默认值为 `Build`
- **AND** 系统 MUST 跳转到该新会话的聊天页
- **AND** 聊天页 MUST 不弹出任何配置面板

### Requirement: 项目内会话列表为空时引导新建
应用 SHALL 在项目内没有任何会话时（包括已归档），会话列表页渲染「提示文案 + 大按钮」的引导态。

#### Scenario: 项目首次进入
- **WHEN** 项目内既无进行中也无已归档会话
- **THEN** 进行中 tab MUST 渲染引导态
- **AND** 大按钮 MUST 引导用户创建第一个会话

### Requirement: 列表加载使用骨架屏
会话列表 SHALL 在拉取后端数据期间使用骨架屏作为统一加载态。

#### Scenario: 首次加载
- **WHEN** 会话列表页正在拉取 threads
- **THEN** 系统 MUST 渲染骨架屏行，而非 spinner 或空白

### Requirement: 进入会话页与返回保持原 tab
应用 SHALL 在用户从会话列表跳进会话页又返回时，保持原来选中的 tab（进行中 / 已归档）和滚动位置。

#### Scenario: 返回保持上下文
- **WHEN** 用户在「已归档」tab 进入某个会话，再点返回
- **THEN** 系统 MUST 把会话列表恢复到「已归档」tab
- **AND** 滚动位置 MUST 与离开时一致
