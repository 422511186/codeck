# project-management Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 项目列表由前端 localStorage 维护
应用 SHALL 把项目（工作区）列表完整持久化到浏览器 localStorage，不依赖后端存储任何「项目」概念。

#### Scenario: 浏览器无任何项目
- **WHEN** localStorage 中没有项目列表
- **THEN** 项目页 MUST 渲染引导式空状态（插画 + 大按钮）
- **AND** 系统 MUST NOT 通过后端推断或自动生成项目

#### Scenario: 跨设备隔离
- **WHEN** 用户在另一设备登录同一后端
- **THEN** 该设备的项目列表 MUST 仍然来自本地 localStorage，与其他设备相互独立

### Requirement: 项目页是登录后首屏
应用 SHALL 在用户登录后默认落到项目页 `/`，列出 localStorage 中的项目。

#### Scenario: 登录成功后默认页
- **WHEN** 用户在登录页登录成功且没有 `return` 参数
- **THEN** 系统 MUST 跳转到项目页 `/`

#### Scenario: 项目列表渲染
- **WHEN** 项目页加载完成
- **THEN** 系统 MUST 渲染项目列表
- **AND** 每条项目 MUST 显示项目名、路径、最近使用时间、会话数

### Requirement: 项目排序按最近使用倒序
项目列表 SHALL 按「最近使用时间」从新到旧排序。

#### Scenario: 默认排序
- **WHEN** 项目列表渲染
- **THEN** 最近一次进入过的项目 MUST 排在最上面

#### Scenario: 进入项目后排序更新
- **WHEN** 用户进入某个项目的会话列表
- **THEN** 系统 MUST 把该项目的「最近使用时间」更新为当前时刻
- **AND** 下次回到项目页时该项目 MUST 排在最上面

### Requirement: 项目名默认取目录名且可重命名
项目名 SHALL 默认取路径末段目录名，用户可手动重命名为任意非空字符串，不影响后端任何状态。

#### Scenario: 新增项目时的默认项目名
- **WHEN** 用户提交一个新路径
- **THEN** 系统 MUST 把路径末段目录名作为该项目的默认显示名

#### Scenario: 重命名项目
- **WHEN** 用户长按某个项目，在弹出菜单中选择「重命名」
- **THEN** 系统 MUST 弹出输入弹窗并预填当前项目名
- **AND** 用户提交后系统 MUST 把新名字写回 localStorage
- **AND** 项目名 MUST NOT 同步到后端

#### Scenario: 重命名输入为空
- **WHEN** 用户提交空项目名
- **THEN** 系统 MUST 拒绝提交并保留弹窗

### Requirement: 项目添加只支持手输路径并在提交时校验
新建项目 SHALL 通过用户手动输入工作区路径完成，不提供文件选择器，路径合法性在提交时由 workspace allowlist 后端校验决定。

#### Scenario: 输入路径与提交
- **WHEN** 用户点击「新增项目」并在弹窗中输入路径
- **THEN** 系统 MUST 接受任意字符串作为输入，不在客户端做路径"样子"校验

#### Scenario: 提交时合法
- **WHEN** 用户提交的路径在后端 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 之内
- **THEN** 系统 MUST 把该路径加入 localStorage 项目列表
- **AND** 系统 MUST 自动跳转到该项目的会话列表

#### Scenario: 提交时非法
- **WHEN** 用户提交的路径未通过后端 workspace 校验
- **THEN** 系统 MUST 在弹窗内显示错误提示
- **AND** 系统 MUST NOT 把该路径加入 localStorage

### Requirement: 项目长按出操作菜单
项目条目 SHALL 通过长按手势触发底部操作菜单，菜单项包含「重命名」和「从列表移除」。

#### Scenario: 长按项目
- **WHEN** 用户在项目页长按某个项目条目超过 500ms
- **THEN** 系统 MUST 弹出底部操作菜单
- **AND** 菜单 MUST 包含「重命名」和「从列表移除」两个操作

#### Scenario: 从列表移除项目
- **WHEN** 用户在菜单中选择「从列表移除」
- **THEN** 系统 MUST 直接把该项目从 localStorage 移除
- **AND** 系统 MUST NOT 弹出额外确认
- **AND** 系统 MUST NOT 删除后端任何 thread

### Requirement: 项目列表完全空时引导空状态
应用 SHALL 在 localStorage 中没有任何项目时，把项目页渲染为引导式空状态：插画 + 「添加第一个项目」大按钮。

#### Scenario: 首次访问
- **WHEN** 用户登录后进入项目页且 localStorage 为空
- **THEN** 系统 MUST 渲染引导式空状态
- **AND** 大按钮文案 MUST 引导用户「添加第一个项目」
- **AND** 点击大按钮 MUST 弹出与「新增项目」相同的输入弹窗

