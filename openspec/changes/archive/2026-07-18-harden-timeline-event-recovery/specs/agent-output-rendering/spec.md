## MODIFIED Requirements

### Requirement: Opening a running thread avoids duplicate immediate reads
打开会话页时，系统 SHALL 使用不含 turns 的 metadata 与一页 bounded latest items 建立首屏基线，并避免在首屏响应后立即发起重复 repair。running fallback SHALL 以 timeline event stream 为实时主路径；只有确认 gap、completion reconcile 或显式 missing-output recovery 才能读取 generation-scoped bounded latest page。系统 MUST NOT 通过 `readThread` 完整 timeline polling 作为 running fallback。

#### Scenario: running thread initial load
- **WHEN** 用户打开一个 status 为 active/running 的会话
- **THEN** 页面 MUST 发起 metadata 与一页 bounded latest items 读取
- **AND** MUST 在首屏响应刚应用后不再立即读取同一 latest page 或完整 timeline
- **AND** 后续可见输出 MUST 由 timeline event stream 驱动

#### Scenario: delayed fallback repair
- **WHEN** 会话仍处于 running 状态且事件流报告确认 gap 或当前 turn 在等待窗口内没有任何可见输出
- **THEN** 页面 MAY 为当前 HistoryStamp 和目标 turn 发起一次 bounded latest-page repair
- **AND** repair MUST 遵守 watermark、权威窗口和 live overlay 合并规则
- **AND** MUST NOT 降级为完整 `readThread` polling

### Requirement: Reasoning display is consistent across live and historical paths
Web timeline SHALL 在 normalized 状态中保留 app-server 已公开发送的 reasoning summary、content 和 delta，并在 live、completion、raw response 与 bounded page 之间按强 identity 收敛；展示层 MUST 与 Codex App/VS Code 一致，不渲染完成态 reasoning card。turn 运行且当前没有后续可见 activity 或 agent 输出时，页面 MAY 显示一个不可展开的临时 `Thinking...` 占位；同一 turn MUST 最多出现一个该占位。刷新、完成或重连后 MUST NOT 把历史 reasoning 恢复为多条 `Thinking` 行。

#### Scenario: Live reasoning survives completion in normalized state
- **WHEN** reasoning delta 已通过 event stream 进入 normalized timeline
- **AND** 后续收到相同强 identity 的 reasoning item completion
- **THEN** 系统 MUST 用完成项更新同一 logical reasoning entry
- **AND** MUST NOT 因完成项文本为空而清空已保存的 reasoning 文本
- **AND** 展示层 MUST 不渲染完成态 reasoning card

#### Scenario: Historical reasoning remains hidden after reload
- **WHEN** 用户刷新页面或重新进入会话
- **AND** bounded latest/history page 中存在 reasoning summary/content 或 raw response reasoning
- **THEN** normalized timeline MUST 保留 reasoning identity 与正文供恢复合并
- **AND** 前端 MUST NOT 为这些完成项生成历史 `Thinking` 行

#### Scenario: Running reasoning uses one transient placeholder
- **WHEN** 当前 turn 正在运行，最后一个可见阶段只有未完成 reasoning
- **THEN** 页面 MAY 显示一个 `Thinking...` 占位
- **AND** 新 tool、command、diff 或 agent output 到达后该占位 MUST 被活动摘要或正文取代
- **AND** MUST NOT 展示 reasoning summary 正文或累积多个占位

#### Scenario: Similar reasoning identities remain distinct in state
- **WHEN** 同一 turn 的两个 reasoning items 拥有不同稳定 itemId
- **AND** 两条文本相同或互为包含
- **THEN** normalized timeline MUST 保留两个独立 logical entries
- **AND** 展示层隐藏完成态 reasoning 时 MUST NOT 反向修改或合并底层 identity

### Requirement: 压缩上下文消息只能出现一次
上下文压缩、compact、summary 或类似系统消息 SHALL 使用包含 HistoryStamp、turnId 和稳定 compact operation identity 的强 identity 在 timeline 中归一化。若同一 logical compact message 同时来自 live event、snapshot、overlay 或 rollout supplement，系统 MUST 只渲染一次；supplement 只有携带相同强 identity 或显式唯一 alias 时才能合并，文本/摘要等价不能单独建立 compact identity。

#### Scenario: Live compact 后 snapshot 返回同一消息
- **WHEN** timeline 已显示一次上下文压缩消息
- **AND** 后续 snapshot 或 repair 返回同一 HistoryStamp、turn 和 operation identity 的 compact item
- **THEN** timeline MUST 原位确认或补全该消息
- **AND** MUST NOT 再追加第二条压缩消息

#### Scenario: Rollout supplement 重放压缩 activity
- **WHEN** rollout supplement 在当前窗口内发现携带相同强 identity 或唯一 alias 的 compact activity
- **THEN** supplement MUST 合并到同一 normalized entry
- **AND** 渲染层 MUST NOT 把它作为新的独立 system/activity 行显示

#### Scenario: Similar compact summaries from distinct operations remain visible
- **WHEN** 同一 turn 或不同 generation 存在两个不同 compact operation identities
- **AND** 二者 summary 文本相同
- **THEN** timeline MUST 按各自 identity 保留合法 entries
- **AND** MUST NOT 仅按 summary 文本去重

### Requirement: Reasoning remains stable across live, completion and repair
reasoning 输出 SHALL 在 live delta、reasoning started、item completion、raw response completion 和 snapshot repair 之间使用稳定 logical item identity 合并。完成项文本为空时 MUST NOT 清空已保存的 reasoning 文本；repair 后旧 reasoning delta MUST NOT 重复追加。缺少正文但携带有效 `contentRef` 的 reasoning 仍是可恢复的 logical item，turn finalize MUST NOT 从 normalized 状态删除；展示层 MAY 按完成态 reasoning 隐藏规则不为其生成 render block。

#### Scenario: Empty reasoning completion preserves live text
- **WHEN** reasoning delta 已显示文本
- **AND** 后续 completion item 的 reasoning 文本为空
- **THEN** timeline MUST 保留已显示 reasoning 文本
- **AND** normalized entry MAY 标记为完成，且展示层 MUST 隐藏该完成项

#### Scenario: Historical repair keeps reasoning once
- **WHEN** snapshot repair 返回已完成 reasoning item
- **AND** 旧 generation 的 reasoning delta 后到
- **THEN** 前端 MUST 忽略旧 delta
- **AND** normalized timeline MUST 只保留一个对应 logical reasoning entry

#### Scenario: Empty truncated reasoning remains expandable
- **WHEN** reasoning item 的 inline 文本为空但 completeness 为 truncated 且携带有效 contentRef
- **AND** turn 随后完成或 snapshot repair 到达
- **THEN** normalized timeline MUST 保留 reasoning identity、contentRef 与未完整状态
- **AND** 完成态展示隐藏不得删除该 continuation

### Requirement: Agent output cards are deduplicated within a turn
agent message、reasoning logical entry 和 tool activity SHALL 在同一 turn 内按稳定 logical item identity 去重。来自 live、completed、snapshot、overlay 或 supplement 的记录只有在拥有相同强 identity，或携带可唯一证明同一 logical item 的显式 alias/source slot 时才能合并。系统 MUST NOT 仅依据文本相同、文本包含、工具 metadata、文件路径或数组位置建立 identity；不同稳定 itemId 的输出即使内容等价也 MUST 保留为独立 normalized entry。完成态 reasoning 的展示隐藏规则不等同于数据去重。

#### Scenario: Duplicate reasoning sources share one identity
- **WHEN** 同一 turn 的 reasoning 通过 live delta 和 completed item 到达
- **AND** 两条记录拥有相同 generation、turnId 和 itemId
- **THEN** normalized timeline MUST 只保留一个 reasoning logical entry
- **AND** 该 entry MUST 使用更完整的文本和完成状态，展示层不渲染完成态 card

#### Scenario: Similar reasoning items remain distinct
- **WHEN** 同一 turn 包含两个不同稳定 itemId 的 reasoning entries
- **AND** 两条 entries 的文本相同或一条文本包含另一条
- **THEN** normalized timeline MUST 保留两个独立 reasoning entries
- **AND** MUST NOT 让后一条占用前一条的事件位置

#### Scenario: Identical agent reply in different turns
- **WHEN** 两个不同 turn 都回复 `1 + 1 = 2`
- **THEN** timeline MUST 保留两条 agent message
- **AND** MUST NOT 因文本相同跨 turn 去重

#### Scenario: Tool output duplicate in same logical item
- **WHEN** 同一 tool call 的 output 通过 live overlay 和 snapshot 同时出现
- **AND** 两个来源拥有相同强 identity 或显式唯一 alias
- **THEN** timeline MUST 只显示一张 tool card
- **AND** card MUST 原位使用更完整状态与输出

#### Scenario: Repeated identical tool executions remain visible
- **WHEN** 同一 turn 合法执行两次 metadata 和 output 都相同的 tool call
- **AND** 两次执行拥有不同稳定 itemId
- **THEN** timeline MUST 保留两个 tool activities
- **AND** supplement 去重 MUST 对候选执行一对一消费

### Requirement: 等价 agent 输出只能渲染一次
agent 输出渲染层 SHALL 以 timeline engine 提供的 normalized entry 为唯一渲染输入。来自 live delta、completed item、snapshot item、overlay 和 rollout supplement 的同一 logical agent/reasoning/tool/diff 输出 MUST 合并为同一个可见条目，MUST NOT 因来源不同、文本格式不同或完成态不同而重复渲染。logical equivalence MUST 由强 identity 或显式唯一 alias 建立；渲染层和 adapter MUST NOT 用内容相似度合并不同稳定 identity。

#### Scenario: Live 与 completed agent message 合并
- **WHEN** 同一 generation、turnId 和 itemId 的 agent message 先通过 live delta 显示
- **AND** 后续 snapshot 或 completed item 返回完整文本
- **THEN** 渲染层 MUST 原位更新同一条 agent message
- **AND** timeline MUST NOT 同时显示 live 版本和 completed 版本

#### Scenario: Tool output 多来源补齐
- **WHEN** 同一 tool call 的输出同时来自 command delta、turn item detail 和 rollout supplement
- **AND** 来源携带相同强 identity 或可唯一验证的 alias
- **THEN** 渲染层 MUST 只显示一个 tool activity
- **AND** 该 activity MUST 保留最完整的状态、输出和元数据

#### Scenario: Snapshot refresh 不重复旧输出
- **WHEN** 用户刷新页面或 snapshot repair 返回已通过 event stream 显示过的 agent/reasoning/tool/diff 输出
- **THEN** 渲染结果 MUST 保持每个稳定身份只出现一次
- **AND** 已展开或折叠状态 MAY 保留，但重复条目 MUST NOT 出现

#### Scenario: Similar messages with different identities are not equivalent
- **WHEN** 同一 turn 的两个 agent messages 拥有不同稳定 itemId
- **AND** 一条文本与另一条相同或为其前缀
- **THEN** timeline MUST 渲染两条独立消息
- **AND** MUST NOT 使用文本 fallback 将它们归一化为同一 entry

### Requirement: Inline activity 分组必须保持服务端 item 顺序
内联 activity 日志 SHALL 按 timeline engine 的 orderKey 派生。同一 turn 内连续 reasoning、tool、command、runtime loading 和 diff MUST 合并为一个顶层 disclosure，完成态 reasoning 不进入可见摘要；disclosure 默认折叠，用户点击后才显示明细。展开内容 MUST 保留服务端 item order、event sequence 或等价 source order，MUST NOT 为了按类型聚合而改变同一 turn 内真实顺序。repair 使用 before/after anchor 时，anchor MUST 按完整 history generation、turn 和 item identity 解析并优先于 source-local ordinal；不同来源的 ordinal MUST NOT 撤销已确认的 anchor 位置。

#### Scenario: Reasoning 与 tool 交错
- **WHEN** 同一 turn 内服务端顺序为 reasoning、tool、agent delta、tool、agent delta
- **THEN** completed reasoning MUST 不生成独立 `Thinking` 行，每段连续 activity MUST 只生成一个折叠摘要
- **AND** 展开摘要后两个 tool 与两段 agent 文本的相对位置 MUST 与服务端一致

#### Scenario: 多个文件 diff 与命令活动
- **WHEN** 同一 turn 内先执行命令再产生文件 diff
- **THEN** inline activity 分组 MUST 保留命令在 diff 之前的顺序
- **AND** 多文件 diff MAY 汇总，但不能越过更早的可见活动

#### Scenario: Dense tool activity remains one compact row
- **WHEN** 同一连续 activity 段包含多个 command、read、Skill、Subagent、file 和 MCP tool entries
- **THEN** 折叠态 MUST 只占一个顶层 activity 行，并使用自然动作句概括主要活动
- **AND** 顶层 MUST 显示一个与主要动作类别对应的紧凑 Lucide 语义图标；多类别混合时使用通用工具图标
- **AND** 顶层 MUST NOT 显示无意义装饰方块或“N 个文件”式生硬统计串
- **AND** 用户第一次展开后 MUST 按原顺序看到全部动作行，默认页面 MUST NOT 被每个分类各占一行

#### Scenario: Activity details require a second explicit expansion
- **WHEN** 用户第一次展开包含 read、file edit、command 和 failed tool 的 activity 段
- **THEN** 页面 MUST 只显示“已读取具体路径”“已编辑具体路径 +A -R”“已运行具体命令”等动作行
- **AND** stdout、diff、参数与错误正文 MUST 保持隐藏
- **AND** 用户再次点击某一动作行后，页面 MUST 只展开该动作的具体内容

#### Scenario: Repair anchor overrides source-local ordinal
- **WHEN** repair item 的 before/after anchor 将其定位在同 turn 两条 agent messages 之间
- **AND** repair source 的局部 ordinal 数值会把它排到两条消息之后
- **THEN** timeline MUST 保留 anchor 指定的位置
- **AND** MUST NOT 使用裸 itemId 命中另一 turn 或 generation 的 anchor

### Requirement: Truncated agent output is visibly incomplete
agent message、tool output、command output 和 diff 的正文不完整时，渲染层 SHALL 显示明确的 truncated/partial 状态和读取完整内容控件。系统 MUST 不以普通 `...` 文本冒充完整正文。inline preview 为空但存在有效 contentRef 时，card/block MUST 仍保持稳定尺寸和可恢复入口，MUST NOT 被当作无内容 entry 隐藏。reasoning 的 completeness/contentRef MUST 保留在 normalized 状态，但完成态 reasoning MAY 按展示规则隐藏。

#### Scenario: Truncated tool preview
- **WHEN** tool output 仅包含 inline preview 和 contentRef
- **THEN** activity detail MUST 显示已省略 bytes/内容状态
- **AND** MUST 提供读取完整内容的明确命令

#### Scenario: Complete content loaded
- **WHEN** 用户读取全部 full-content chunks
- **THEN** 原 card/block MUST 原位显示完整内容
- **AND** 展开状态、复制入口和 timeline 顺序 MUST 保持不变

#### Scenario: Empty preview still exposes continuation
- **WHEN** agent output 的 inline preview 为空但 contentRef 有效
- **THEN** 原 card/block MUST 显示 truncated 或 partial 状态
- **AND** MUST 提供读取完整内容入口且不得在 turn finalize 后消失

## ADDED Requirements

### Requirement: Activity summaries classify Skills and Subagents explicitly
展示派生层 SHALL 优先使用结构化 metadata 分类 activity，并兼容当前 app-server 已归一化的 tool 形态。读取完整 `.../skills/<name>/SKILL.md` 定义文件的 read/command SHALL 归类为 Skill；`server: sub-agent` 且 result 可解析出 `agentThreadId`、`agentPath` 或 `kind` 的记录 SHALL 归类为 Subagent。无法满足完整判定条件的记录 MUST 降级为 command 或通用 tool，MUST NOT 仅按任意正文关键词误分类。

#### Scenario: Skill definition read is classified as a loaded Skill
- **WHEN** command/read activity 的目标是完整 `SKILL.md` 定义路径
- **THEN** 折叠摘要 MUST 计入一个 Skill
- **AND** 展开行 MUST 显示从路径解析出的 Skill 名称，而不是普通“读取文件”

#### Scenario: Subagent interactions collapse by agent identity
- **WHEN** 同一 activity 段包含针对相同 `agentThreadId` 的多次 Subagent 交互
- **THEN** 摘要 MUST 按唯一 Subagent 数量计数
- **AND** 展开内容 MUST 使用 `agentPath` 或稳定 fallback label 描述该代理，不得显示为未知通用工具

#### Scenario: Malformed structured result stays generic
- **WHEN** tool result 不是合法 JSON，或没有完整 Skill/Subagent 身份字段
- **THEN** 展示层 MUST 将其保守归类为 command 或通用 tool
- **AND** MUST NOT 抛错、吞掉 activity 或改变底层 entry

### Requirement: User messages hide trusted injected context
Web SHALL 从 app-server user item 中识别 Codex 明确注入的完整包装，并只显示其中的用户数据。已知 ambient/附件包装只有同时满足 `<in-app-browser-context source="ambient-ui-state">...</in-app-browser-context>` 或 `# Files mentioned by the user:` 包装，以及 `## My request for Codex:` 边界时，系统 MAY 提取 request 段；完整 `<codex_internal_context source="goal">...</codex_internal_context>` 包装只有包含唯一完整 `<objective>...</objective>` 时，系统 MAY 提取 objective。图片、Skill 引用、`clientUserMessageId`、turn/item identity 和发送状态 MUST 保留。普通 XML、Markdown、代码块、不完整标签和用户主动输入的相似文本 MUST 原样显示。

#### Scenario: Ambient browser context is hidden
- **WHEN** server user text 包含完整 ambient browser context 和 `## My request for Codex:`
- **THEN** user bubble 与复制文本 MUST 只包含 marker 后的真实请求
- **AND** MUST 不显示注入说明、当前 URL 或包装标签

#### Scenario: Attachment metadata wrapper is hidden but image remains
- **WHEN** server user text 同时包含 `# Files mentioned by the user:`、ambient context、request marker 和 imagePaths
- **THEN** user bubble MUST 只显示真实请求并继续渲染图片附件
- **AND** MUST 不把临时文件路径作为用户正文显示

#### Scenario: Goal continuation displays its objective
- **WHEN** server user text 完整匹配 `source="goal"` 的 internal context，且只包含一个完整 objective
- **THEN** user bubble 与复制文本 MUST 显示 objective 正文
- **AND** MUST 不显示 continuation、budget、fidelity 或 completion audit 等内置提示，也不得渲染为空白 user row

#### Scenario: User-authored objective markup is preserved
- **WHEN** 用户主动输入普通 `<objective>`，或 goal internal context 缺少可信 source、完整外层边界或唯一 objective
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 猜测或提取局部 objective

#### Scenario: User-authored markup is preserved
- **WHEN** 用户正文包含普通 XML/Markdown，或只有相似 marker 但不构成完整已知包装
- **THEN** Web MUST 原样显示与复制该文本
- **AND** MUST NOT 使用宽泛正则删除用户内容

### Requirement: Timeline omits per-entry timestamps
会话 timeline SHALL 不渲染 user、assistant、system 或 activity 的逐条相对时间。`createdAt` MAY 继续用于排序、虚拟列表锚点和诊断，但 MUST NOT 在默认或展开视图占据可见行。

#### Scenario: Messages and activities have real timestamps
- **WHEN** normalized entries 携带有效 `createdAt`
- **THEN** user/assistant 消息与折叠 activity 均 MUST 不显示“刚刚”“N 分钟前”“N 小时前”等时间文本
- **AND** 移除时间不得改变 entry 排序或展开行为

### Requirement: User messages use compact Codex App-style bubbles
会话 user message SHALL 显示为右对齐、内容宽度自适应的浅灰气泡，文字在气泡内保持左对齐。气泡 MUST NOT 占据整行或显示旧的蓝色左边条；长消息、长单词、图片、Skill 引用和失败/重试状态 MUST 保持在同一气泡边界内，并在 390px 手机视口不水平溢出。

#### Scenario: Short user message remains compact
- **WHEN** user message 只有一行短文本
- **THEN** 气泡 MUST 右对齐且只占内容所需宽度
- **AND** MUST 使用浅灰背景、紧凑内边距和圆角，不显示蓝色左边条

#### Scenario: Long user message remains mobile-readable
- **WHEN** user message 包含多行长文本或无空格长字符串
- **THEN** 气泡 MUST 受最大宽度约束并在内部换行
- **AND** timeline MUST 不产生水平页面滚动

### Requirement: Reconnection uses a lightweight activity row
Web SHALL 将 event stream 重连状态显示为低噪声的临时活动行，而不是全宽警告色横幅。该行 MUST 使用 Wi-Fi 语义图标和 `正在重新连接 N/5` 文案；`N` MUST 来自连续失败尝试计数，连接成功或显式关闭后归零。thread 页面 MUST 将该行放在 timeline 末尾并随内容滚动，连接恢复后 MUST 立即移除。

#### Scenario: Reconnection attempts update in place
- **WHEN** event stream 连续发生第一次和第二次连接错误
- **THEN** 同一重连行 MUST 依次显示 `正在重新连接 1/5` 与 `正在重新连接 2/5`
- **AND** MUST 不追加重复行或显示动画省略号

#### Scenario: Successful connection removes the row
- **WHEN** reconnecting event stream 随后触发 open
- **THEN** 重连计数 MUST 归零且 thread timeline MUST 移除临时行
- **AND** 页面 MUST 不保留全宽警告色 banner

### Requirement: Activity stdout and diff details are mobile-readable
二级 activity detail SHALL 使用安静、工作导向的移动端布局。command/stdout MUST 显示截断后的命令头、运行状态、等宽输出、复制入口和有界滚动区域；file diff MUST 显示文件路径、增删统计、old/new 行号、hunk 与 add/remove/context 语义着色。详情 MUST NOT 使用 emoji、无意义装饰图标、嵌套卡片或会撑破 timeline 的固定桌面宽度。

#### Scenario: Command row opens stdout detail
- **WHEN** 用户点击“已运行 npm test”动作行
- **THEN** 页面 MUST 在该行下显示命令状态与 stdout/stderr 预览
- **AND** 长行 MAY 在详情内部横向滚动，但 MUST NOT 让页面产生水平溢出

#### Scenario: File row opens structured diff detail
- **WHEN** 用户点击“已编辑 Timeline.tsx +81 -72”动作行
- **THEN** 页面 MUST 在该行下显示带双行号、hunk 和增删着色的 diff
- **AND** 第一次只展开 activity 总组时 MUST NOT 提前挂载 diff 正文

### Requirement: Context compaction lifecycle is visible while running
Web SHALL 映射 app-server `contextCompaction` item 的开始与完成生命周期。`item/started` 到达后 MUST 立即显示“正在自动压缩上下文”，`item/completed` 到达后 MUST 使用同一稳定 item identity 原位更新为“压缩上下文已完成”。完成态 snapshot、repair 或 rollout item MUST NOT 倒退为运行态，也 MUST NOT 因 live 与 snapshot 来源不同显示重复压缩消息。

#### Scenario: Automatic compaction is visible before completion
- **WHEN** active turn 收到 `item/started` 且 item type 为 `contextCompaction`
- **THEN** timeline MUST 在完成通知前显示“正在自动压缩上下文”
- **AND** 该状态 MUST 不停止 active turn 或触发 snapshot repair

#### Scenario: Compaction completion updates in place
- **WHEN** 同一 context compaction item 随后收到 `item/completed`
- **THEN** 运行文案 MUST 原位更新为“压缩上下文已完成”
- **AND** timeline MUST 只保留一个该 identity 的压缩条目

#### Scenario: Completed history does not regress
- **WHEN** 刷新或 repair 返回已完成的 context compaction item
- **THEN** timeline MUST 直接显示完成文案
- **AND** 较晚到达的旧 started 事件 MUST NOT 将它降级为运行中

### Requirement: Failed image previews degrade without broken-image chrome
会话 user/tool 图片缩略图 SHALL 通过受控 preview URL 加载。加载失败时 Web MUST 隐藏浏览器原生破图图标，显示尺寸稳定的中文失败占位与重试入口；成功加载后 MUST 显示真实图片。失败状态 MUST 不改变 timeline 宽度、消息正文或附件 identity。

#### Scenario: Local preview route fails
- **WHEN** 图片 preview route 返回错误或浏览器触发 image error
- **THEN** 原缩略图位置 MUST 显示紧凑失败占位而不是破图图标
- **AND** 用户 MUST 可以重试加载

### Requirement: Collapsed timelines continue loading older history
会话页面 SHALL 在 timeline 内容高度不足滚动视口、仍存在历史 cursor 且未到会话开头时自动请求上一页。该行为 MUST 与滚到顶部使用同一分页协调入口，并继续遵守 cursor in-flight 去重、HistoryStamp 校验和 prepend anchor 规则。系统 MUST 逐页补充直到内容可滚动、cursor 为空、到达开头或请求失败，MUST NOT 因折叠/展开反复请求同一 cursor。

#### Scenario: Collapsing activity removes all scroll distance
- **WHEN** 用户折叠活动详情后 scroller 的 `scrollHeight` 不大于 `clientHeight`
- **AND** 当前 thread 仍有有效历史 cursor 且 `reachedBeginning` 为 false
- **THEN** Web MUST 无需用户滚动就请求上一页历史
- **AND** 新页面提交后若仍不足一屏，Web MUST 使用新 cursor 继续有界补页

#### Scenario: Underfilled history has already reached the beginning
- **WHEN** timeline 不足一屏但 cursor 为空或 `reachedBeginning` 为 true
- **THEN** Web MUST 不再发送历史分页请求
