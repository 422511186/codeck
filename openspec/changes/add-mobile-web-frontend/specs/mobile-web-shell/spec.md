## ADDED Requirements

### Requirement: 移动端 web 壳体仅服务移动浏览器
应用 SHALL 只面向移动端浏览器（视口宽度典型范围 320–480px）渲染布局，不为桌面端提供独立布局。

#### Scenario: 在移动浏览器访问根路径
- **WHEN** 用户在移动浏览器中访问 `/`
- **THEN** 系统 MUST 渲染针对单栏布局优化的页面
- **AND** 系统 MUST NOT 渲染桌面侧栏、多面板或 IDE 风格布局

### Requirement: 应用入口按登录状态分流
应用 SHALL 根据当前 session cookie 的有效性，把用户分发到登录页或项目页。

#### Scenario: 未登录访问任意页面
- **WHEN** 用户访问 `/`、`/p/<projectId>` 或 `/p/<projectId>/t/<threadId>` 等任意业务页面但没有有效 session cookie
- **THEN** 系统 MUST 重定向到 `/login`
- **AND** 系统 MUST 把原始请求路径附加为返回参数（如 `?return=...`）

#### Scenario: 已登录访问登录页
- **WHEN** 用户已经登录但访问 `/login`
- **THEN** 系统 MUST 直接重定向到项目页 `/`

#### Scenario: session 失效后跳转
- **WHEN** 任意 `/api/codex/*` 请求返回 401 或 `/ws` 因鉴权被拒
- **THEN** 系统 MUST 自动跳回 `/login`
- **AND** 系统 MUST 在 query 中保留当前路径作为 `return`
- **AND** 用户在 `/login` 重新登录成功后系统 MUST 跳回 `return` 指向的路径

### Requirement: 登录页极简形态
登录页 SHALL 只包含产品 logo（纯文字）、单个 token 输入框、单个登录按钮，不包含其他控件（不包含「记住登录」开关、不包含找回入口、不包含说明性段落）。

#### Scenario: 渲染登录页
- **WHEN** 用户访问 `/login`
- **THEN** 系统 MUST 渲染纯文字 logo、token 输入框、登录按钮
- **AND** 系统 MUST NOT 渲染「记住登录」选项

#### Scenario: 登录失败提示
- **WHEN** 用户提交错误 token，后端返回 401
- **THEN** 系统 MUST 在输入框正下方显示红色错误文字
- **AND** 系统 MUST NOT 用 toast、对话框或跳转页面承担错误提示

#### Scenario: 登录成功
- **WHEN** 用户提交正确 token，后端返回 200
- **THEN** 系统 MUST 跳转到 `return` 参数指定的路径
- **AND** 当 `return` 参数缺失时系统 MUST 跳转到项目页 `/`

### Requirement: 三层导航与扁平 URL
应用 SHALL 提供三层导航结构：项目页、项目内会话列表、会话聊天页，并为每一页分配独立 URL。

#### Scenario: 项目页 URL
- **WHEN** 用户在项目首页
- **THEN** 浏览器地址栏 MUST 显示 `/`

#### Scenario: 项目内会话列表 URL
- **WHEN** 用户进入某个项目的会话列表
- **THEN** 浏览器地址栏 MUST 显示 `/p/<projectId>`
- **AND** 刷新页面 MUST 仍然停留在同一项目的会话列表

#### Scenario: 会话聊天页 URL
- **WHEN** 用户打开某个会话
- **THEN** 浏览器地址栏 MUST 显示 `/p/<projectId>/t/<threadId>`
- **AND** 复制并在新浏览器粘贴该 URL（带有效 session）MUST 直接打开该会话

### Requirement: 页面间过渡使用右进左出动画
应用 SHALL 在层级前进/后退时使用 iOS 风格的右进左出过渡动画。

#### Scenario: 进入下一层级
- **WHEN** 用户从项目页点击进入某个项目
- **THEN** 新页面 MUST 从右侧滑入
- **AND** 当前页面 MUST 同时向左滑出

#### Scenario: 返回上一层级
- **WHEN** 用户在会话页点击返回按钮
- **THEN** 当前页面 MUST 向右滑出
- **AND** 上一层页面 MUST 从左侧滑入

### Requirement: 系统主题跟随设备
应用 SHALL 根据设备 `prefers-color-scheme` 自动切换深色/浅色主题，不提供应用内手动主题切换。

#### Scenario: 设备深色模式
- **WHEN** 设备处于深色模式
- **THEN** 系统 MUST 渲染深色主题

#### Scenario: 设备浅色模式
- **WHEN** 设备处于浅色模式
- **THEN** 系统 MUST 渲染浅色主题

### Requirement: 网络断开顶部细横幅提示
应用 SHALL 在 WebSocket 断开时显示顶部细横幅，重连成功后自动消失。

#### Scenario: WS 断开
- **WHEN** `/ws` 连接断开（页面进入后台、网络切换等）
- **THEN** 系统 MUST 在视口顶部显示一条细横幅
- **AND** 横幅文案 MUST 为「网络已断开，重连中…」

#### Scenario: WS 重连成功
- **WHEN** `/ws` 重新建立连接
- **THEN** 系统 MUST 隐藏断线横幅

### Requirement: WS 重连无限重试 + 全量回填
应用 SHALL 在 WS 断开后无限重试连接（指数退避），重连成功后对当前会话执行一次全量 timeline 回填。

#### Scenario: 重连重试
- **WHEN** WS 断开
- **THEN** 系统 MUST 自动尝试重新连接 `/ws`
- **AND** 系统 MUST 使用指数退避，初始间隔约 1 秒，最长间隔不超过 30 秒
- **AND** 系统 MUST NOT 主动放弃，除非用户离开页面

#### Scenario: 重连后回填 timeline
- **WHEN** 用户当前位于某个会话聊天页且 WS 重连成功
- **THEN** 系统 MUST 调用 `GET /api/codex/threads/:threadId/turns` 拉取最新 turn 列表
- **AND** 系统 MUST 用回填结果与本地 timeline 对齐到最新

#### Scenario: WS 断开期间不轮询
- **WHEN** WS 处于断开状态
- **THEN** 系统 MUST NOT 通过 HTTP 轮询 turns 或 events 接口
