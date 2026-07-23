# project-management Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 项目列表由前端 localStorage 维护
应用 SHALL 支持仅客户端项目和服务端项目。仅客户端项目 MUST 只持久化到当前浏览器 `localStorage`；服务端项目 MUST 只持久化到后端实例项目目录；项目页 SHALL 读取两边记录后在内存中合并展示，不得为服务端项目维护浏览器持久化镜像。

#### Scenario: 客户端与服务端项目合并展示
- **WHEN** 当前浏览器存在仅客户端项目且服务端目录存在服务端项目
- **THEN** 项目页 MUST 合并展示两类项目
- **AND** 每条项目 MUST 标识其存储位置

#### Scenario: 跨设备共享服务端项目
- **WHEN** 用户在另一设备登录同一后端实例
- **THEN** 该设备 MUST 能读取该实例的全部服务端项目
- **AND** 其他设备的仅客户端项目 MUST NOT 出现在该设备

#### Scenario: 服务端目录读取失败
- **WHEN** 服务端项目目录读取失败
- **THEN** 项目页 MUST 继续展示并允许使用仅客户端项目
- **AND** MUST 显示服务端项目加载失败和重试操作
- **AND** MUST NOT 把失败渲染为服务端空列表或使用持久化镜像

### Requirement: 项目页是登录后首屏
应用 SHALL 在用户登录后默认落到项目页 `/`，列出客户端与服务端合并后的项目目录。

#### Scenario: 登录成功后默认页
- **WHEN** 用户在登录页登录成功且没有 `return` 参数
- **THEN** 系统 MUST 跳转到项目页 `/`

#### Scenario: 项目列表渲染
- **WHEN** 项目页加载完成
- **THEN** 系统 MUST 渲染合并项目列表
- **AND** 每条项目 MUST 显示项目名、路径、存储位置、最近使用时间、会话数

### Requirement: 项目排序按最近使用倒序
项目列表 SHALL 按「最近使用时间」从新到旧排序。仅客户端项目的最近使用时间属于当前浏览器；服务端项目的最近使用时间属于后端实例并在设备间共享。

#### Scenario: 默认排序
- **WHEN** 合并项目列表渲染
- **THEN** `lastUsedAt` 最大的项目 MUST 排在最上面

#### Scenario: 进入仅客户端项目后排序更新
- **WHEN** 用户进入某个仅客户端项目的会话列表
- **THEN** 系统 MUST 把当前浏览器中的该项目 `lastUsedAt` 更新为当前时刻

#### Scenario: 进入服务端项目后全局排序更新
- **WHEN** 任一设备进入某个服务端项目
- **THEN** 后端 MUST 只在新时间更晚时更新该项目 `lastUsedAt`
- **AND** 其他设备刷新后 MUST 使用该共享时间排序
- **AND** 该更新时间 MUST NOT 制造人工 revision 冲突

### Requirement: 项目名默认取目录名且可重命名
项目名 SHALL 默认取路径末段目录名，用户可手动重命名为任意非空字符串。仅客户端项目 MUST 写回 `localStorage`；服务端项目 MUST 通过带 revision 的后端变更跨设备同步。

#### Scenario: 新增项目时的默认项目名
- **WHEN** 用户提交一个新路径且未填写别名
- **THEN** 系统 MUST 把路径末段目录名作为该项目的默认显示名

#### Scenario: 重命名仅客户端项目
- **WHEN** 用户提交仅客户端项目的新名称
- **THEN** 系统 MUST 把新名字写回当前浏览器 `localStorage`

#### Scenario: 重命名服务端项目
- **WHEN** 用户提交服务端项目的新名称和读取时的 revision
- **THEN** 后端 MUST 更新服务端项目目录并递增 revision
- **AND** 其他设备刷新后 MUST 显示新名称

#### Scenario: 重命名输入为空
- **WHEN** 用户提交空项目名
- **THEN** 系统 MUST 拒绝提交并保留弹窗

#### Scenario: 过期重命名
- **WHEN** 服务端项目 revision 已被其他设备修改
- **THEN** 后端 MUST 返回 HTTP 409 和最新完整目录
- **AND** 前端 MUST NOT 静默覆盖最新名称

### Requirement: 项目添加只支持手输路径并在提交时校验
新建项目 SHALL 通过用户手动输入工作区路径完成，不提供文件选择器。新增表单 MUST 使用服务端共享默认存储位置进行预选并允许当次改选；路径合法性 MUST 在提交时由 workspace allowlist 后端校验决定。

#### Scenario: 打开新增表单
- **WHEN** 用户打开新增项目弹窗
- **THEN** 表单 MUST 预选服务端保存的默认项目存储位置
- **AND** 用户 MUST 能改选「仅当前设备」或「保存到服务端」

#### Scenario: 添加仅客户端项目
- **WHEN** 用户选择仅当前设备且路径通过后端 workspace 校验
- **THEN** 系统 MUST 只把记录写入当前浏览器 `localStorage`

#### Scenario: 添加服务端项目
- **WHEN** 用户选择保存到服务端且路径通过后端 workspace 校验
- **THEN** 系统 MUST 通过认证项目 API 写入服务端目录
- **AND** MUST NOT 把该记录持久化到浏览器 `localStorage`

#### Scenario: 提交时非法
- **WHEN** 用户提交的路径未通过后端 workspace 校验
- **THEN** 系统 MUST 在弹窗内显示错误提示
- **AND** MUST NOT 把该路径加入任一项目存储

#### Scenario: 服务端目录不可用时新增
- **WHEN** 服务端项目目录不可用
- **THEN** 表单 MUST 禁用保存到服务端
- **AND** MUST 仍允许新增仅客户端项目

### Requirement: 项目列表完全空时引导空状态
应用 SHALL 仅在客户端项目为空、服务端项目为空且服务端目录读取成功时渲染引导式空状态。

#### Scenario: 首次访问且目录均为空
- **WHEN** 用户进入项目页且客户端与服务端项目均为空
- **THEN** 系统 MUST 渲染引导式空状态
- **AND** 点击引导按钮 MUST 打开新增项目弹窗

#### Scenario: 服务端读取失败不显示空状态
- **WHEN** 客户端项目为空但服务端项目目录读取失败
- **THEN** 系统 MUST 显示服务端错误和重试
- **AND** MUST NOT 声称用户没有任何项目

### Requirement: Project cwd validation uses backend allowlist
项目新增和移动到服务端的流程 SHALL 在持久化前校验 `cwd`。workspace 外路径 MUST 被拒绝，不能加入客户端或服务端项目目录。

#### Scenario: Add project with outside cwd
- **WHEN** 用户提交 workspace allowlist 外路径
- **THEN** 后端 validation route MUST 返回错误
- **AND** 前端 MUST NOT 把该路径加入任一项目存储

#### Scenario: Server project stores normalized allowed path
- **WHEN** 已认证用户创建服务端项目且路径在 allowlist 内
- **THEN** route MUST 使用标准化后的 allowlist 内路径写入服务端项目目录

### Requirement: 项目存储位置移动保持单一权威
项目存储位置修改 SHALL 表示保留项目 ID 的移动而不是复制。系统 MUST 先写入目标存储，成功后删除源记录；源删除失败时 MUST 回滚目标写入并保留原权威记录。

#### Scenario: 客户端项目移动到服务端
- **WHEN** 用户把仅客户端项目改为保存到服务端
- **THEN** 系统 MUST 使用原项目 ID 和元数据创建服务端记录
- **AND** 仅在服务端创建成功后删除本地记录

#### Scenario: 服务端项目移动到客户端
- **WHEN** 用户把服务端项目改为仅当前设备
- **THEN** 系统 MUST 先写入当前浏览器
- **AND** 服务端删除成功后其他设备 MUST 不再显示该项目
- **AND** 服务端删除失败时系统 MUST 删除刚写入的本地目标记录

#### Scenario: 升级不自动迁移
- **WHEN** 新版本首次读取旧 `localStorage` 项目
- **THEN** 系统 MUST 把它们视为仅客户端项目
- **AND** MUST NOT 自动上传到服务端

### Requirement: 项目路径跨存储唯一且冲突显式解决
同一个规范化工作区路径 SHALL 在客户端与服务端合并目录中最多对应一条项目记录。发现跨存储冲突时系统 MUST 要求用户选择保留服务端、保留当前设备或取消，不得静默覆盖或删除。

#### Scenario: 新增或移动发现服务端同路径
- **WHEN** 当前设备项目路径与服务端项目路径规范化后相同
- **THEN** 系统 MUST 阻止创建重复记录
- **AND** MUST 显示显式冲突处理

#### Scenario: 用户取消冲突处理
- **WHEN** 用户在冲突界面选择取消
- **THEN** 系统 MUST 保留两边原始记录且不执行删除

### Requirement: 服务端项目目录持久化和乐观并发
服务端 SHALL 在 `CODEX_WEB_DATA_DIR` 中用版本化 JSON、文件锁和原子替换维护项目目录与默认存储位置。人工变更 MUST 使用 expected revision；损坏文件 MUST 失败关闭并保留原内容。

#### Scenario: 首次读取服务端项目目录
- **WHEN** `projects.json` 不存在
- **THEN** 后端 MUST 原子创建 schemaVersion 1、revision 0、默认存储位置为 server 的空目录

#### Scenario: 两台设备并发人工修改
- **WHEN** 两个请求携带相同 revision 修改服务端项目目录
- **THEN** 最多一个请求 MUST 成功并递增 revision
- **AND** 另一个请求 MUST 返回 HTTP 409、稳定错误码和最新完整目录

#### Scenario: 项目目录文件损坏
- **WHEN** `projects.json` 不是合法 schema
- **THEN** 后端 MUST 返回稳定存储错误
- **AND** MUST NOT 覆盖损坏文件

### Requirement: 服务端项目 API 认证与审计
所有项目目录 API SHALL 要求有效 Web session。创建、重命名、删除、默认值修改和最近使用更新时间 MUST 记录审计事件，但 MUST NOT 删除或记录工作区文件内容。

#### Scenario: 未认证访问项目目录
- **WHEN** 未认证请求访问 `/api/codex/projects*`
- **THEN** route MUST 返回 HTTP 401

#### Scenario: 服务端项目人工变更审计
- **WHEN** 服务端项目创建、重命名、删除或默认存储位置修改成功
- **THEN** 审计日志 MUST 记录项目 ID、动作和 revision 变化
- **AND** MUST NOT 记录目录文件内容

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
