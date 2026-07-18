## Context

当前可见 timeline 由 app-server notification、gateway backlog、SSE client、HTTP metadata/latest-page/history-page、runtime overlay、rollout supplement 和 optimistic user item 共同构成。代码已经有 generation、revision、event ledger、delivery epoch、snapshot suppression、contentRef 和统一 timeline engine，但这些字段的作用域并不一致：服务端 `sequence` 是进程级全局计数，客户端却把它当作单 item fragment 序号；HTTP page 没有证明所属 history generation；repair merge 也无法声明自己替换哪段未知尾部。

结果是每层单独看来都有去重或恢复保护，跨层组合后仍会删除新消息、接受旧正文、丢 fragment 或保留 stale tail。本设计把事件传输顺序、历史身份、恢复窗口和 item 内容完整性拆成四个正交契约，并让所有输入只通过 timeline engine 提交可见状态。

约束如下：

- 不能恢复全量 thread detail 读取或高频 polling；repair 必须继续使用 metadata 和有界 page。
- 移动端可能长时间后台、断网和重连，服务端也可能在客户端存活期间重启。
- 需要兼容 rollout、旧 app-server notification 和暂时缺少稳定 itemId 的 legacy 数据，但兼容路径必须失败关闭，不能静默吞内容。
- 不新增外部依赖，不改变 workspace roots、鉴权、审计和 contentRef 安全边界。

## Goals / Non-Goals

**Goals:**

- 让交错 item 的实时 fragment 按各自顺序完整到达，并让 Last-Event-ID 只承担全局重放 cursor 职责。
- 让任何 snapshot/page/event 都能证明所属服务启动 epoch 和 thread history generation，旧异步响应无法提交到新历史。
- 让 gap repair 精确替换声明的未知最新尾部，同时保留已加载旧页、同 generation 的确认内容和 optimistic user identity。
- 让稳定 identity 优先于文本、metadata 相似度和局部 ordinal；不同强 identity 永不因内容相似被合并。
- 让正文、completeness 和 continuation 单调收敛，所有可见 kind 使用同一选择规则。
- 让模糊 `turn/start` 失败可安全重试且不会创建第二个 turn。
- 通过跨层时序 fixture 验证服务端发出的字段与客户端 reducer 的解释完全一致。

**Non-Goals:**

- 不在本变更中实现持久化跨进程 event backlog；服务重启通过 boot epoch 和 scoped repair 恢复。
- 不重新设计 timeline UI、虚拟列表或卡片视觉样式。
- 不恢复完整 timeline API，不移除现有有界分页预算。
- 不处理尚未稳定复现的通用 SSE 慢消费者背压；只保证 listener 异常隔离和已确认的缓冲顺序/溢出语义。
- 不用文本语义模型推断两个 legacy item 是否相同；歧义时保留两项或请求有界 repair。

## Decisions

### 1. 分离传输 cursor 与 fragment sequence

gateway 在每次进程启动时生成随机 `bootId`，每个浏览器事件携带 `{bootId, streamSequence}`，`eventId` 由二者及 thread scope 构成。`streamSequence` 只用于 backlog 定位和原始事件总顺序，不参与某个 item 的 `+1` 连续性判断。

可追加正文另带 `fragmentSequence`，其计数器按 `{threadId, generation, turnId, itemId, field}` 隔离。若上游无法提供或 gateway 无法可靠合成该序号，则字段缺省；客户端仍按 eventId/revision 幂等追加，但不得使用文本前缀猜测 replay 或 tail。遇到已声明的 fragment gap 才拒绝 fragment 并发起 scoped repair。

选择两个字段而不是改变现有 `sequence` 的隐含含义，是为了让类型、测试和日志能直接暴露坐标系混用。兼容期读取旧 `sequence` 时只把它当 `streamSequence`，不执行 per-item 连续检查。

### 2. 使用 HistoryStamp 统一历史身份

定义共享的 `HistoryStamp = { bootId, generation }`。可见 event、metadata、latest page、history page、overlay 和 repair signal 都携带 stamp；分页 cursor 在服务端绑定 stamp，客户端请求协调 key 也包含 stamp。

客户端只接受与当前 stamp 相同的增量。generation 增加时立即建立 delivery barrier，清除旧 generation 的 suppression/revision/pending fragment 状态；bootId 改变时，客户端把现有窗口标为需要 scoped repair，使用新 boot 的权威 metadata/latest page 建立新基线，而不是通过 `Math.max` 永久拒绝 generation 归零。

HistoryStamp transition 使用显式 rebase，而不是让新旧 stamp 的 entries 长期共存：

- 同 boot 的 generation bump 必须由 repair page 返回 `preservedThrough` anchor。engine 原子地把已证明未变化的 prefix entries 迁移到新 stamp，替换 anchor 之后的权威窗口，并丢弃旧 stamp 的 ledger、pending fragment 和未知 tail。
- boot 改变时，旧窗口先进入 frozen 状态，不再接受增量。新 latest page 必须提供能在旧窗口中唯一命中的 common-prefix anchor；命中后原位迁移该 prefix、替换最新窗口并从新 cursor 继续分页。若无法证明 common prefix，客户端必须清空旧缓存窗口并从新基线重建，不能靠 turn 数、文本或裸 itemId 拼接两个 boot。
- 只有成功迁移的 normalized entries 会换用新 stamp；旧 ledger、suppression、cursor 和 synthetic alias 永不迁移。这样既避免重复，也让服务重启后的 generation 归零可恢复。

选择复合 stamp 而不是把 generation 改成全局持久化值，可避免引入数据库迁移，同时明确服务重启是一个新的权威域。

### 3. RepairPage 显式声明权威替换窗口

latest-page builder 先完成上游 bounded page 读取，再在 gateway 单一同步临界区内原子捕获 `{pageWatermark, overlaySnapshot}`：watermark 是该时刻 gateway 已处理的最大 `streamSequence`，overlaySnapshot 是所有 `streamSequence <= pageWatermark` 的当前聚合副本。同步 clone 期间不得交付新的 gateway event；随后将上游 page 与该 clone 合并，并返回 `HistoryStamp`、`windowStartAnchor`（inclusive）、`windowEndAnchor`（inclusive/head）、`preservedThrough`、pageWatermark、`nextCursor` 和 completeness。上游 page 可能已经包含尚未通知 gateway 的 item；该 item照常进入权威 page，后到的 watermark 之后事件按强 identity 原位合并。

每个 normalized entry 记录统一 `coverageFence`：live entry 使用 `lastAppliedStreamSequence`，snapshot/repair/supplement entry 使用产生它的 `baselineWatermark`，optimistic/local entry 使用 `clientMutationEpoch` 与 unresolved operation identity。gap repair 以 `replace-latest-window` 输入进入 engine：

- 只删除当前 stamp 下、orderKey 位于闭区间 `[windowStartAnchor, windowEndAnchor]` 且无法由权威 page/overlay 确认的 entry，并且其 stream/baseline coverageFence 不大于 pageWatermark；
- 当前 stamp 下没有 fence 的 legacy snapshot/local placeholder 在该权威窗口内按 pre-baseline 处理，可以删除；只有 unresolved optimistic operation 或明确的 post-request client mutation 能保护无 stream fence 的 local entry；
- `lastAppliedStreamSequence > pageWatermark` 的后到 live entry 必须保留，并在权威页面提交后按 identity/anchor 重新插入；
- 保留窗口之前已经加载的 history pages；
- 保留不属于该窗口的 optimistic user item，但在服务端确认或明确拒绝后再归一化；
- 使用强 identity 原位完成窗口内已有 entry，并更新 cursor；`nextCursor: null` 必须清除旧 cursor。

旧 history pages 与新 repair cursor 通过 `preservedThrough/windowStartAnchor` 桥接：anchor 必须唯一命中已加载边界；新 cursor 即使再次返回部分旧页也由强 identity 去重。边界缺失、不唯一、stamp 不匹配或 watermark 回退时，engine 拒绝 replace 并保留 repair pending。

普通 refresh 或 detail supplement 仍使用 upsert/merge，不能冒充权威尾部替换。这样同时解决“merge 留下 stale tail”和“全窗口 replace 删除历史/live”的冲突。

### 4. 请求生命周期绑定恢复身份

request coordinator 的 repair key 使用 `{threadId, HistoryStamp, reason, turnId?, itemId?}`，每个响应提交前再次验证页面 mutation epoch 与 HistoryStamp。新 generation 的信号不得复用旧 Promise；旧请求的 finally 只能清理自己持有的 repair token。

completion repair 的 retry token保存原 turn、generation、reason 和 attempt。瞬时失败只增加 attempt，不降级成无 turn 的通用 retry；只有目标 turn 已出现非 user 可见输出或达到上限时结束生命周期。history page 也捕获 stamp，旧 cursor 响应在 rollback/repair 后直接丢弃。

### 5. Timeline engine 只按强 identity 合并

强 identity 为 `{HistoryStamp, turnId, itemId}`；optimistic user 额外以 `clientUserMessageId` 确认。两个强 identity 不同的 entry 必须独立，即使文本、工具 metadata、路径或输出完全相同。

缺少 itemId 的 live 输入获得 canonical source locator：事件来源使用 `{bootId,eventId,field}`，response/rollout 来源使用 `{sourceKind,responseId/recordId,absoluteOutputIndex}`。只有跨 replay、分页和 refresh 稳定的 absolute locator 才能生成可合并 synthetic identity；页内 ordinal、数组当前位置或文本 hash 不能作为 locator。无法取得 absolute locator 时分配仅本次显示有效的唯一 identity，并请求 bounded repair，禁止推断 alias。

completed item 只有携带显式 `syntheticAlias` 或能与唯一 canonical locator/anchor 对应时才替换 synthetic entry；多个候选或无证据时保留独立项并请求 repair。source anchor 使用完整强 identity 解析，优先于任何 source-local ordinal。

rollout supplement 去重采用一对一消费：每个 native item 最多匹配一个 supplement record，匹配后从候选集合移除。文本相同只可作为已有强身份/alias 下选择更完整正文的依据，不能建立 identity。

### 6. 正文与 completeness 使用统一单调合并

engine 为每个 kind 提取标准 `ContentCandidate`，包含正文、completeness、includedBytes、contentRef、revision 和 authority。先选择内容候选，再从同一候选或兼容 continuation 合并状态，禁止分别选择后产生 `complete + preview`。

候选比较统一使用 `(integrity, includedBytes, authority, revision)`：经验证 complete 的 integrity 最高；prefix-compatible partial/live 次之；truncated preview 最低。在正文兼容的前提下先选更高 integrity、再选覆盖 bytes 更多的候选，authority 与 revision 只作为同覆盖范围的 tie-breaker。相同 logical identity 的两个非前缀 complete 正文、相同 revision 的不同正文，或高 revision 但覆盖范围倒退且无 continuation 时都不是可排序候选，engine 必须保留当前可见正文并标记 `repair-required`。

生命周期状态与内容完整性分离。允许空正文的白名单仅包括 tool/command/file 的 status-only completion 和无正文的 runtime/system activity；它们只能更新 status/metadata，不能清空已有正文。agent、user、reasoning、diff 和 error 的空 completion 永远不是正文 complete 证据。任何 kind 当前存在 contentRef 时，空 completion 必须保留 preview、continuation 和非完整状态。带 contentRef 的空 reasoning 是可见、可恢复的 entry，turn finalize 不得删除。

turn-detail 后页失败时返回已成功页面与 partial/repair-required；跨页重复 identity 按 revision、authority 和 completeness 合并，不能 first-wins。

### 7. 协议 adapter 保留字节流和来源身份

adapter 支持当前 `item/fileChange/patchUpdated`，旧 `outputDelta` 仅作为兼容输入。无 ID response item 的 synthetic ID 使用 canonical source locator，不能只由 type、turn 或页内 source ordinal 组成。

command/process base64 bytes 由按 item 隔离的流式 `TextDecoder` 处理，直到 completion 才 flush；`capReached` 转换为 truncated completeness 和 continuation/repair-required，而不是丢弃。oversize reference 对所有可见 kind 保留 HistoryStamp、identity、sourceOrder、originalBytes 和 contentRef。

### 8. 模糊 turn/start 失败延续原发送动作

前端失败 user entry 保存 `clientUserMessageId`、payload fingerprint、发起时 `bootId` 和 outcome 类型。网络中断、超时或 5xx 等“结果未知”失败的 retry 复用原 ID；同一 boot 内服务端幂等记录至少保留到 turn 终态加客户端重试窗口，并返回已创建 turn 或继续同一幂等操作。只有明确的验证拒绝、确认未创建 turn，或用户编辑内容开始新动作时生成新 ID。

boot 变化后不能依赖进程内幂等缓存。服务端只有在 app-server 能按 client id 查询并确认既有 turn，或 bounded latest-page 能唯一确认该 user action 时才能返回/恢复 turn；否则必须返回显式 `ambiguous-start-unresolved`，不得再次调用 app-server `turn/start`。用户可以先刷新恢复状态，或明确将原内容作为新的发送动作提交。该失败关闭策略在没有持久化 idempotency store 的前提下仍保证自动路径 at-most-once。

### 9. Listener 恢复使用单一有序 delivery queue

event client 不再分别先 flush `pendingDeltaBatches`、再 flush `pendingEvents`。所有尚未交付的 event/batch envelope 进入同一个按 `{bootId, streamSequence}` 排序的 thread-aware delivery queue；batch 只决定一次 store commit 的边界，不改变队列位置。

listener 注册时进入 draining 状态，先交付注册前的全部 pending envelopes。drain 期间到达的新事件继续排在队尾，直到旧队列完成后才能交付；跨 boot 或检测到 gap 时先建立对应 thread barrier，再丢弃/repair 无法排序的旧 envelope。这样可保证早已 timer-flush 的 A 不会被仍在 batch 中的 B 越过。

### 10. Backlog 使用 owner ledger，无法归属时升级为 all-tracked barrier

gateway 除 payload backlog 外维护更轻量的 per-sequence owner ledger，记录 `{bootId,streamSequence,threadId?,visible}`，保留范围至少覆盖 payload replay horizon；压缩时可按连续 sequence range 聚合 thread owner set。cursor 已离开 payload backlog但仍在 owner ledger 时，服务端从 `(clientCursor,currentSequence]` 计算完整 `affectedThreadIds`。

若 cursor 早于 owner ledger、bootId 改变，或区间含无法归属但可能影响 timeline 的 visible event，服务端发送 `timeline-gap { scope: "all-tracked", bootId }`。客户端收到后立即冻结旧 delivery，并为本地 cached/visible thread 集合分别建立 bounded metadata + latest-page repair；未缓存的 thread 不主动读取。`scope: all-tracked` 是确认全局缺口的恢复语义，不等同于 ownerless 普通控制事件，也不能降级为仅修复当前页面或无限等待。

### 11. 展示派生层对齐 Codex App，并保持 normalized timeline 不变

本机 `openai.chatgpt 26.707.71524` 将完成态 reasoning item 从会话渲染单元中移除，仅在 turn 运行且没有其他可见活动时显示一个临时 `Thinking` 占位；工具活动则先分类、再在 assistant message 之间聚合为单一 disclosure。Web 采用相同的数据/展示分离原则，但针对手机视口保持更紧凑：底层 timeline engine 继续完整保存 reasoning、tool 和 source order，`Timeline` 只消费纯展示派生结果。

展示派生规则如下：

- completed reasoning 不生成可见 render block；running reasoning 只有在该 turn 没有后续可见 activity/agent 输出时生成一个不可展开的 `Thinking...` 占位，刷新后不得恢复成多条历史 `Thinking`。
- 同一 turn 内连续的 reasoning/tool/command/diff 活动形成一个顶层 disclosure。reasoning 不计入完成态摘要；其余活动按原始 entry 顺序保留。顶层使用“编辑了文件并运行了命令”这类自然动作句，并在句首显示主要动作的 Lucide 语义图标；多类别混合时使用 Wrench。不显示“N 个文件”式统计串或无语义装饰方块；失败状态在折叠态可见。
- 完成态和运行态活动默认都保持折叠。第一次展开只挂载按原顺序排列的动作行，例如“已读取 path”“已编辑 path +A -R”“已运行 command”；动作行再次点击后才挂载 stdout、diff、参数或错误详情。任一层展开均不得改变 entry 顺序；重复强 identity 的处理仍由 engine 完成，展示层不得做文本去重。
- 分类优先使用结构化 `server`、`toolKind`、`actionKind` 和 tool result。Skill 兼容识别 `skills/loaded` 以及指向 `.../skills/<name>/SKILL.md` 的 read 命令；Subagent 兼容识别 `server: sub-agent`，并以 JSON 中的 `agentThreadId`、`agentPath`、`kind` 聚合唯一代理。无法安全解析时降级为通用工具，不猜测身份。
- app-server user item 如果完整匹配 Codex 注入包装，则 normalized user text 只保留其用户数据段：ambient/附件包装必须包含已知 `<in-app-browser-context source="ambient-ui-state">` 或 `# Files mentioned by the user:` 与 `## My request for Codex:` 边界；goal continuation 必须由完整 `<codex_internal_context source="goal">...</codex_internal_context>` 包围，并且只提取其中唯一完整的 `<objective>...</objective>`。普通 XML/Markdown、缺少完整边界的文本和用户主动输入的相似内容保持原样；图片、skill 引用、clientUserMessageId 与 item identity 不变。
- timeline 不渲染逐条相对时间。时间字段仍保留在 normalized entry 中用于排序、锚点和诊断，但不占用会话视觉空间。
- user message 在 timeline 行内使用 `justify-content: flex-end` 右对齐；气泡使用内容自适应宽度、最大 `min(82%, 760px)`、浅灰背景和紧凑圆角，取消旧全宽灰带与蓝色左边条。气泡内文字左对齐，长字符串使用 `overflow-wrap: anywhere`；图片、Skill 引用、失败状态和长按菜单行为保持不变。
- EventSource client 独立记录连续重连失败次数：每次 `error` 递增，`open` 与显式关闭归零。thread 页面在 timeline 末尾显示一个不可展开的临时 Wi-Fi 活动行 `正在重新连接 N/5`，连接恢复后立即移除；其他页面复用同一轻量行但允许固定定位。旧的全宽警告色 banner 与动画省略号全部删除。

动作行使用 Lucide 的 FileText、Pencil、Terminal、Search、Folder、Bot、Wrench、Globe、Image 等线性图标；顶层复用同一语义图标体系，并用 ChevronRight/ChevronDown 表达折叠状态。stdout detail 使用低噪声命令头、状态标签和有界等宽输出；diff detail 使用紧凑文件头、增删统计、双行号及 add/remove/context 着色，并允许手机端横向滚动代码而不撑宽 timeline。

- `item/started` 与 `item/completed` 的 `contextCompaction` 必须共享 app-server item id。适配器在 started 阶段发出 `status: running` 与“正在自动压缩上下文”，在 completed 阶段发出 `status: success` 与“压缩上下文已完成”；Web 以强 identity 原位替换，不追加第二条。snapshot/rollout 中只存在完成态时保持完成文案。
- 图片附件先使用受控 preview route 解析本地路径；加载失败时隐藏浏览器破图图标并显示紧凑的可重试占位，成功后恢复真实缩略图，缩略图和弹层均不得把失败的 `<img>` 暴露给用户。
- 历史分页只保留一个 `loadOlderHistory` 协调入口。用户滚到顶部与 timeline 内容容器因折叠而缩短时均调用该入口；当 `scrollHeight <= clientHeight`、仍有 cursor 且未到会话开头时继续补一页。每次请求仍由 `{threadId, HistoryStamp, cursor}` 去重和校验且全局串行，响应提交后若仍未填满则由新的尺寸/状态变化继续驱动，直到视口可滚动或 `reachedBeginning`。prepend 前捕获首个可见消息的强 identity 与 DOM 顶部偏移；连续 activity 跨分页边界合并时使用组内最后一个既有 entry 作为稳定 DOM 锚点。提交后只按同一消息的真实位移恢复 `scrollTop`，不使用可被 SSE/图片变高污染的整页 `scrollHeight` 差；重叠强 identity 只去重而不得用历史页候选改写当前可见正文。

### 12. 从大型 rollout 的有界源窗口恢复 custom tool activity

当前真实会话的 app-server turn page 能返回 fileChange 和 MCP item，但 Codex `functions.exec` 内的 `exec_command` 不会成为原生 `commandExecution`，其 read/search/list/command 语义只存在 rollout `custom_tool_call` 的 `input` 中。对超过 1 MB 的 rollout 完全跳过 supplement 会稳定丢失这些动作。

gateway 只对 app-server 返回且通过独立策略校验的 `CODEX_HOME/sessions/**/*.jsonl` 做只读扫描；普通文件 API 的 workspace allowlist 不变。读取器从文件末端覆盖至多 64 MB 源字节和固定行数，只保留包含本次 page turn IDs 的 `response_item` 及需要的 token usage 行，匹配文本另受 16 MB 上限约束。文件超过源预算时丢弃首个可能截断的 JSONL 行，预算耗尽则失败关闭。

对 `custom_tool_call name: exec` 只运行有界静态提取器：接受直接的 `tools.exec_command({...})` 调用、JSON 字符串形式的 `cmd/workdir` 字段和稳定调用顺序；模板插值、变量间接引用、动态属性、语法不完整或超出预算均不解析。单一可证明子调用可绑定完整 output；多个子调用只有输出分段数量可一一对应时才绑定各自 stdout，否则保留命令动作而不伪造输出。没有可恢复命令的外层 `exec` 与 `wait/list_agents` 等编排项不展示；`spawn_agent/followup_task/send_message` 则清除加密 message 参数并规范化为 `server: sub-agent` 的稳定路径活动。

该 fallback 只恢复 app-server page 缺失的可见工具 item，使用父 call identity 加子调用 ordinal 生成稳定 source locator，并继续通过一对一 native/supplement 去重。它不执行 rollout 代码，不开放任意工作区外路径，不超过固定源/匹配预算，也不改变 HistoryStamp、contentRef、repair window 或 event protocol。

## Risks / Trade-offs

- [兼容旧事件时 fragmentSequence 缺失，无法证明 gap] -> 不再做文本 suppression；依赖 eventId/revision 去重，歧义时触发有界 repair，偏向显示重复而不是丢内容。
- [权威尾部替换边界实现错误可能删除合法 entry] -> 响应必须携带 stamp、watermark 和窗口边界；engine 拒绝无边界的 replace-latest-window，并为窗口内外建立组合测试。
- [bootId 改变会增加一次 repair，并可能无法证明旧缓存前缀] -> 优先使用 common-prefix anchor rebase；无法唯一证明时清空该 thread 缓存窗口并重建，这是避免跨 boot 错误合并的必要代价。
- [严格 identity 会暴露过去被文本去重掩盖的重复 source records] -> 先修正 source alias 和 supplement 一对一匹配；无法证明重复时保留，便于诊断来源问题。
- [流式 decoder 需要维护 item 级短期状态] -> completion、generation barrier、turn deletion 和连接关闭时统一释放，设置与 event backlog 一致的上限。
- [同 ID retry 的服务端幂等窗口不足或服务已重启] -> 同 boot 延长并按 thread 清理记录；跨 boot 先查询/repair，无法证明时返回 unresolved 并禁止自动再次 start。
- [owner ledger 也无法覆盖极旧 cursor 时会触发多个 thread repair] -> 使用 `all-tracked` 只修复客户端实际缓存/可见 thread，每个 thread 仍是一页有界 repair，并对同 stamp barrier 去重。
- [路径/JSON fallback 可能误分类普通工具] -> 只接受完整 `SKILL.md` 路径结构和可解析的 Subagent 字段；否则保守降级为通用工具，绝不改变底层 identity。
- [隐藏注入包装可能误删用户文本] -> 仅在完整已知 ambient/request 边界，或完整 `source="goal"` 外层与唯一 objective 同时成立时提取；普通标签、代码块和不完整 marker 通过回归测试保持原文。
- [rollout custom exec 静态提取可能误读任意 JavaScript] -> 只接受直接已知调用和 JSON 字符串字段，设置调用/字符预算；任何动态语法失败关闭为通用工具，绝不执行输入代码。
- [大型 rollout 的目标 turn 早于默认尾窗] -> 按 page turn ID 在 64 MB 源预算内过滤扫描，匹配文本再受 16 MB 上限约束；目标仍早于预算时保持 partial，不通过无界读取突破响应预算。

## Migration Plan

1. 先扩展共享类型和服务端 payload，新增 `bootId`、`streamSequence`、可选 `fragmentSequence`、HistoryStamp 与 repair window 字段；旧字段在兼容期保留。
2. 部署能同时读取新旧 payload 的客户端。旧事件没有 fragmentSequence 时禁用连续性判断；缺少 HistoryStamp 的 snapshot 只能用于首次空状态初始化，不能覆盖已有 live 状态。
3. 切换 gateway、latest-page 和 backlog 生成新字段，并启用 current file change notification 与流式字节 decoder。
4. 启用 generation-aware request coordinator、replace-latest-window 和严格 identity reducer，删除错误的文本 fallback 测试预期。
5. 通过服务重启、交错 fragment、首屏竞态、rollback、持久化延迟和 oversize fixture 后再移除旧 payload 兼容分支。

回滚时可恢复旧客户端 reducer，但服务端新增字段保持向后兼容；不得回滚 eventId 中的 boot epoch。若新 repair window 逻辑出现异常，可临时只接受新事件并提示手动刷新，不能退回无边界 replace 或全量 detail。

## Open Questions

无阻断实现的问题。实现默认 app-server 不能为所有 delta 提供原生 per-item offset，因此 gateway 只在能够从单连接接收顺序可靠合成时发送 `fragmentSequence`；否则省略该字段。实现也不假设 app-server 提供跨 gateway boot 的 client id 查询，无法证明 ambiguous start 结果时按上述策略失败关闭。
