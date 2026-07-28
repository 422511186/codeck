## MODIFIED Requirements

### Requirement: 项目操作入口位于项目内而非列表长按
项目级操作（重命名、修改存储位置、从列表移除）SHALL 通过进入项目后的页面入口触发，MUST NOT 以项目列表长按作为主入口。项目列表条目点击 SHALL 仅用于进入该项目会话列表。

#### Scenario: 项目列表点击进入
- **WHEN** 用户在项目页点击某个项目条目
- **THEN** 系统 MUST 进入该项目的会话列表页
- **AND** MUST NOT 因单击打开项目操作菜单

#### Scenario: 项目内打开操作菜单
- **WHEN** 用户在项目会话列表页打开项目设置/操作入口
- **THEN** 系统 MUST 弹出底部操作菜单
- **AND** 菜单 MUST 包含重命名、修改存储位置和从列表移除

#### Scenario: 项目列表长按不再打开菜单
- **WHEN** 用户在项目页长按某个项目条目
- **THEN** 系统 MUST NOT 因长按弹出项目操作菜单

#### Scenario: 从列表移除仅客户端项目
- **WHEN** 用户移除仅客户端项目
- **THEN** 系统 MUST 只从当前浏览器 `localStorage` 删除该记录
- **AND** MUST NOT 删除工作区目录、文件或后端 thread

#### Scenario: 从列表移除服务端项目
- **WHEN** 用户以最新 revision 移除服务端项目
- **THEN** 系统 MUST 只从服务端项目目录删除该记录
- **AND** 其他设备刷新后 MUST 不再显示该项目
- **AND** MUST NOT 删除工作区目录、文件或后端 thread
