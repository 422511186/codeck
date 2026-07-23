## MODIFIED Requirements

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
