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
会话头部 SHALL 显示 4 个固定元素：返回按钮、会话名、Plan/Build segmented 控件、`⋮` 次级菜单按钮。模型/思考档位 SHALL 在 composer 底部工具栏中作为发送前状态展示与切换入口。

#### Scenario: 头部内容
- **WHEN** 会话聊天页渲染
- **THEN** 头部 MUST 同时显示返回、会话名、Plan/Build、`⋮`
- **AND** 头部 MUST 不显示模型选择按钮
- **AND** composer 底部工具栏 MUST 显示模型/思考档位 chip

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
Plan/Build 模式 SHALL 用 segmented 控件呈现，每个会话独立保存当前选择。Plan/Build SHALL 表示协作模式，不承担权限模式切换职责。

#### Scenario: 新会话默认值
- **WHEN** 新建会话
- **THEN** Plan/Build segmented 控件 MUST 默认选中设置页中的全局默认模式

#### Scenario: 切换模式
- **WHEN** 用户在会话头部切换 Plan/Build
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/settings` 更新 collaboration mode
- **AND** 切换 MUST 只影响下一条用户消息，不影响当前正在执行的 turn
- **AND** 系统 MUST NOT 通过 Plan/Build 切换更新 named permission profile

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
压缩上下文 SHALL 仅在当前会话状态明确为 `idle` 时允许发起。会话页 MUST 以实时 thread status 作为 compact 可用性的主状态来源，初始 thread detail 只能作为首屏 fallback。用户点击后 SHALL 弹出确认对话框，确认后才调用后端；请求 pending 期间页面 SHALL 给出进行中反馈，但 MUST NOT 本地追加「正在压缩上下文…」timeline 系统消息；完成后 timeline 的系统消息 MUST 来自 app-server live item / compact 事件。失败后页面 MUST 展示错误并刷新当前 thread status，使入口不会被 stale `detail.status` 或 stale `running` 永久锁死。

#### Scenario: 弹出确认
- **WHEN** 用户点击「压缩上下文」
- **AND** 当前 thread status 为 `idle`
- **THEN** 系统 MUST 弹出确认对话框，说明压缩不可逆

#### Scenario: 确认压缩
- **WHEN** 用户在对话框中确认
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`
- **AND** 页面 MUST 显示压缩进行中反馈
- **AND** timeline MUST NOT 立即追加本地「正在压缩上下文…」系统消息
- **AND** 压缩完成后 timeline MUST 通过 app-server live item / compact 事件插入「压缩上下文已完成」系统消息

#### Scenario: 非空闲禁止压缩
- **WHEN** 当前会话状态不是 `idle`
- **THEN** 系统 MUST 不展示可点击的「压缩上下文」入口
- **AND** 系统 MUST 不调用 `POST /api/codex/threads/:threadId/compact`

#### Scenario: 运行中显示运行中禁用原因
- **WHEN** 当前 thread status 为 `active`
- **THEN** compact 入口 MUST 显示运行中不可压缩的反馈
- **AND** 页面 MUST NOT 因本地 `detail.status` 陈旧而显示“当前状态不可压缩”

#### Scenario: 压缩失败后刷新状态
- **WHEN** 用户确认压缩后后端返回失败或请求超时
- **THEN** 页面 MUST 结束 compact pending 状态
- **AND** timeline MUST 追加一条压缩失败错误
- **AND** 页面 MUST 读取 summary 或使用响应中的 thread status 同步当前状态
- **AND** compact 入口 MUST 基于同步后的状态重新渲染

#### Scenario: 状态事件解除本地 active
- **WHEN** 首屏 detail status 为 `active`
- **AND** 后续 event stream 或 summary 返回该 thread status 为 `idle`
- **THEN** 页面 MUST 停止显示 processing UI
- **AND** compact 入口 MUST 在没有 pending compact 时恢复为可点击

#### Scenario: 不可恢复状态提供恢复路径
- **WHEN** 当前 thread status 为 `notLoaded` 或 `systemError`
- **THEN** compact 入口 MUST NOT 直接调用 compact API
- **AND** UI MUST 提供明确的恢复后再压缩路径或可重试错误反馈
- **AND** 恢复成功后 MUST 重新基于最新 thread status 判断 compact 是否可用

### Requirement: Header context window progress
会话聊天页 SHALL 在 sticky header 下方显示当前会话上下文窗口区域。当系统拥有该会话最近一次 `modelContextWindow` 和最近一次请求 token 用量时，进度区域 MUST 显示一条细进度线和百分比；当缺少可靠用量或窗口大小时，系统 MUST 显示不可点击的未知占位条，且不得伪造百分比。

#### Scenario: 显示可用上下文进度
- **WHEN** 当前会话存在最近一次上下文用量，且 `modelContextWindow` 大于 0
- **THEN** header 下方 MUST 显示上下文进度线
- **AND** 进度线 MUST 按 `totalTokens / modelContextWindow` 显示占用比例
- **AND** 进度区域 MUST 显示四舍五入后的百分比

#### Scenario: 缺少用量或窗口大小时显示未知占位
- **WHEN** 当前会话没有最近一次上下文用量，或 `modelContextWindow` 为空、为 0 或小于 0
- **THEN** header 下方 MUST 显示上下文未知占位条
- **AND** 占位条 MUST 不显示可计算百分比
- **AND** 占位条 MUST 不提供上下文用量详情入口

#### Scenario: 进度颜色按阈值变化
- **WHEN** 上下文进度百分比小于 60
- **THEN** 进度线 MUST 使用健康色
- **WHEN** 上下文进度百分比大于等于 60 且小于 80
- **THEN** 进度线 MUST 使用琥珀色
- **WHEN** 上下文进度百分比大于等于 80 且小于 95
- **THEN** 进度线 MUST 使用橙色
- **WHEN** 上下文进度百分比大于等于 95
- **THEN** 进度线 MUST 使用红色
- **AND** 系统 MUST NOT 因达到任一阈值而弹出提示或自动展示压缩按钮

### Requirement: Context usage updates and local restore
会话聊天页 SHALL 通过现有 `token_usage_updated` 浏览器事件更新线程级上下文用量，并按 `threadId` 在本地缓存最近一次可靠用量。重新打开或刷新会话时，系统 MUST 先使用会话详情中的历史上下文用量，其次恢复该会话缓存值；后续实时事件 MUST 覆盖已有值。

#### Scenario: 实时事件更新进度
- **WHEN** 前端收到当前会话的 `token_usage_updated` 事件
- **THEN** 线程状态 MUST 保存该事件最近一次请求用量中的 `totalTokens`、`inputTokens`、`outputTokens`、`reasoningOutputTokens` 和 `modelContextWindow`
- **AND** header 下方上下文进度 MUST 使用最新事件重新渲染
- **AND** 系统 MUST 将最近一次用量写入该 `threadId` 的本地缓存

#### Scenario: 打开会话恢复历史用量
- **WHEN** 用户打开某个会话，且会话详情从历史 `token_count` 记录恢复出最近一次上下文用量
- **THEN** 系统 MUST 将该用量写入线程状态和本地缓存
- **AND** header 下方上下文进度 MUST 显示真实百分比而不是未知占位

#### Scenario: 打开会话恢复缓存
- **WHEN** 用户打开某个会话，且该会话存在本地缓存的最近上下文用量
- **THEN** 系统 MUST 在收到新的实时事件前使用缓存值显示上下文进度

#### Scenario: 实时事件覆盖缓存
- **WHEN** 会话已使用缓存值显示上下文进度
- **AND** 前端收到同一会话新的 `token_usage_updated` 事件
- **THEN** 系统 MUST 使用新事件覆盖线程状态和本地缓存

### Requirement: Context usage detail sheet
上下文进度区域 SHALL 可点击并打开底部详情面板。详情面板 MUST 展示总 token、模型上下文窗口、百分比、输入 token、输出 token、推理输出 token，并提供“压缩上下文”入口；压缩入口 MUST 复用现有确认对话框，确认后才调用压缩接口。详情面板中的压缩入口 MUST 与会话头部菜单使用同一 thread status 和 compact pending 状态，不得使用陈旧 detail 状态单独判断。

#### Scenario: 打开详情面板
- **WHEN** 用户点击 header 下方可用的上下文进度区域
- **THEN** 系统 MUST 从底部打开上下文用量详情面板
- **AND** 面板 MUST 显示 `totalTokens / modelContextWindow` 与百分比
- **AND** 面板 MUST 显示输入、输出和推理输出 token 明细

#### Scenario: 从详情发起压缩
- **WHEN** 用户在上下文用量详情面板点击「压缩上下文」
- **AND** 当前 thread status 为 `idle`
- **THEN** 系统 MUST 关闭详情面板并打开现有压缩确认对话框
- **AND** 只有用户在确认对话框确认后，系统 MUST 调用 `POST /api/codex/threads/:threadId/compact`

#### Scenario: 详情面板非 idle 禁用压缩
- **WHEN** 上下文用量详情面板打开
- **AND** 当前 thread status 不是 `idle` 或 compact request pending
- **THEN** 面板 MUST 不显示可点击的压缩按钮
- **AND** 面板 MUST 显示与头部菜单一致的禁用原因

#### Scenario: 无进度时不可打开详情
- **WHEN** 当前会话没有可用上下文窗口进度
- **THEN** header 下方未知占位条 MUST 不提供上下文用量详情入口

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
Agent 回复 SHALL 最终按 GitHub-flavored markdown 全量渲染，包含列表、加粗、表格、链接、内联代码块。为了保证移动端首屏性能，系统 MAY 在消息离屏、尚未进入渲染窗口、浏览器尚未空闲或 agent 仍在流式输出时先展示轻量纯文本占位；当消息进入可见窗口且调度条件满足后，系统 MUST 完成 Markdown 渲染。

#### Scenario: 渲染 markdown 元素
- **WHEN** agent 消息包含 markdown 语法
- **AND** 该消息进入 timeline 可见渲染窗口且 Markdown 渲染已调度完成
- **THEN** 列表、表格、加粗、链接 MUST 渲染为对应可视元素

#### Scenario: 不渲染 LaTeX
- **WHEN** agent 消息包含 `$...$` 或 `\[...\]` 等 LaTeX 公式语法
- **THEN** 系统 MUST 不解析公式
- **AND** MUST 保留原文展示

#### Scenario: 渲染 Mermaid
- **WHEN** agent 消息包含 ```mermaid 代码块
- **AND** 用户展开或查看到该 Mermaid 所在消息
- **THEN** 系统 MUST 渲染为 Mermaid 图

#### Scenario: 离屏历史消息延迟 Markdown
- **WHEN** 会话首屏包含大量历史 agent 消息
- **AND** 某条 agent 消息不在当前渲染窗口内
- **THEN** 系统 MAY 暂时不执行 Markdown 解析、代码高亮或 Mermaid 渲染
- **AND** 该消息进入窗口后 MUST 仍能完成完整 Markdown 渲染

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
应用 SHALL 在用户离开某个会话切到其他页时，在内存中保留该会话已加载的 timeline；重新进入时 SHALL 直接渲染缓存内容，并在后台连接 timeline event stream。系统 MUST NOT 为了首屏显示缓存而先重新拉取 turns 列表；当事件流断线、补发失败或检测到事件缺口时，系统 SHALL 在缓存已显示后执行必要 snapshot repair。

#### Scenario: 缓存命中
- **WHEN** 用户先后进入会话 A、列表页、再次进入会话 A
- **THEN** 第二次进入 A 时 MUST 立刻渲染上一次的 timeline 缓存
- **AND** MUST 不为了首屏显示重新拉取 turns 列表
- **AND** MUST 在后台连接 timeline event stream

#### Scenario: 缓存不持久化
- **WHEN** 浏览器页面被刷新或关闭
- **THEN** 内存缓存 MUST 丢失
- **AND** 下次进入 MUST 重新拉取最新 turns

#### Scenario: 缓存显示后的修复读取
- **WHEN** 缓存 timeline 已显示
- **AND** 事件流断线、重连补发失败或检测到事件缺口
- **THEN** 页面 MUST 执行一次 snapshot repair
- **AND** repair 结果 MUST replace 或按 revision 合并当前 timeline
- **AND** MUST NOT 保留 repair 结果中已经不存在的旧尾部 entries

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

### Requirement: Running chat view uses event stream instead of full-timeline polling
会话聊天页 SHALL 在首屏 snapshot 后使用 timeline event stream 更新 running thread。页面 MUST NOT 在事件流正常时以固定短间隔轮询 `/api/codex/threads/:threadId` 获取完整 timeline。页面 MAY 低频轮询不含 timeline 的轻量 summary 以发现 running thread 已变 idle；发现 idle 或收到完成事件后 SHALL 只触发一次完整 snapshot repair 做最终 reconcile。Snapshot repair SHALL 只作为确认缺口、完成后 reconcile 或明确异常窗口的有界恢复手段；一次 repair 返回 active 状态本身 MUST NOT 安排下一次 full-thread detail repair。

#### Scenario: Initial snapshot then event stream
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MAY 调用一次 `readThread` 获取初始 timeline
- **AND** running 状态下后续新增输出 MUST 通过 timeline event stream 更新

#### Scenario: No two-second full timeline polling
- **WHEN** thread 处于 running 状态且事件流连接正常
- **THEN** 页面 MUST NOT 每 2 秒或其他固定短周期调用 `/api/codex/threads/:threadId` 拉取完整 thread detail
- **AND** timeline 增量 MUST 由事件流驱动
- **AND** 页面 MAY 轮询轻量 summary endpoint，但该轮询 MUST NOT 携带完整 timeline

#### Scenario: Repair read only after stream gap, completion, or explicit missing-output recovery
- **WHEN** 事件流断线、重连补发失败、检测到事件缺口、当前 active turn 完成，或压缩上下文完成
- **THEN** 页面 MAY 调用 `readThread` 执行一次 snapshot repair
- **AND** repair 完成后 MUST 回到事件流主路径
- **AND** repair 结果仍为 active MUST NOT 仅因此重新安排下一次 full-thread detail repair

#### Scenario: Summary polling triggers one final reconcile
- **WHEN** 页面正在显示 running thread
- **AND** 轻量 summary endpoint 返回该 thread 已变为空闲
- **THEN** 页面 MUST 停止该轮询并触发一次 snapshot repair
- **AND** MUST NOT 在 running 期间通过 summary 轮询拉取完整 timeline

#### Scenario: Active repair result does not loop
- **WHEN** 页面因已确认的 repair 标记调用 `/api/codex/threads/:threadId`
- **AND** repair 返回的 thread 仍处于 running 状态
- **THEN** 页面 MUST 应用该 repair snapshot 并清除已完成的 repair 标记
- **AND** 页面 MUST NOT 因该 active snapshot 自动启动新的短周期 repair timer

#### Scenario: Send fallback is one-shot when no visible output arrives
- **WHEN** 用户发送消息后 `startTurn` 没有返回可用 thread snapshot
- **AND** 当前 turn 在短暂等待窗口内没有任何可见服务端输出
- **THEN** 页面 MAY 发起一次 snapshot repair 恢复缺失输出或状态
- **AND** 该 repair 成功应用后 MUST NOT 因 thread 仍 active 而继续重复 full-thread detail repair

#### Scenario: Visible live output cancels missing-output fallback
- **WHEN** 用户发送消息后页面已为当前 turn 收到 agent、reasoning、tool、command、diff 或 error 等可见服务端输出
- **THEN** 页面 MUST NOT 再因该 turn 的 missing-output fallback 调用 `/api/codex/threads/:threadId`
- **AND** 后续输出 MUST 继续由 timeline event stream 更新

### Requirement: Timeline preserves semantic order during live confirmation
会话聊天页 SHALL 在 live delta、server item completion、snapshot 和 JSONL repair 混合到达时保持同一 turn 的语义顺序。user message MUST 显示在该 turn 的 agent、reasoning、tool、command、runtime loading 和 diff 输出之前；同 turn 活动 MUST 保持在可推断的执行位置，MUST NOT 被 repair 或确认流程统一移动到最终 assistant 回复之后。

#### Scenario: Agent delta arrives before server user item
- **WHEN** 前端已经显示本地 optimistic user message
- **AND** agent delta 先于 server user item 到达
- **AND** server user item 之后确认同一 turn 的 user message
- **THEN** user message MUST 保持在 agent 输出之前
- **AND** timeline MUST NOT 显示 agent 回复在用户消息上方

#### Scenario: Activity stays between user and final assistant after repair
- **WHEN** 前端已经显示同一 turn 的 user message 和最终 assistant message
- **AND** snapshot/JSONL repair 之后补齐该 turn 的 tool、command、read、search、runtime loading、Thinking 或 diff entries
- **THEN** 会话页 MUST 将这些活动显示为该 turn 的内联活动日志
- **AND** 活动 MUST 位于 user message 之后
- **AND** 在缺少更可靠锚点时，活动 MUST 位于最终 assistant message 之前

#### Scenario: User confirmation with interleaved activity remains single message
- **WHEN** 本地 optimistic user message、activity entries 和 server user item 以混合顺序到达
- **AND** local user message 与 server user item 属于同一 `turnId` 或同一 `clientUserMessageId`
- **THEN** 会话页 MUST 只显示一条 user message
- **AND** 该 user message MUST 仍位于同 turn 的 activity 和 assistant 输出之前

### Requirement: Snapshot repair replaces unknown tail
会话聊天页在事件缺口、rollback 或 fork rollback 后执行 snapshot repair 时，repair 结果 SHALL replace 当前 thread timeline 的未知尾部。客户端 MUST 清理 repair 结果中不存在的旧 local entries、旧 live entries 和旧 pending placeholders。

#### Scenario: Repair after stream gap
- **WHEN** timeline event stream 报告 gap
- **AND** 页面通过 `readThread` 获取 repair snapshot
- **THEN** 页面 MUST 用 repair snapshot 建立新的 timeline 基线
- **AND** repair snapshot 中不存在的旧尾部 entries MUST 不再显示

### Requirement: Cached thread can reconnect without disabling resolved input
页面命中内存缓存时 SHALL 立即显示缓存 timeline，并在后台连接 event stream 与必要 repair。若缓存中的 thread detail 足以支持发送，输入区 MUST NOT 仅因当前 `detail` state 尚未重新读取完成而禁用。

#### Scenario: Cached idle thread reopen
- **WHEN** 用户离开 idle thread 后重新进入同一 thread
- **AND** 内存缓存中已有 timeline 和 thread 基础信息
- **THEN** 页面 MUST 立即显示缓存
- **AND** 输入框 SHOULD remain usable unless a repair or running state explicitly disables it

### Requirement: Event stream error and repair do not race into duplicates
浏览器 EventSource error、自动重连补发和 snapshot repair SHALL 协同处理。客户端 MUST 避免在同一断线窗口内同时把 repair snapshot 和补发 delta 重复应用到同一 item。

#### Scenario: Error triggers repair while reconnect replays events
- **WHEN** EventSource error 触发 snapshot repair
- **AND** 浏览器随后自动重连并补发旧 delta
- **THEN** 前端 MUST 基于 generation、event id、item revision 或 offset 忽略已覆盖 delta
- **AND** timeline MUST NOT 出现重复输出

### Requirement: Initial snapshot cannot overwrite post-send local state
会话页在显示 cached timeline 且首屏 `readThread` 仍未完成时 SHALL 允许用户发送消息；但发送后，发送前启动的旧 initial snapshot MUST NOT 以 replace 方式覆盖 optimistic user message、已到达 live delta 或已绑定的新 turn metadata。

#### Scenario: Cached send races initial read
- **WHEN** 页面使用 cached timeline 显示 idle thread
- **AND** initial `readThread` 请求仍在进行
- **AND** 用户发送新消息并收到 `turn/start` 返回
- **AND** initial `readThread` 随后返回发送前的旧 snapshot
- **THEN** 客户端 MUST 忽略该旧 snapshot 的 replace
- **AND** timeline MUST 保留新 user message 和已到达的 live 输出

### Requirement: Repair replace is serialized with local mutations
snapshot repair、rollback replace、fork initialization 和本地 send mutation SHALL 通过 thread-local epoch 或等价机制串行化。旧请求完成后 MUST NOT 回退较新的本地 timeline 状态。

#### Scenario: Repair finishes after a new send
- **WHEN** 客户端因 gap 发起 snapshot repair
- **AND** 用户随后基于当前可用输入发送新消息
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 掉新发送的 optimistic entry
- **AND** 后续 timeline MUST 以新 turn 的事件流为准

### Requirement: Confirmed snapshot repair is not lost across local mutations
会话页 SHALL 使用 thread-local epoch 或等价机制阻止旧 snapshot repair 覆盖较新的 send/rewind/fork 本地状态；但由确认缺口触发的 snapshot repair MUST NOT 因本地 mutation 发生而被静默清除。旧 repair 返回且不能应用时，系统 MUST 保留或重新排队 repair，直到某次 repair 成功应用或被新的权威 snapshot 明确替代。

#### Scenario: Repair returns after send changed epoch
- **WHEN** 客户端因 `timeline-gap` 为某 thread 发起 snapshot repair
- **AND** 用户随后发送消息导致 thread-local mutation epoch 增加
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 新发送的 optimistic entry 或 live delta
- **AND** 客户端 MUST 保留该 thread 的 repair 需求，使后续稳定 epoch 下再次执行 repair 或应用更新的权威 snapshot

#### Scenario: Repair succeeds at current epoch
- **WHEN** snapshot repair 返回时 request epoch 仍是当前 epoch
- **THEN** 客户端 MUST 用 repair 结果 replace 未知尾部
- **AND** repair 成功应用后 MUST 清除该 thread 的 repair 标记

### Requirement: Initial and repair snapshots are not invalidated by failed local actions
会话页 SHALL 只在实际产生本地 timeline mutation 或即将执行服务端历史 mutation 时推进 mutation epoch。仅本地校验失败的 rewind/fork 操作 MUST NOT 作废正在进行的 initial snapshot 或 snapshot repair。

#### Scenario: Rewind target cannot be resolved locally
- **WHEN** 用户尝试 rewind 某条 user message
- **AND** 前端无法可靠定位目标 turn 或计算 rollback 范围
- **THEN** 系统 MUST NOT 调用 rollback API
- **AND** MUST NOT 推进 mutation epoch 使正在返回的 initial snapshot 或 repair snapshot 失效

#### Scenario: Fork target cannot be resolved before rollback
- **WHEN** fork 后无法在 forked thread 中可靠定位等价目标 message
- **THEN** 系统 MUST NOT 调用 rollback API 删除 forked thread turns
- **AND** 原 thread 正在进行的 snapshot/repair MUST NOT 因该失败路径被无意义作废

### Requirement: 用户消息展示结构化 Skill 引用
会话 timeline 中的用户消息 SHALL 将 Skill 引用作为结构化附件展示，不得把 Skill 引用渲染进正文文本。Skill 引用 SHALL 使用只读 chip 或等价轻量样式显示 Skill 名称，并保持移动端可读、不撑宽布局。

#### Scenario: 展示 Skill 引用 chip
- **WHEN** timeline 渲染一条包含 Skill 引用的用户消息
- **THEN** 用户消息 MUST 显示对应 Skill 名称
- **AND** Skill 名称 MUST 与正文文本分离展示
- **AND** 正文文本 MUST 不包含 `[skill]`

#### Scenario: 乐观消息与服务端消息一致
- **WHEN** 用户发送一条带 Skill 引用的消息
- **THEN** 本地乐观消息 MUST 立即显示 Skill 引用
- **AND** 服务端回读或 snapshot repair 后 MUST 保持同样的 Skill 引用展示

#### Scenario: Skill 名称过长
- **WHEN** Skill 名称超过手机屏幕可展示宽度
- **THEN** Skill chip MUST 截断或换行而不撑出横向滚动
- **AND** 用户消息正文 MUST 仍保持可读

### Requirement: 会话首屏读取使用有界最近 turns
会话聊天页在浏览器刷新、首次进入或 snapshot repair 时 SHALL 使用有界最近 turns 作为首屏 timeline 数据源，MUST NOT 默认读取完整历史 turns。默认首屏窗口 SHOULD 覆盖最近 30 个 turns 或等价数量级，并保留继续向上分页加载更早历史的 cursor。

#### Scenario: 刷新长会话
- **WHEN** 浏览器刷新并进入一个包含大量历史 turns 的会话
- **THEN** 首次会话详情读取 MUST 只返回最近有界 turns
- **AND** 页面 MUST 在该窗口数据到达后显示聊天界面和输入区
- **AND** 更早历史 MUST 只能通过向上分页继续加载

#### Scenario: Snapshot repair 不全量拉取历史
- **WHEN** timeline event stream 报告某 thread 存在可归属 gap
- **THEN** 页面 MUST 执行有界 snapshot repair 或等价尾部窗口修复
- **AND** repair MUST replace 当前未知尾部
- **AND** repair MUST NOT 因长会话默认拉取完整历史 turns

#### Scenario: 空会话不请求历史窗口
- **WHEN** 会话尚无任何 turns
- **THEN** 页面 MUST 立即显示可用输入区
- **AND** MUST NOT 为了空 timeline 发起无意义的历史分页请求

### Requirement: Timeline 渲染使用窗口化或等价裁剪
会话聊天页 SHALL 只挂载当前可见区域附近的 timeline rows，并为离屏历史内容保留滚动高度或等价定位能力。窗口化实现 MUST 兼容移动端动态高度内容，包括 Markdown、图片、diff、工具卡片、审批卡片和系统消息。

#### Scenario: 长 timeline 初次渲染
- **WHEN** 已加载 timeline 包含大量 entries
- **THEN** DOM 中 MUST 只挂载可见区域及缓冲区内的 rows
- **AND** 离屏 entries MUST NOT 同步创建完整 React/DOM 树

#### Scenario: 向上分页后保持阅读位置
- **WHEN** 用户滚动到顶部并加载更早 turns
- **THEN** 新增历史 entries MUST 插入当前窗口之前
- **AND** 用户当前阅读的可见内容 MUST 保持在原视觉位置附近

#### Scenario: 跳到最新仍可用
- **WHEN** 用户在历史位置阅读且新输出到达
- **THEN** 页面 MUST 保持当前阅读位置
- **AND** 用户点击「跳到最新」后 MUST 滚动到最新输出

### Requirement: Timeline 派生计算不按每行扫描全量 entries
会话聊天页 SHALL 在渲染前预计算 live agent entry、用户消息操作可用性、turn order 和分页边界等派生信息。单个 timeline row MUST NOT 为了判断自身状态反复扫描或过滤完整 entries。

#### Scenario: 用户消息操作状态
- **WHEN** timeline 渲染大量用户消息
- **THEN** 系统 MUST 使用预计算结果判断「回滚到这里」和「从这里 Fork」是否可用
- **AND** MUST NOT 在每条用户消息渲染期间重新遍历完整 entries

#### Scenario: Live agent 状态
- **WHEN** agent 正在输出且 active turn 已知或尚未到位
- **THEN** 系统 MUST 使用预计算 live entry id 判断哪条 agent 消息按 live 方式渲染
- **AND** MUST NOT 在每条 agent 消息渲染期间重新向后扫描完整 entries

### Requirement: 会话页组件订阅粒度隔离 timeline 更新
会话页 SHALL 将 header、timeline、输入区、底部抽屉和弹窗拆分为独立订阅边界。timeline entries 的高频更新 MUST NOT 导致输入框本地草稿、图片选择、Skill 选择、模型菜单或重命名弹窗被重置。

#### Scenario: Delta 到达时输入区保持稳定
- **WHEN** 用户正在输入草稿
- **AND** agent 高频 delta 持续到达
- **THEN** 输入框内容、光标和已选附件 MUST 保持稳定
- **AND** 输入区 MUST NOT 因 timeline entries 变化而重新初始化

#### Scenario: Header 不随每条 delta 重算
- **WHEN** 同一 agent item 连续收到多个文本 delta
- **THEN** 只有 timeline 可见输出和必要 running 状态 SHOULD 更新
- **AND** 会话标题、模型按钮和菜单状态 MUST NOT 因每条文本 delta 重建可见状态

### Requirement: 分页 timeline 顺序跨页面稳定
历史分页和首屏窗口返回的 turns SHALL 在前端合并后保持全局时间顺序和稳定 turn 身份。分页适配层 MUST NOT 使用仅在单页内有效的 `turnIndex` 破坏跨页排序、rewind 或 fork 计算。

#### Scenario: 多页历史合并
- **WHEN** 首屏已加载最近 turns
- **AND** 用户继续向上加载更早一页 turns
- **THEN** 合并后的 timeline MUST 按真实会话顺序排列
- **AND** 每个 entry 的 `turnId` MUST 保持可用于 rewind/fork 计算

#### Scenario: 页面内 turnIndex 重复
- **WHEN** 不同分页返回的 entries 存在重复或页内重置的 `turnIndex`
- **THEN** 前端 MUST 使用更可靠的 turn order 或插入顺序合并
- **AND** MUST NOT 因 `turnIndex` 重复把新旧 turns 排错

### Requirement: 会话聊天性能指标可观测
会话聊天页 SHALL 在开发和测试环境中提供可验证的性能指标或测试钩子，覆盖首屏 entries 数量、timeline store 更新时间、可见 row 数量、delta 批处理 flush 次数和 Markdown 懒渲染数量。

#### Scenario: 长会话性能回归测试
- **WHEN** 测试构造大量历史 entries 和高频 delta
- **THEN** 测试 MUST 能断言可见 store 更新次数、挂载 row 数量或复杂度上限
- **AND** MUST 能防止重新引入全量同步渲染路径

