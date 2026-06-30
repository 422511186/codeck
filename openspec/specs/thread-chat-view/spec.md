# thread-chat-view Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 会话聊天页采用单栏 timeline 布局
会话聊天页 SHALL 使用单栏垂直 timeline 作为主体内容区，timeline 上方是 sticky 头部，下方是 sticky 底部输入区。

#### Scenario: 默认布局
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MUST 由「sticky 头部 + 中间 timeline + sticky 底部输入区」三段构成
- **AND** timeline MUST 占满中间区域

### Requirement: 头部固定显示返回、会话名、Plan/Build、模型、菜单
会话头部 SHALL 显示 5 个固定元素：返回按钮、会话名、Plan/Build segmented 控件、当前模型完整名、⋮ 次级菜单按钮。

#### Scenario: 头部内容
- **WHEN** 会话聊天页渲染
- **THEN** 头部 MUST 同时显示这 5 个元素

#### Scenario: 头部 sticky
- **WHEN** 用户向下滚动 timeline
- **THEN** 头部 MUST 保持 sticky 不随滚动消失

### Requirement: 会话名过长两行省略
会话名在头部 SHALL 最多渲染两行，超出部分使用省略号截断。

#### Scenario: 会话名超长
- **WHEN** 会话名超过头部可显示宽度的两行
- **THEN** 系统 MUST 在第二行末尾使用省略号
- **AND** 不允许撑高头部以容纳完整名称

### Requirement: Plan/Build 使用 segmented 控件且每会话独立
Plan/Build 模式 SHALL 用 segmented 控件呈现，每个会话独立保存当前选择。

#### Scenario: 新会话默认值
- **WHEN** 新建会话
- **THEN** Plan/Build segmented 控件 MUST 默认选中 `Build`

#### Scenario: 切换模式
- **WHEN** 用户在会话头部切换 Plan/Build
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/settings` 更新 permissions
- **AND** 切换 MUST 只影响下一条用户消息，不影响当前正在执行的 turn

#### Scenario: 进入已有会话
- **WHEN** 用户重新进入某个会话
- **THEN** 头部 MUST 恢复该会话上次的 Plan/Build 选中态

### Requirement: 头部右侧 ⋮ 菜单使用底部抽屉
⋮ 次级菜单 SHALL 以底部抽屉形式弹出，包含重命名、归档、压缩上下文三项。Fork SHALL 不在会话头部抽屉中出现。

#### Scenario: 打开菜单
- **WHEN** 用户点击 ⋮
- **THEN** 系统 MUST 从底部弹出抽屉
- **AND** 抽屉 MUST 包含「重命名」「归档」「压缩上下文」三项
- **AND** 抽屉 MUST 不包含「Fork」

#### Scenario: 不显示删除
- **WHEN** ⋮ 菜单展开
- **THEN** 抽屉 MUST 不包含「删除会话」入口

### Requirement: 重命名通过弹窗输入
重命名会话 SHALL 通过模态弹窗输入新名称完成，确认后调用后端接口。

#### Scenario: 弹出弹窗
- **WHEN** 用户在底部抽屉点击「重命名」
- **THEN** 系统 MUST 弹出输入弹窗，预填当前会话名

#### Scenario: 提交重命名
- **WHEN** 用户在弹窗中输入新名称并确认
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/name`
- **AND** 头部会话名 MUST 在成功后立刻更新

### Requirement: 归档使用 toast + 撤销
归档操作 SHALL 在用户点击后立即关闭底部抽屉，并通过底部 toast 提示，toast 上提供「撤销」按钮。

#### Scenario: 归档触发
- **WHEN** 用户点击「归档」
- **THEN** 抽屉 MUST 立刻关闭
- **AND** 系统 MUST 调用 `POST /api/codex/threads/:threadId/archive`
- **AND** 屏幕底部 MUST 出现 toast 提示「会话已归档」+「撤销」按钮

#### Scenario: 撤销归档
- **WHEN** 用户在 toast 消失前点击「撤销」
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/unarchive`
- **AND** toast MUST 关闭

### Requirement: 压缩上下文需弹确认对话框
压缩上下文 SHALL 在用户点击后弹出确认对话框，确认后才调用后端，过程中禁用输入框，完成后在 timeline 插入系统消息。

#### Scenario: 弹出确认
- **WHEN** 用户点击「压缩上下文」
- **THEN** 系统 MUST 弹出确认对话框，说明压缩不可逆

#### Scenario: 确认压缩
- **WHEN** 用户在对话框中确认
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`
- **AND** 输入框 MUST 在压缩进行中禁用
- **AND** 压缩完成后 timeline MUST 在末尾插入一条「上下文已压缩」系统消息

### Requirement: 进入会话默认滚到最新
进入会话聊天页时 SHALL 默认将 timeline 滚动到最新一条消息位置。

#### Scenario: 首次进入
- **WHEN** 用户从会话列表点击进入某个会话
- **THEN** timeline MUST 滚动到最末端
- **AND** 不要求恢复用户上次阅读位置

### Requirement: 向上无限滚动加载更早消息
timeline SHALL 在用户向上滚动到顶部时自动调用分页接口加载更早的消息，使用 `cursor + limit` 分页。

#### Scenario: 触底加载
- **WHEN** 用户向上滚动接近 timeline 顶部
- **THEN** 系统 MUST 调用 `GET /api/codex/threads/:threadId/turns?cursor=...&limit=...`
- **AND** 加载期间 MUST 在 timeline 顶部显示细 spinner

#### Scenario: 到达起点
- **WHEN** 后端返回的下一个 cursor 为空
- **THEN** timeline 顶部 MUST 显示灰色细线 + 文案「会话开始」

### Requirement: 跳到最新按钮仅在用户向上滚动后出现
timeline SHALL 在用户曾向上滚动、当前不在底部时显示「跳到最新」浮动按钮，在底部时隐藏。

#### Scenario: 出现按钮
- **WHEN** 用户从底部向上滚动一定距离
- **THEN** 系统 MUST 在 timeline 右下方显示「跳到最新」浮动按钮

#### Scenario: 隐藏按钮
- **WHEN** 用户重新滚回 timeline 底部
- **THEN** 「跳到最新」按钮 MUST 消失

### Requirement: 新消息仅在用户位于底部时自动滚
agent 仍在输出时 SHALL 仅在用户当前停留在底部的情况下，自动把视图滚到新内容；否则保留用户当前阅读位置。

#### Scenario: 用户在底部
- **WHEN** 新的 `codex-event` 增量到达且用户当前位于 timeline 底部
- **THEN** 系统 MUST 自动滚动到最新位置

#### Scenario: 用户向上看历史
- **WHEN** 新的 `codex-event` 增量到达但用户当前不在底部
- **THEN** 系统 MUST 不强行滚动
- **AND** MUST 通过「跳到最新」按钮告知有新内容

### Requirement: 用户消息使用左侧色条通栏块
用户消息 SHALL 渲染为通栏块，块左侧带一条色条以区分 agent 消息；不显示头像和用户名。

#### Scenario: 用户消息样式
- **WHEN** timeline 渲染一条用户消息
- **THEN** 该消息 MUST 占据屏幕通栏宽度
- **AND** 块左侧 MUST 带强调色色条
- **AND** MUST 不渲染头像或用户名

### Requirement: Agent 消息使用通栏块
Agent 消息 SHALL 渲染为通栏块，不带左侧色条；不显示头像和模型名。

#### Scenario: Agent 消息样式
- **WHEN** timeline 渲染一条 agent 消息
- **THEN** 该消息 MUST 占据屏幕通栏宽度
- **AND** MUST 不渲染头像或模型名

### Requirement: Agent 回复全量渲染 markdown
Agent 回复 SHALL 按 GitHub-flavored markdown 全量渲染，包含列表、加粗、表格、链接、内联代码块。

#### Scenario: 渲染 markdown 元素
- **WHEN** agent 消息包含 markdown 语法
- **THEN** 列表、表格、加粗、链接 MUST 渲染为对应可视元素

#### Scenario: 不渲染 LaTeX
- **WHEN** agent 消息包含 `$...$` 或 `\[...\]` 等 LaTeX 公式语法
- **THEN** 系统 MUST 不解析公式
- **AND** MUST 保留原文展示

#### Scenario: 渲染 Mermaid
- **WHEN** agent 消息包含 ```mermaid 代码块
- **THEN** 系统 MUST 渲染为 Mermaid 图

### Requirement: 代码块满宽横向滑动并提供复制按钮
markdown 中的代码块 SHALL 占满 timeline 宽度，超长行通过横向滑动查看，右上角提供「复制」按钮。

#### Scenario: 代码块样式
- **WHEN** agent 消息内嵌代码块
- **THEN** 代码块 MUST 占满 timeline 宽度
- **AND** 超长行 MUST 通过横向滑动查看，不自动换行
- **AND** 代码块右上角 MUST 显示「复制」按钮

#### Scenario: 点击复制
- **WHEN** 用户点击代码块右上角「复制」按钮
- **THEN** 系统 MUST 把代码块原文复制到剪贴板

### Requirement: 每条消息显示相对时间且始终用相对时间
timeline 上每条消息 SHALL 在头部显示相对时间，不论时间是否超过一天，始终使用相对时间格式。

#### Scenario: 近期消息
- **WHEN** 消息发生在不久前
- **THEN** 时间 MUST 显示如「3 分钟前」「刚刚」

#### Scenario: 久远消息
- **WHEN** 消息发生在数天或数月前
- **THEN** 时间 MUST 仍使用相对时间（如「3 天前」「2 个月前」）

### Requirement: 用户消息长按弹菜单
用户消息 SHALL 在被长按时弹出操作菜单，菜单至少包含「复制」。

#### Scenario: 长按触发
- **WHEN** 用户长按某条用户消息
- **THEN** 系统 MUST 弹出操作菜单
- **AND** 菜单 MUST 至少包含「复制」入口

### Requirement: 系统消息使用居中细线灰色小字
系统消息（压缩上下文、Plan→Build 切换、错误事件等）SHALL 渲染为居中、上下细线、灰色小字样式，不与用户/agent 消息块混淆。

#### Scenario: 系统消息样式
- **WHEN** timeline 出现系统消息
- **THEN** 文案 MUST 居中
- **AND** 文案颜色 MUST 比正文淡
- **AND** 上下 MUST 有细分割线

### Requirement: 离开后回到同一会话使用内存缓存
应用 SHALL 在用户离开某个会话切到其他页时，在内存中保留该会话已加载的 timeline；重新进入时直接渲染缓存内容。

#### Scenario: 缓存命中
- **WHEN** 用户先后进入会话 A、列表页、再次进入会话 A
- **THEN** 第二次进入 A 时 MUST 立刻渲染上一次的 timeline 缓存
- **AND** MUST 不重新拉取 turns 列表

#### Scenario: 缓存不持久化
- **WHEN** 浏览器页面被刷新或关闭
- **THEN** 内存缓存 MUST 丢失
- **AND** 下次进入 MUST 重新拉取最新 turns

### Requirement: 整体 timeline 背景纯色气泡有底
timeline 背景 SHALL 使用纯背景色，消息块 SHALL 通过浅底色或边框区分；不使用气泡尾巴样式。

#### Scenario: 默认视觉
- **WHEN** timeline 渲染
- **THEN** 整体背景 MUST 为单一背景色
- **AND** 消息块 MUST 用浅底色或边框区分，不带气泡尾巴

### Requirement: 进入会话时 timeline 加载使用中央 spinner
进入会话页且尚未拿到任何 turns 数据期间 SHALL 在 timeline 中央显示 spinner。

#### Scenario: 首次加载
- **WHEN** 会话聊天页打开，timeline 数据尚未到达
- **THEN** timeline 中央 MUST 显示加载 spinner

### Requirement: 新会话进入后首屏仅显示输入区
新建会话刚跳转到聊天页、且尚无任何消息时 SHALL 只显示底部输入区，不显示骨架屏或引导文案。

#### Scenario: 空会话首屏
- **WHEN** 新会话刚被创建并进入聊天页
- **THEN** timeline 区 MUST 为空
- **AND** 底部输入区 MUST 立即可用

### Requirement: Uploaded local images preview through server API
用户在会话中上传的本地图片 SHALL 在远端浏览器中通过服务端预览 API 展示；前端 MUST NOT 把 Linux/POSIX 绝对本地路径误当作可直接访问的 Web URL。

#### Scenario: Linux absolute upload path
- **WHEN** 用户消息包含 `/home/.../uploads/<id>.png`、`/tmp/.../<id>.jpg` 或其他 Linux/POSIX 绝对本地图片路径
- **THEN** 图片缩略图 MUST 使用 `/api/codex/images/preview?path=...` 作为 `src`
- **AND** 浏览器 MUST NOT 直接请求该绝对路径对应的页面 URL

#### Scenario: Windows absolute upload path
- **WHEN** 用户消息包含 `C:\...` 或 `C:/...` 形式的 Windows 本地图片路径
- **THEN** 图片缩略图 MUST 使用 `/api/codex/images/preview?path=...` 作为 `src`
- **AND** 路径 MUST 被 URL encode 后传给 preview API

#### Scenario: Browser-native image URL
- **WHEN** 图片路径是 `blob:`、`data:`、`http:` 或 `https:` URL
- **THEN** 前端 MAY 直接使用该 URL 作为图片 `src`
- **AND** MUST NOT 再包一层本地文件 preview API

#### Scenario: Preview API enforces existing path policy
- **WHEN** 远端浏览器请求 `/api/codex/images/preview?path=...`
- **THEN** 服务端 MUST 继续使用现有工作区、上传目录和临时目录白名单校验路径
- **AND** 未授权路径 MUST 返回错误而不是读取文件

