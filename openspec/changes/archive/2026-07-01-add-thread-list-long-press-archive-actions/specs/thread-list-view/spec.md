## ADDED Requirements

### Requirement: 会话条目长按打开归档操作菜单
会话列表页 SHALL 在移动端支持长按会话条目打开底部操作菜单，并根据当前 tab 提供归档状态切换操作。

#### Scenario: 进行中会话长按菜单
- **WHEN** 用户在「进行中」tab 长按某个会话条目超过 500ms
- **THEN** 系统 MUST 打开底部操作菜单
- **AND** 菜单 MUST 包含「归档」操作
- **AND** 菜单 MUST NOT 包含「移出归档」操作

#### Scenario: 已归档会话长按菜单
- **WHEN** 用户在「已归档」tab 长按某个会话条目超过 500ms
- **THEN** 系统 MUST 打开底部操作菜单
- **AND** 菜单 MUST 包含「移出归档」操作
- **AND** 菜单 MUST NOT 包含「归档」操作

#### Scenario: 长按不进入会话
- **WHEN** 用户长按会话条目并触发底部操作菜单
- **THEN** 系统 MUST 保持在当前会话列表页
- **AND** 系统 MUST NOT 执行该条目的点击进入会话行为

#### Scenario: 滚动取消长按
- **WHEN** 用户按住会话条目后移动手指滚动列表
- **THEN** 系统 MUST 取消本次长按触发
- **AND** 系统 MUST NOT 打开底部操作菜单

### Requirement: 会话列表内归档会话
会话列表页 SHALL 允许用户在「进行中」tab 直接归档会话，且操作成功后不进入会话详情页。

#### Scenario: 归档成功
- **WHEN** 用户在「进行中」tab 的会话长按菜单中选择「归档」
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/archive`
- **AND** 请求成功后系统 MUST 从当前「进行中」列表移除该会话条目
- **AND** 系统 MUST 保持在当前项目会话列表页
- **AND** 系统 MUST 保持当前 tab 为「进行中」

#### Scenario: 归档失败
- **WHEN** 用户在会话长按菜单中选择「归档」且请求失败
- **THEN** 系统 MUST 保留该会话条目在当前列表中
- **AND** 系统 MUST 在会话列表页展示错误提示

#### Scenario: 归档请求期间防重复提交
- **WHEN** 用户已触发某个会话的「归档」请求且请求尚未完成
- **THEN** 系统 MUST 禁止或忽略对同一会话的重复归档提交

### Requirement: 会话列表内移出归档会话
会话列表页 SHALL 允许用户在「已归档」tab 直接把会话移出归档，且操作成功后不进入会话详情页。

#### Scenario: 移出归档成功
- **WHEN** 用户在「已归档」tab 的会话长按菜单中选择「移出归档」
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/unarchive`
- **AND** 请求成功后系统 MUST 从当前「已归档」列表移除该会话条目
- **AND** 系统 MUST 保持在当前项目会话列表页
- **AND** 系统 MUST 保持当前 tab 为「已归档」

#### Scenario: 移出归档失败
- **WHEN** 用户在会话长按菜单中选择「移出归档」且请求失败
- **THEN** 系统 MUST 保留该会话条目在当前列表中
- **AND** 系统 MUST 在会话列表页展示错误提示

#### Scenario: 移出归档请求期间防重复提交
- **WHEN** 用户已触发某个会话的「移出归档」请求且请求尚未完成
- **THEN** 系统 MUST 禁止或忽略对同一会话的重复移出归档提交
