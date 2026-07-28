# thread-list-view Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
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
应用 SHALL 在用户从**可进入**的会话列表跳进会话页又返回时，保持原来选中的 tab（进行中 / 已归档）和滚动位置。已归档会话不可进入会话页，因此返回上下文保持仅适用于从「进行中」tab 进入的路径；用户在「已归档」tab 打开操作 sheet 并取消后 MUST 仍停留在「已归档」tab。

#### Scenario: 从进行中进入后返回保持上下文
- **WHEN** 用户在「进行中」tab 进入某个会话，再点返回
- **THEN** 系统 MUST 把会话列表恢复到「进行中」tab
- **AND** 滚动位置 MUST 与离开时一致

#### Scenario: 已归档打开 sheet 后取消
- **WHEN** 用户在「已归档」tab 点击会话条目打开操作 sheet 并选择取消或点遮罩关闭
- **THEN** 系统 MUST 保持在「已归档」tab
- **AND** MUST NOT 路由到会话页

### Requirement: 会话列表内归档会话
会话列表页 SHALL 允许用户在「进行中」tab 直接归档会话，且操作成功后不进入会话详情页。入口为左滑后点击「归档」。

#### Scenario: 归档成功
- **WHEN** 用户在「进行中」tab 通过左滑操作按钮选择「归档」
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/archive`
- **AND** 请求成功后系统 MUST 从当前「进行中」列表移除该会话条目
- **AND** 系统 MUST 保持在当前项目会话列表页
- **AND** 系统 MUST 保持当前 tab 为「进行中」
- **AND** 系统 MAY 显示带「撤销」的 toast

#### Scenario: 归档失败
- **WHEN** 用户触发「归档」且请求失败
- **THEN** 系统 MUST 保留该会话条目在当前列表中
- **AND** 系统 MUST 在会话列表页展示错误提示

#### Scenario: 归档请求期间防重复提交
- **WHEN** 用户已触发某个会话的「归档」请求且请求尚未完成
- **THEN** 系统 MUST 禁止或忽略对同一会话的重复归档提交

### Requirement: 会话列表内移出归档会话
会话列表页 SHALL 允许用户在「已归档」tab 直接把会话移出归档，且操作成功后不进入会话详情页。入口为左滑后点击「移出归档」，或点击条目后在底部菜单选择「移出归档」。

#### Scenario: 通过菜单移出归档成功
- **WHEN** 用户在「已归档」tab 的会话操作菜单中选择「移出归档」
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/unarchive`
- **AND** 请求成功后系统 MUST 从当前「已归档」列表移除该会话条目
- **AND** 系统 MUST 保持在当前项目会话列表页
- **AND** 系统 MUST 保持当前 tab 为「已归档」
- **AND** 系统 MAY 显示带「撤销」的 toast

#### Scenario: 通过左滑移出归档成功
- **WHEN** 用户在「已归档」tab 通过左滑操作按钮选择「移出归档」
- **THEN** 系统 MUST 执行与菜单移出归档相同的接口与列表更新语义

#### Scenario: 移出归档失败
- **WHEN** 用户触发「移出归档」且请求失败
- **THEN** 系统 MUST 保留该会话条目在当前列表中
- **AND** 系统 MUST 在会话列表页展示错误提示

#### Scenario: 移出归档请求期间防重复提交
- **WHEN** 用户已触发某个会话的「移出归档」请求且请求尚未完成
- **THEN** 系统 MUST 禁止或忽略对同一会话的重复移出归档提交

### Requirement: 会话条目通过左滑与点击打开归档操作
会话列表页 SHALL 在移动端通过左滑露出操作按钮，并在「已归档」tab 通过点击条目打开底部操作菜单；MUST NOT 以长按作为归档操作入口。

#### Scenario: 进行中会话左滑归档入口
- **WHEN** 用户在「进行中」tab 对某个会话条目向左滑动超过阈值
- **THEN** 系统 MUST 露出「归档」操作按钮
- **AND** 仅滑动 MUST NOT 立即执行归档
- **AND** 用户点击「归档」按钮后 MUST 触发归档流程

#### Scenario: 已归档会话左滑移出入口
- **WHEN** 用户在「已归档」tab 对某个会话条目向左滑动超过阈值
- **THEN** 系统 MUST 露出「移出归档」操作按钮
- **AND** 仅滑动 MUST NOT 立即执行移出归档
- **AND** 用户点击「移出归档」按钮后 MUST 触发移出归档流程

#### Scenario: 已归档会话点击打开操作菜单
- **WHEN** 用户在「已归档」tab 点击某个会话条目
- **THEN** 系统 MUST 打开底部操作菜单
- **AND** 菜单 MUST 包含「移出归档」操作
- **AND** 菜单 MUST NOT 包含「归档」操作
- **AND** 系统 MUST NOT 进入该会话页

#### Scenario: 进行中会话点击仍进入会话
- **WHEN** 用户在「进行中」tab 点击某个会话条目（非滑动手势）
- **THEN** 系统 MUST 进入该会话页
- **AND** MUST NOT 仅因点击而打开归档菜单

#### Scenario: 纵向滚动优先于左滑
- **WHEN** 用户按住会话条目后主要进行纵向移动以滚动列表
- **THEN** 系统 MUST 将手势交给列表滚动
- **AND** MUST NOT 错误打开左滑操作按钮

#### Scenario: 长按不再打开操作菜单
- **WHEN** 用户长按会话条目
- **THEN** 系统 MUST NOT 因长按打开归档操作菜单

### Requirement: 已归档会话不可进入聊天页
「已归档」tab 中的会话条目 SHALL 不可导航到会话聊天页。移出归档是恢复可进入状态的列表侧路径。

#### Scenario: 已归档禁止路由
- **WHEN** 用户在「已归档」tab 与会话条目交互
- **THEN** 系统 MUST NOT 将路由导航到 `/threads/{threadId}`
- **AND** 用户 MUST 能通过「移出归档」使会话回到「进行中」列表后再进入
