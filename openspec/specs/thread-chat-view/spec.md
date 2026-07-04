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
会话聊天页 SHALL 在首屏 snapshot 后使用 timeline event stream 更新 running thread。页面 MUST NOT 在事件流正常时以固定短间隔轮询 `/api/codex/threads/:threadId` 获取完整 timeline。

#### Scenario: Initial snapshot then event stream
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MAY 调用一次 `readThread` 获取初始 timeline
- **AND** running 状态下后续新增输出 MUST 通过 timeline event stream 更新

#### Scenario: No two-second full timeline polling
- **WHEN** thread 处于 running 状态且事件流连接正常
- **THEN** 页面 MUST NOT 每 2 秒或其他固定短周期调用 `/api/codex/threads/:threadId` 拉取完整 thread detail
- **AND** timeline 增量 MUST 由事件流驱动

#### Scenario: Repair read only after stream gap
- **WHEN** 事件流断线、重连补发失败或检测到事件缺口
- **THEN** 页面 MAY 调用 `readThread` 执行一次 snapshot repair
- **AND** repair 完成后 MUST 回到事件流主路径

### Requirement: Timeline preserves semantic order during live confirmation
会话聊天页 SHALL 在 live delta、server item completion 和 snapshot 混合到达时保持同一 turn 的语义顺序。user message MUST 显示在该 turn 的 agent、reasoning、tool 和 diff 输出之前。

#### Scenario: Agent delta arrives before server user item
- **WHEN** 前端已经显示本地 optimistic user message
- **AND** agent delta 先于 server user item 到达
- **AND** server user item 之后确认同一 turn 的 user message
- **THEN** user message MUST 保持在 agent 输出之前
- **AND** timeline MUST NOT 显示 agent 回复在用户消息上方

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
