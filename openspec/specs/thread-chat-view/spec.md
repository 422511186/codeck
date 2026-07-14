# thread-chat-view Specification

## Purpose
TBD - created by archiving change add-mobile-web-frontend. Update Purpose after archive.
## Requirements
### Requirement: 会话聊天页采用单栏 timeline 布局
会话聊天页 SHALL 使用单栏垂直 timeline 作为主体内容区，timeline 上方是 sticky 头部，下方是参与正常页面布局的底部输入区。

#### Scenario: 默认布局
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MUST 由「sticky 头部 + 可收缩 timeline + 底部输入区」三段构成
- **AND** timeline MUST 占满头部与输入区之间的剩余区域
- **AND** 输入区 MUST NOT 通过覆盖 timeline 的固定定位实现

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
timeline SHALL 只通过 thread-wide `cursor + limit` 分页渐进加载消息。任何页面、刷新、恢复、修复、重连或后台同步流程 MUST NOT 全量加载会话消息，服务端接口 MUST NOT 返回完整 timeline。

#### Scenario: 首次进入只加载最新页
- **WHEN** 用户首次进入或刷新会话聊天页
- **THEN** 系统 MUST 只读取不含 turns 的会话元数据和最新一页消息
- **AND** 消息页 MUST 使用 `thread/items/list` 的 thread-wide cursor
- **AND** 单次消息响应大小 MUST 不随会话历史总长度线性增长

#### Scenario: 顶部加载更早消息
- **WHEN** 用户向上滚动接近 timeline 顶部
- **THEN** 系统 MUST 使用当前历史 cursor 请求一页更早消息
- **AND** 加载期间 MUST 在 timeline 顶部显示细 spinner
- **AND** 系统 MUST NOT 为获取更早消息重新读取完整 thread detail

#### Scenario: 到达起点
- **WHEN** 后端返回的下一个 cursor 为空
- **THEN** timeline 顶部 MUST 显示灰色细线 + 文案「会话开始」
- **AND** 系统 MUST 停止继续请求更早页

#### Scenario: 分页协议失败
- **WHEN** 消息分页请求返回协议错误或服务端错误
- **THEN** 页面 MUST 只展示该页的局部错误和重试路径
- **AND** 系统 MUST NOT 回退到包含完整 timeline 的读取方式

#### Scenario: 服务端强制分页边界
- **WHEN** 客户端省略 limit、请求超大 limit 或尝试请求全部消息
- **THEN** 服务端 MUST 使用受控默认值或上限返回有限消息页
- **AND** 响应 MUST 同时受条目数量和序列化字节预算限制

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
timeline 上每条用户、agent、system 和可见 activity 消息 SHALL 在头部或等价元信息区域显示相对时间，不论时间是否超过一天，始终使用相对时间格式。相对时间文本 MUST 不挤压主要消息内容，且在移动端窄宽度下保持换行或省略稳定。

#### Scenario: 近期消息
- **WHEN** 消息发生在不久前
- **THEN** 时间 MUST 显示如「3 分钟前」「刚刚」

#### Scenario: 久远消息
- **WHEN** 消息发生在数天或数月前
- **THEN** 时间 MUST 仍使用相对时间（如「3 天前」「2 个月前」）

#### Scenario: Activity 消息显示时间
- **WHEN** timeline 中渲染可见 activity、system 或 tool 输出行
- **THEN** 该行 MUST 显示与普通消息一致的相对时间或等价可见时间元信息
- **AND** 时间元信息 MUST NOT 导致移动端消息正文重叠

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
会话聊天页 SHALL 只为当前可见窗口预计算 live agent entry、用户消息操作可用性、turn order、activity blocks 和分页边界等派生信息。单个 timeline row MUST NOT 为了判断自身状态反复扫描或过滤完整 entries；未变化 entry 的引用 MUST 保持稳定，使无关 delta 不触发该 row 的派生和渲染。

#### Scenario: 用户消息操作状态
- **WHEN** timeline 渲染大量用户消息
- **THEN** 系统 MUST 使用预计算结果判断「回滚到这里」和「从这里 Fork」是否可用
- **AND** MUST NOT 在每条用户消息渲染期间重新遍历完整 entries

#### Scenario: Live agent 状态
- **WHEN** agent 正在输出且 active turn 已知或尚未到位
- **THEN** 系统 MUST 使用预计算 live entry id 判断哪条 agent 消息按 live 方式渲染
- **AND** MUST NOT 在每条 agent 消息渲染期间重新向后扫描完整 entries

#### Scenario: Unrelated delta preserves visible row identity
- **WHEN** 当前可见窗口包含多个未变化 rows
- **AND** 其中一个 agent entry 收到文本 delta
- **THEN** 未变化 rows MUST 保持可复用的 entry 引用和派生结果
- **AND** activity block、消息操作状态和 Markdown 派生 MUST 只对受影响 row 或 block 失效

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
会话聊天页 SHALL 在开发和测试环境中提供可验证的性能指标或测试钩子，覆盖首屏 entries 数量、timeline store 提交次数、engine fast-path 次数、结构性 normalization 次数、index rebuild entries、可见 row 数量、delta 批处理 flush 次数和昂贵输出派生次数。

#### Scenario: 长会话性能回归测试
- **WHEN** 测试构造至少 1200 个历史 entries 和同一 item 的 200 个高频 delta
- **THEN** 测试 MUST 能断言可见 store 提交、结构性 normalization 和完整 index rebuild 不随 delta 数量线性重复
- **AND** MUST 能防止重新引入每个 delta 全量同步归一化或整页渲染路径

#### Scenario: 协议 batch 提交预算
- **WHEN** store 接收一个包含多个合法 timeline events 的 `codex-event-batch`
- **THEN** 测试 MUST 能断言同一 thread 的可见 timeline store 提交不超过一次
- **AND** diagnostics MUST 保留接受、丢弃、batch flush 和 barrier revalidation 的计数

### Requirement: Timeline 数据读取必须保持有界
会话聊天页 SHALL 在首屏、分页、snapshot repair、turn item 补齐和 rollout supplement 中使用有界 timeline window。系统 MUST NOT 为了补充 activity、context usage、repair 或分页而默认读取完整 turns 历史或完整 rollout JSONL；rollout supplement MUST 在扫描或解析过程中按当前窗口 turnId 过滤，并在预算耗尽时跳过补充。

#### Scenario: 首屏读取保持最近窗口
- **WHEN** 用户进入包含大量历史 turns 的会话页
- **THEN** 系统 MUST 使用 metadata 加最近 turns window 初始化 timeline
- **AND** MUST NOT 请求 `thread/read includeTurns=true`
- **AND** MUST NOT 因补充 rollout activity 或 context usage 读取完整 rollout JSONL

#### Scenario: 分页读取有默认限制
- **WHEN** 用户向上滚动触发更早历史分页
- **THEN** 前端和后端 MUST 使用默认分页 limit
- **AND** 后端 MUST 对客户端传入的 limit 做上限钳制
- **AND** 单次分页 MUST NOT 返回未受限的完整历史

#### Scenario: Repair 使用有界窗口
- **WHEN** timeline event stream 报告可归属 gap 或 turn completion 需要修复
- **THEN** snapshot repair MUST 读取当前 thread 的最近窗口或目标 turn 相关窗口
- **AND** MUST NOT 因 repair 默认加载完整会话历史

#### Scenario: Supplement 解析时过滤窗口
- **WHEN** rollout JSONL 包含大量窗口外 turns
- **AND** 当前 timeline window 只允许少量 turnId
- **THEN** supplement MUST 在扫描或解析过程中忽略窗口外 turn
- **AND** MUST NOT 先完整物化窗口外事件再过滤

### Requirement: Rollout supplement 不得阻塞主 timeline
会话聊天页 SHALL 把 rollout JSONL supplement 视为可降级补充信息。系统 MUST 优先保证主 timeline 可渲染和可流式更新；当 supplement 无法在有界预算内完成时，MUST 跳过或延后 supplement，而不是阻塞首屏、分页或 repair。

#### Scenario: 大 rollout 文件
- **WHEN** 当前 thread 的 rollout JSONL 很大
- **THEN** 读取 thread detail 或分页 MUST 仍在有界 timeline window 内完成
- **AND** 系统 MAY 暂时缺少部分历史 activity supplement
- **AND** 主 timeline MUST NOT 因完整 JSONL 解析而卡顿

#### Scenario: Supplement 只处理当前窗口
- **WHEN** 当前 timeline window 只包含最近 N 个 turns
- **THEN** rollout supplement MUST 只尝试补齐该窗口内可识别 turn 的 activity/context 信息
- **AND** MUST NOT 为窗口外 turns 生成或合并 timeline entries

#### Scenario: Supplement 预算耗尽时降级
- **WHEN** supplement 扫描达到文件大小、行数、时间或内存预算
- **THEN** 系统 MUST 停止该次 supplement 补齐并返回主 timeline
- **AND** MUST NOT 阻塞首屏、分页或 snapshot repair 完成

### Requirement: 运行中输出无需手动刷新即可收敛
会话聊天页 SHALL 通过 timeline event stream 自动显示运行中 turn 的 agent 回复、reasoning、tool、diff 和完成状态。若 live event 缺失或 listener 空窗导致缺口，系统 MUST 自动触发归属明确的有界 repair，不能要求用户手动刷新页面。

#### Scenario: Live event 正常到达
- **WHEN** 用户发送消息且 app-server 产生 agent/tool/reasoning 输出
- **THEN** 当前会话页 MUST 自动显示这些输出
- **AND** 用户 MUST NOT 需要刷新页面才能看到回复

#### Scenario: Completion 后没有可见输出
- **WHEN** 当前 active turn 收到完成事件
- **AND** timeline 中该 turn 没有任何可见 agent/tool/reasoning/activity 输出
- **THEN** 前端 MUST 对该 turn 或最近窗口触发 bounded repair
- **AND** repair 后 MUST 将真实 thread history 中的输出合并到 timeline

#### Scenario: Listener 空窗恢复
- **WHEN** 底层事件流已消费当前 thread 的可见事件但页面 listener 临时不存在
- **AND** 新 listener 注册或页面重新进入该 thread
- **THEN** 系统 MUST 应用已缓存事件或触发该 thread 的 bounded repair
- **AND** MUST NOT 静默丢失导致用户必须手动刷新

### Requirement: Timeline 更新不得重置非 timeline UI 状态
会话聊天页 SHALL 将 timeline 高频更新与 header、composer、模型/权限选择器、上下文详情、重命名弹窗等 UI 状态隔离。timeline entries 的 delta、repair 或分页更新 MUST NOT 重置输入框草稿、图片选择、Skill 选择或打开中的弹窗。

#### Scenario: 高频 delta 到达
- **WHEN** 当前 turn 高频产生 agent delta
- **THEN** 只有 timeline 可见输出和必要 running 状态 SHOULD 更新
- **AND** composer 本地草稿、图片附件和选择器状态 MUST 保持不变

#### Scenario: Repair replace timeline
- **WHEN** snapshot repair replace 当前 thread timeline
- **THEN** 页面 MUST 保留与 timeline 无关的用户输入状态
- **AND** repair MUST NOT 关闭用户正在操作的模型、权限、目标或上下文面板，除非该面板对应的 thread 已切换

### Requirement: Rollout supplement uses bounded scan budgets
会话聊天页和后端适配层 SHALL 将 rollout JSONL supplement 作为可跳过的窗口补充源。系统 MUST 不为首屏、分页、snapshot repair、turn item 补齐或 context usage 默认读取、切分或解析完整 rollout 文件；supplement MUST 按当前 timeline window、当前分页或目标 turn 的 `turnId` 过滤，并受文件大小、行数、耗时或内存预算约束。

#### Scenario: Oversized rollout does not block thread detail
- **WHEN** 用户打开包含大 rollout JSONL 的 thread
- **AND** 主 `thread/read` 和最近 turns window 已可返回
- **THEN** 后端 MUST 在 supplement 预算耗尽时跳过或延后 supplement
- **AND** thread detail MUST 仍返回主 timeline window
- **AND** 客户端 MUST 不要求用户刷新页面才能看到主 timeline

#### Scenario: Page supplement scans only page turns
- **WHEN** 用户向上分页加载更早历史
- **AND** rollout JSONL 中包含大量不属于该 page 的 turns
- **THEN** supplement MUST 只尝试补齐该 page 的 `turnId`
- **AND** 窗口外记录 MUST NOT 消耗该 page 的 supplement 记录预算

#### Scenario: Context usage avoids full rollout parse
- **WHEN** header 或 context sheet 需要展示上下文用量
- **THEN** 系统 MUST 优先使用 app-server summary、live `token_usage_updated`、本地缓存或有界尾部扫描
- **AND** MUST NOT 为了计算 context usage 完整解析历史 rollout JSONL

### Requirement: Timeline viewport recycles offscreen rows
移动端 timeline SHALL 使用可回收的渲染窗口。系统 MUST 只挂载可见区域和上下 buffer 内的 rows；当用户长时间向上或向下浏览时，窗口外 rows MUST 被回收，并用稳定 spacer 或等价布局机制保持滚动位置。

#### Scenario: Long browse does not retain all historical rows
- **WHEN** thread timeline 包含数百条历史 rows
- **AND** 用户从尾部连续向上浏览多个窗口
- **THEN** DOM 中 `[data-timeline-row='true']` 的数量 MUST 保持在有界预算内
- **AND** 已离开 buffer 的尾部 rows MUST 不继续挂载在主 timeline DOM 中

#### Scenario: Prepending history preserves scroll anchor
- **WHEN** 用户滚到顶部附近触发更早 turns 分页
- **AND** 新 rows prepend 到当前 timeline 前方
- **THEN** viewport MUST 维持用户正在阅读内容的视觉锚点
- **AND** MUST 不因为 spacer 高度变化跳到最新消息或空白区域

#### Scenario: New live output respects user scroll position
- **WHEN** 用户不在 timeline 底部
- **AND** active turn 收到新的 live delta 或 activity event
- **THEN** viewport MUST 不强制滚到最新
- **AND** 跳到最新入口 MUST 仍能把用户带回尾部

### Requirement: Timeline updates are isolated from unrelated page state
会话聊天页 SHALL 将 timeline 高频更新与 header、composer、模型/权限选择器、context sheet、goal editor、rename dialog 和 action sheet 的状态隔离。timeline delta、pagination、repair 或 supplement merge MUST 只更新需要消费 timeline slice 的组件和必要状态。

#### Scenario: Delta does not reset composer state
- **WHEN** 用户正在输入文本、选择图片或选择 Skill
- **AND** timeline 收到高频 agent/tool/reasoning delta
- **THEN** composer 草稿、图片选择和 Skill 选择 MUST 保持不变
- **AND** composer MUST 不因每个 delta 被重新挂载

#### Scenario: Repair does not close unrelated sheets
- **WHEN** 用户打开模型、权限、context usage 或 goal 面板
- **AND** 当前 thread 完成一次 snapshot repair 或 pagination merge
- **THEN** 面板 MUST 保持打开
- **AND** 除非用户切换 thread，repair MUST 不重置该面板的本地交互状态

### Requirement: Mobile refresh recovers new thread detail
手机端刷新会话页时，系统 SHALL 对刚创建、尚未 materialized 或短暂未加载的 thread 提供可恢复读取路径。若 thread 已存在但 timeline 尚为空，页面 MUST 显示可交互的空会话，而不是直接进入不可用错误页。

#### Scenario: Refresh newly created empty thread
- **WHEN** 用户在手机端创建新会话并立即刷新 `/threads/{threadId}`
- **AND** app-server 首次读取该 thread 的 turns 时报告未 materialized、未加载或 first user message 前不可用
- **THEN** 页面 MUST 恢复为空 timeline 的会话详情
- **AND** 用户 MUST 能继续输入第一条消息

#### Scenario: Transient read failure retries before error
- **WHEN** 手机端刷新会话页时首次 `readThread` 遇到可恢复的 transient thread read 错误
- **THEN** 客户端 MUST 执行有限重试或 resume/read fallback
- **AND** 只有恢复失败后才显示错误页

#### Scenario: Existing cached timeline remains visible on read failure
- **WHEN** 刷新或修复读取失败
- **AND** 当前 store 已有该 thread 的 timeline entries
- **THEN** 页面 MUST 保留可见 timeline
- **AND** MUST 以非破坏方式展示读取失败反馈

### Requirement: Timeline virtualization uses final render blocks
会话聊天页 SHALL 在窗口切片前派生稳定的 final render blocks。连续 reasoning/tool/command/diff activity MUST 先合并为 inline activity block，再参与 spacer、测量和可见范围计算。

#### Scenario: Long consecutive activity run
- **WHEN** timeline 包含超过 80 个连续 activity entries 且它们渲染为少量 inline activity blocks
- **THEN** spacer height MUST 按最终 blocks 计算
- **AND** MUST NOT 按每个原始 activity entry 重复分配固定高度

#### Scenario: Activity group crosses old window boundary
- **WHEN** 连续 activity 的成员跨越旧 entry window 边界
- **THEN** 新窗口 MUST 保持一个稳定 activity block
- **AND** block MUST 不因滚动被拆成不同摘要或产生空白间隙

### Requirement: Dynamic height index maps scroll offsets to blocks
Timeline SHALL 使用 estimated/measured block heights 的累计索引和二分查找将 scroll offsets 映射到可见 block range。系统 MUST 不仅使用 `scrollTop / fixedRowHeight` 计算窗口。

#### Scenario: Hidden rows have highly variable heights
- **WHEN** 历史包含短消息、数千像素 Markdown、展开 activity 和图片高度混合
- **THEN** 任意 scrollTop 对应窗口 MUST 覆盖 viewport 附近真实 blocks
- **AND** viewport MUST 不只显示 spacer 空白

#### Scenario: Measured height changes
- **WHEN** Markdown、图片或展开详情使 block 高度发生变化
- **THEN** layout index MUST 更新该 block 高度
- **AND** 当前阅读 anchor MUST 保持在相同 block 的相近视觉位置

#### Scenario: Anchor block disappears
- **WHEN** activity regroup、authoritative replace 或删除使原 anchor block id 消失
- **THEN** 页面 MUST 依次尝试包含原 entry identity 的新 block、before anchor、after anchor 和相同累计 offset 附近真实 block
- **AND** 恢复后的 viewport MUST 包含真实 timeline block 或明确 loading marker，不得为空白

### Requirement: Historical scrolling never exposes virtualization blank space
长会话从尾部持续上滑到历史开头时 SHALL 始终渲染 viewport 附近的 timeline blocks 或明确 loading marker。由窗口估算造成的纯空白区域 MUST 不可见。

#### Scenario: Reproduce last-segment-only history
- **WHEN** thread 有大量历史 entries、连续 activity 和超长消息，初始只挂载尾部窗口
- **AND** 用户向上滑动多个 viewport
- **THEN** 更早的用户、agent 和 activity blocks MUST 逐步出现
- **AND** MUST 不出现只有空 spacer、历史内容不挂载的 viewport

#### Scenario: Mobile browser verification
- **WHEN** 在项目支持的手机 viewport 执行自动滚动验证
- **THEN** 每个采样 viewport MUST 包含非空 timeline row pixels 或 loading marker
- **AND** scrollTop MUST 能到达最早已加载 block

### Requirement: Prepend and relayout preserve block anchor
加载更早分页、detail continuation、full-content 展开或 row 重新测量时，会话页 SHALL 使用 block identity 和 intra-block offset 保持阅读 anchor。仅当用户处于贴底状态时才自动跟随尾部。

#### Scenario: Older page prepended
- **WHEN** 用户在顶部附近触发历史分页并 prepend blocks
- **THEN** prepend 前位于 viewport 顶部的 block MUST 保持可见
- **AND** scrollTop 修正 MUST 使用 block layout offset 而不是只比较总 scrollHeight

#### Scenario: Live delta while reading history
- **WHEN** 用户正在阅读历史且尾部收到 live delta 或 full-content 更新
- **THEN** 当前阅读 anchor MUST 不跳到尾部
- **AND** jump-to-latest 控件 MUST 继续可用

### Requirement: Virtualized timeline follows tail without blank windows
长 timeline 的自动贴底 SHALL 由虚拟化 Timeline 在尾部渲染窗口可用后完成。页面 MUST NOT 在虚拟窗口仍指向旧区间时先把滚动容器移动到底部。

#### Scenario: Sending from the bottom of a long thread
- **WHEN** 用户位于长会话 timeline 底部并发送新消息
- **THEN** optimistic user message MUST 立即出现在可见尾部窗口
- **AND** timeline MUST 保持至少一条可见消息
- **AND** 页面 MUST NOT 显示由旧虚拟窗口和新 scrollTop 组合产生的空白区域

#### Scenario: Stream error arrives after sending
- **WHEN** 用户发送消息后收到同一 turn 的 stream disconnected error
- **AND** 用户仍位于 timeline 底部
- **THEN** error entry MUST 出现在可见尾部
- **AND** 既有消息、Files changed 和 optimistic user message MUST 保持可见且顺序稳定

#### Scenario: User is reading history
- **WHEN** 用户不在 timeline 底部并发送前后的 live、repair 或 error 更新到达
- **THEN** Timeline MUST 保持当前阅读 anchor
- **AND** 页面 MUST 显示跳到最新入口
- **AND** 页面 MUST NOT 自动滚到底部或切换为尾部窗口

### Requirement: Historical messages display stable source time
历史分页消息 SHALL 使用消息或 turn 的稳定时间来源，并统一为 Unix 毫秒。客户端 MUST NOT 使用分页请求发生时间作为历史消息时间。

#### Scenario: Historical page lacks item timestamps
- **WHEN** 历史分页 item 没有 `createdAt`，但包含可解析的 UUIDv7 turnId
- **THEN** 客户端 SHALL 从 turnId 恢复 turn 时间
- **AND** 历史消息 MUST NOT 显示为本次请求产生的“刚刚”

#### Scenario: Snapshot fallback uses Unix seconds
- **WHEN** snapshot fallback 时间来自 Unix 秒形式的 thread 时间
- **THEN** 客户端 MUST 在写入 TimelineEntry 前转换为毫秒

### Requirement: Prepending history preserves visible reading progress
加载上一页后，加载前顶部可见消息 SHALL 保持相同 identity 和 viewport 像素偏移。新加载消息 MUST 只出现在当前内容上方，由用户继续上滑查看。

#### Scenario: User loads an older page at the top
- **WHEN** 用户滚动到顶部触发历史分页
- **AND** 新页面 prepend 到现有 timeline
- **THEN** 加载前顶部消息 MUST 保持在相同屏幕位置
- **AND** 页面 MUST NOT 自动替用户上移一页内容

#### Scenario: Prepended content changes height after commit
- **WHEN** prepend 的 Markdown、activity 或图片在初次 commit 后继续改变高度
- **THEN** Timeline SHALL 按原消息 identity 持续恢复锚点
- **AND** 可见文字 MUST NOT 因延迟测量发生跳页或抖动

### Requirement: Mutation responses preserve the progressive timeline window
会话发送、resume、rename、steer、interrupt、review、fork 和 unarchive 等 mutation SHALL 只更新操作结果或 thread metadata，MUST NOT 通过响应中的完整 timeline 扩展或替换当前分页窗口。rollback 如需刷新可见消息，MUST 返回受控最新页和 cursor。

#### Scenario: Send while thread is not loaded
- **WHEN** 用户在缓存消息可见但 thread 状态为 `notLoaded` 时发送消息
- **THEN** resume MUST 只 materialize 会话并返回 metadata 或显式有界页
- **AND** 页面 MUST 保留当前已加载分页窗口
- **AND** 页面 MUST NOT 使用 `response.thread.turns` replace 当前 timeline

#### Scenario: Mutation response contains unexpected turns
- **WHEN** 上游忽略 `excludeTurns` 或其他 metadata-only 参数并在 mutation 响应中返回完整 turns
- **THEN** Web 服务 MUST 在公开 API 边界丢弃这些 turns
- **AND** 浏览器响应 MUST NOT 包含完整 timeline

#### Scenario: Rollback refreshes a bounded latest page
- **WHEN** 用户执行 rollback 且成功删除尾部 turns
- **THEN** 页面 MUST 仅使用 rollback 返回的显式最新消息页重建窗口
- **AND** 该页 MUST 包含受控 cursor、条目上限和字节预算

### Requirement: Progressive loading fails closed
消息分页、resume 或 metadata 协议失败时，系统 SHALL 展示局部失败并保持已有分页窗口，MUST NOT 回退到完整 thread detail、metadata 中的 turns 或无 cursor 的历史数组。

#### Scenario: Latest page fails after metadata succeeds
- **WHEN** metadata 请求成功但最新消息页请求失败
- **THEN** 页面 MUST 保持已有消息窗口或显示局部重试状态
- **AND** 页面 MUST NOT 使用 detail timeline 作为消息 fallback

#### Scenario: Resume omits initial page
- **WHEN** `thread/resume` 响应缺少 `initialTurnsPage`
- **THEN** 系统 MUST 将其解释为没有可用消息页
- **AND** 系统 MUST NOT 使用 `response.thread.turns`

### Requirement: Latest legacy page fills across turns
legacy app-server 不支持 thread-wide items 接口时，服务端 SHALL 跨多个 turn 聚合最新 items，直到达到受控 page limit、字节预算或历史起点，MUST NOT 因最新 turn 只有一条消息而只返回一条可见内容。

#### Scenario: Latest turn contains one user item
- **WHEN** 最新 turn 只有一条 user item 且更早 turn 仍有内容
- **THEN** 首屏 MUST 同时包含该 user item 和更早 turn 的最近内容
- **AND** next cursor MUST 指向尚未返回的更早 item

#### Scenario: One turn exceeds page limit
- **WHEN** 单个 turn 的 items 超过 page limit
- **THEN** 服务端 MUST 只返回该 turn 最新的 limit 条 items
- **AND** 后续 cursor MUST 在同一 turn 内继续向前

### Requirement: Completed reply appears without refresh
用户发送消息后，最终 assistant/tool 输出 SHALL 通过 live event 或有界 repair 自动出现在当前页面，MUST NOT 要求用户刷新。

#### Scenario: Persistence lags turn completion
- **WHEN** turn 完成后的第一次 latest-page repair 只包含 user item
- **THEN** 客户端 MUST 延迟重试有界 latest-page repair
- **AND** assistant item 持久化后 MUST 自动合并到当前 timeline

