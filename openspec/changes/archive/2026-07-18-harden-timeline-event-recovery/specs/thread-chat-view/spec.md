## MODIFIED Requirements

### Requirement: 离开后回到同一会话使用内存缓存
应用 SHALL 在用户离开某个会话切到其他页时，在内存中保留该会话已加载的 timeline 及其 `HistoryStamp`；重新进入时 SHALL 直接渲染缓存内容，并在后台连接 timeline event stream。系统 MUST NOT 为了首屏显示缓存而先重新拉取 turns 列表；当事件流断线、补发失败、检测到事件缺口或服务端 boot 改变时，系统 SHALL 在缓存已显示后执行必要的 metadata + bounded latest-page repair。repair MUST 只权威替换响应声明的未知最新尾部，并保留该窗口之前已加载的更旧分页历史。

#### Scenario: 缓存命中
- **WHEN** 用户先后进入会话 A、列表页、再次进入会话 A
- **THEN** 第二次进入 A 时 MUST 立刻渲染上一次的 timeline 缓存
- **AND** MUST 不为了首屏显示重新拉取 turns 列表
- **AND** MUST 在后台连接 timeline event stream

#### Scenario: 缓存不持久化
- **WHEN** 浏览器页面被刷新或关闭
- **THEN** 内存缓存 MUST 丢失
- **AND** 下次进入 MUST 重新读取 metadata 和有界最新一页 turns

#### Scenario: 缓存显示后的修复读取
- **WHEN** 缓存 timeline 已显示
- **AND** 事件流断线、重连补发失败、检测到事件缺口或服务端 `bootId` 改变
- **THEN** 页面 MUST 执行一次 metadata + bounded latest-page repair
- **AND** repair 结果 MUST 以响应携带的 `HistoryStamp` 和权威窗口边界替换未知最新尾部
- **AND** repair 结果中已经不存在的窗口内旧尾部 entries MUST 被删除
- **AND** repair 窗口之前已加载的更旧历史页 MUST 保留

### Requirement: Running chat view uses event stream instead of full-timeline polling
会话聊天页 SHALL 在 metadata + bounded latest-page 首屏基线后使用 timeline event stream 更新 running thread。页面 MUST NOT 在事件流正常时以固定短间隔轮询 `/api/codex/threads/:threadId` 获取完整 timeline。页面 MAY 低频轮询不含 timeline 的轻量 summary 以发现 running thread 已变 idle；发现 idle 或收到完成事件后 SHALL 只触发一次 generation-scoped bounded latest-page repair 做最终 reconcile。repair SHALL 只作为确认缺口、完成后 reconcile 或明确异常窗口的有界恢复手段；一次 repair 返回 active 状态本身 MUST NOT 安排下一次完整或 latest-page repair。每个 initial、event 和 repair 输入 MUST 携带或绑定 `HistoryStamp`，旧 stamp 输入不得提交到当前 timeline。

#### Scenario: Initial snapshot then event stream
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MAY 读取一次不含 turns 的 metadata 和一页 bounded latest items 建立初始 timeline
- **AND** running 状态下后续新增输出 MUST 通过 timeline event stream 更新

#### Scenario: No two-second full timeline polling
- **WHEN** thread 处于 running 状态且事件流连接正常
- **THEN** 页面 MUST NOT 每 2 秒或其他固定短周期调用 `/api/codex/threads/:threadId` 拉取完整 thread detail
- **AND** timeline 增量 MUST 由事件流驱动
- **AND** 页面 MAY 轮询轻量 summary endpoint，但该轮询 MUST NOT 携带完整 timeline

#### Scenario: Repair read only after stream gap, completion, or explicit missing-output recovery
- **WHEN** 事件流断线、重连补发失败、检测到事件缺口、当前 active turn 完成，或压缩上下文完成
- **THEN** 页面 MAY 读取一次 metadata 和 bounded latest page 执行 generation-scoped repair
- **AND** repair 完成后 MUST 回到事件流主路径
- **AND** repair 结果仍为 active MUST NOT 仅因此重新安排下一次完整或 latest-page repair

#### Scenario: Summary polling triggers one final reconcile
- **WHEN** 页面正在显示 running thread
- **AND** 轻量 summary endpoint 返回该 thread 已变为空闲
- **THEN** 页面 MUST 停止该轮询并触发一次 bounded latest-page repair
- **AND** MUST NOT 在 running 期间通过 summary 轮询拉取完整 timeline

#### Scenario: Active repair result does not loop
- **WHEN** 页面因已确认的 repair 标记读取 bounded latest page
- **AND** repair 返回的 thread 仍处于 running 状态
- **THEN** 页面 MUST 在 `HistoryStamp`、request token 和 mutation/delivery barrier 均仍有效时应用该 repair，并只清除本次 repair 标记
- **AND** 页面 MUST NOT 因该 active 结果自动启动新的短周期 repair timer

#### Scenario: Send fallback is one-shot when no visible output arrives
- **WHEN** 用户发送消息后 `startTurn` 没有返回可用 thread snapshot
- **AND** 当前 turn 在短暂等待窗口内没有任何可见服务端输出
- **THEN** 页面 MAY 为该 `turnId` 和当前 `HistoryStamp` 发起一次 bounded latest-page repair 恢复缺失输出或状态
- **AND** 该 repair 成功应用后 MUST NOT 因 thread 仍 active 而继续重复完整或 latest-page repair

#### Scenario: Visible live output cancels missing-output fallback
- **WHEN** 用户发送消息后页面已为当前 turn 收到 agent、reasoning、tool、command、diff 或 error 等可见服务端输出
- **THEN** 页面 MUST NOT 再因该 turn 的 missing-output fallback 调用 timeline repair API
- **AND** 后续输出 MUST 继续由 timeline event stream 更新

### Requirement: Snapshot repair replaces unknown tail
会话聊天页在事件缺口、rollback 或 fork rollback 后执行 snapshot repair 时，repair 响应 SHALL 携带 `HistoryStamp`、权威 latest-window 边界、page watermark、`nextCursor` 和 completeness，并以 `replace-latest-window` 语义提交。客户端 MUST 只删除当前 stamp 下、落在声明窗口内且无法由权威 page 或同 generation runtime live overlay 确认的旧 local entries、旧 live entries 和旧 pending placeholders；窗口之前已加载的更旧 history pages MUST 保留。缺少 stamp 或权威窗口边界的响应 MUST NOT 执行尾部 replace。

#### Scenario: Repair after stream gap
- **WHEN** timeline event stream 报告 gap
- **AND** 页面获取带当前 `HistoryStamp` 和明确 latest-window 边界的 bounded repair page
- **THEN** 页面 MUST 用 repair page 及同 generation runtime live overlay 建立该窗口的新基线
- **AND** repair 窗口内无法被 page 或 overlay 确认的旧尾部 entries MUST 不再显示

#### Scenario: Repair preserves loaded older pages
- **WHEN** 用户已经加载一个或多个早于 latest window 的历史页
- **AND** gap repair 权威替换最新窗口
- **THEN** 页面 MUST 保留权威窗口边界之前的已加载 entries 及其相对顺序
- **AND** 页面 MUST NOT 用 latest page replace 整个 progressive timeline window

#### Scenario: Runtime overlay protects persistence-lag output
- **WHEN** 某个 live item 已在当前 generation 到达，但持久化 latest page 尚未包含该 item
- **AND** 服务端 repair page 的 runtime live overlay 仍确认该 identity
- **THEN** `replace-latest-window` MUST 保留并合并该 live item
- **AND** 客户端 MUST NOT 因持久化延迟把它当作 stale tail 删除

#### Scenario: Repair cursor is authoritative for its generation
- **WHEN** 当前 generation 的 repair page 成功应用并返回新的 `nextCursor`
- **THEN** 页面 MUST 将该 cursor 作为修复后历史窗口的分页边界
- **AND** `nextCursor: null` MUST 清除同 generation 的旧 cursor
- **AND** 其他 generation 的 cursor MUST NOT 被复用

### Requirement: Initial snapshot cannot overwrite post-send local state
会话页在显示 cached timeline 且首屏 metadata/latest-page 读取仍未完成时 SHALL 允许用户发送消息；但发送后，发送前启动的旧 initial 响应 MUST NOT 以 replace 方式覆盖 optimistic user message、已到达 live delta 或已绑定的新 turn metadata。即使没有本地 mutation，只要 initial 请求发出后有 SSE/live 输入提交了更新，页面也 MUST 通过 `HistoryStamp`、request token 和 delivery barrier 阻止旧 initial 响应回退状态。

#### Scenario: Cached send races initial read
- **WHEN** 页面使用 cached timeline 显示 idle thread
- **AND** initial metadata/latest-page 请求仍在进行
- **AND** 用户发送新消息并收到 `turn/start` 返回
- **AND** initial 响应随后返回发送前的旧 snapshot
- **THEN** 客户端 MUST 忽略该旧响应的 replace 和状态回写
- **AND** timeline MUST 保留新 user message 和已到达的 live 输出

#### Scenario: SSE update races initial read without a local mutation
- **WHEN** initial latest-page 请求仍在进行
- **AND** 同一 thread 的 SSE event 已提交新的 agent、reasoning、tool、diff、error 或 turn 状态
- **AND** initial page 随后返回不包含该实时更新的旧窗口
- **THEN** 客户端 MUST 拒绝该旧 initial page 覆盖当前尾部
- **AND** 已提交 event 的 ledger、revision、active turn 和可见内容 MUST 保留
- **AND** 页面 MUST NOT 因没有发生 send、rewind 或 fork 就跳过该 barrier

#### Scenario: Old generation initial response is rejected
- **WHEN** initial 请求捕获的 `HistoryStamp` 为 G1
- **AND** rollback、repair barrier 或服务重启已使当前 stamp 变为 G2
- **THEN** G1 响应 MUST NOT 更新 timeline、cursor、running 状态或 active turn
- **AND** 页面 MUST 使用 G2 的 metadata/latest page 或事件流建立当前基线

### Requirement: Repair replace is serialized with local mutations
snapshot repair、rollback replace、fork initialization、本地 send mutation 和 SSE/live 提交 SHALL 通过 thread-local mutation/delivery epoch、`HistoryStamp` 与 request token 串行化。旧请求完成后 MUST NOT 回退较新的本地或实时 timeline 状态；旧 generation 请求的清理 MUST NOT 清除新 generation 的 repair 标记。

#### Scenario: Repair finishes after a new send
- **WHEN** 客户端因 gap 发起 snapshot repair
- **AND** 用户随后基于当前可用输入发送新消息
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 掉新发送的 optimistic entry
- **AND** 后续 timeline MUST 以新 turn 的事件流为准

#### Scenario: Repair finishes after a live delivery
- **WHEN** 客户端发起 latest-page repair
- **AND** repair pending 期间同一 thread 的 SSE/live event 已提交更新并推进 delivery barrier
- **AND** repair 响应没有通过同 generation overlay 或 watermark 覆盖该更新
- **THEN** 客户端 MUST NOT 用该响应删除或回退已提交 live entry
- **AND** repair 需求 MUST 保留或以当前 barrier 重新排队

### Requirement: 分页 timeline 顺序跨页面稳定
历史分页和首屏窗口返回的 turns SHALL 在前端合并后保持全局时间顺序和稳定 turn 身份。每个页面和 opaque cursor MUST 绑定同一 `HistoryStamp`；分页适配层 MUST NOT 使用仅在单页内有效的 `turnIndex` 破坏跨页排序、rewind 或 fork 计算。旧 generation 的 page、cursor 或请求完成回调 MUST NOT 修改当前窗口。

#### Scenario: 多页历史合并
- **WHEN** 首屏已加载最近 turns
- **AND** 用户使用当前 `HistoryStamp` 的 cursor 继续向上加载更早一页 turns
- **THEN** 合并后的 timeline MUST 按真实会话顺序排列
- **AND** 每个 entry 的 `turnId` MUST 保持可用于 rewind/fork 计算

#### Scenario: 页面内 turnIndex 重复
- **WHEN** 不同分页返回的 entries 存在重复或页内重置的 `turnIndex`
- **THEN** 前端 MUST 使用更可靠的 turn order 或插入顺序合并
- **AND** MUST NOT 因 `turnIndex` 重复把新旧 turns 排错

#### Scenario: Rollback invalidates an in-flight older page
- **WHEN** generation G1 的历史页请求仍在进行
- **AND** rollback 或 fork rollback 使 thread 进入 generation G2 并建立新的 latest-window 基线
- **THEN** G1 page MUST 被丢弃，不得 prepend 到 G2 timeline
- **AND** G1 的 `nextCursor` MUST NOT 覆盖 G2 cursor

#### Scenario: Cursor belongs to exactly one generation
- **WHEN** 页面持有 generation G1 的 opaque history cursor
- **AND** 当前 `HistoryStamp` 已变为 G2
- **THEN** 页面 MUST NOT 使用 G1 cursor 请求或合并 G2 history
- **AND** 页面 MUST 从 G2 权威 latest page 提供的 cursor 继续分页，或在 cursor 为空时停止

#### Scenario: Prepend keeps the visible message anchored
- **WHEN** 用户上滚触发历史分页，或活动折叠后内容不足一屏而自动补页
- **AND** 更早 entries 被 prepend 到当前 timeline
- **THEN** 补页前首个可见 entry MUST 在补页后保持相同屏幕位置
- **AND** 页面 MUST NOT 因新增内容高度产生可见跳动

#### Scenario: Overlapping history cannot rewrite visible content
- **WHEN** 历史页与当前窗口包含同一强 identity 的 entry
- **AND** 历史页候选正文比当前可见正文更长、更新或完整度不同
- **THEN** pagination merge MUST 只去重该重叠项，不得改写当前窗口中的正文、详情展开状态或显示高度
- **AND** 正文完整性提升 MUST 仅由 live、detail 或权威 repair 路径提交

### Requirement: Completed reply appears without refresh
用户发送消息后，最终 assistant/tool 输出 SHALL 通过 live event 或绑定目标 turn 与 `HistoryStamp` 的有界 completion repair 自动出现在当前页面，MUST NOT 要求用户刷新。completion repair 的持久化延迟重试 MUST 保留原 `threadId`、`turnId`、generation 和 reason；同 generation runtime live overlay SHALL 参与 latest-page 权威结果，避免已到达输出被尚未持久化的 page 删除。

#### Scenario: Persistence lags turn completion
- **WHEN** turn 完成后的第一次 latest-page repair 只包含 user item
- **THEN** 客户端 MUST 使用相同 `threadId`、目标 `turnId`、`HistoryStamp` 和 completion reason 延迟重试有界 latest-page repair
- **AND** 重试 MUST NOT 降级为无目标的通用 repair 或完整 timeline 读取
- **AND** assistant item 持久化或被同 generation runtime live overlay 确认后 MUST 自动合并到当前 timeline

#### Scenario: Old completion retry cannot affect a new generation
- **WHEN** completion repair 为 generation G1 安排了重试
- **AND** 当前 thread 在重试触发前进入 generation G2
- **THEN** G1 retry MUST 被丢弃或仅完成自身清理
- **AND** MUST NOT 删除 G2 输出、覆盖 G2 cursor 或清除 G2 repair 标记
