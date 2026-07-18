## MODIFIED Requirements

### Requirement: Read Requests Are Deduplicated Or Cancelled
前端 SHALL 对同一页面生命周期内的高风险读取请求使用稳定 key 去重或取消旧请求，至少覆盖会话元数据读取、局部分页修复、历史分页、模型列表、默认设置和 pending request 恢复读取。timeline 相关读取的稳定 key MUST 包含 `threadId`、请求种类和请求发起时的 `HistoryStamp`；repair key 还 MUST 包含 reason 以及可用的目标 `turnId` / `itemId`。任何修复流程 MUST NOT 请求完整会话消息历史。每个响应提交前 MUST 同时验证其 `HistoryStamp`、页面 mutation epoch 和请求自身 token；initial read 发出后到达的 SSE/live event MUST 推进或建立等价 delivery barrier，使旧 initial、旧 metadata、旧 latest-page 或旧 history-page 响应不得覆盖实时状态。

#### Scenario: Opening a thread triggers one effective metadata read
- **WHEN** 用户打开同一个会话页面且同一 `threadId`、同一 `HistoryStamp` 的元数据读取已经进行中
- **THEN** 前端 MUST 复用进行中的读取结果，或取消旧读取并只允许最新读取结果更新页面和 store
- **AND** 元数据响应 MUST 不包含完整 timeline

#### Scenario: Stale thread read cannot overwrite newer state
- **WHEN** 旧的会话元数据或消息页读取在发送消息、局部修复、generation 变化或路由切换之后才返回
- **THEN** 前端 MUST 丢弃旧读取结果，不得覆盖更新后的 timeline、running 状态、active turn、pagination cursor 或 `HistoryStamp`

#### Scenario: Live event invalidates an older initial response
- **WHEN** initial metadata/latest-page 请求发出后，同一 thread 的 SSE/live event 已提交新的 entry、revision、active turn 或 generation
- **AND** initial 响应随后返回请求发出时的旧状态
- **THEN** 前端 MUST 基于 delivery barrier 拒绝该响应的 replace 或状态回写
- **AND** 已提交的 live entry、event ledger 和 active turn MUST 保留
- **AND** 该保护 MUST NOT 依赖用户是否同时触发本地 mutation

#### Scenario: Page repair is not amplified
- **WHEN** 多个 timeline gap 或修复信号针对同一 thread、同一 `HistoryStamp`、同一 reason 和同一目标 turn/item 的修复请求进行中到达
- **THEN** 前端 SHALL 合并为同一轮分页修复请求，直到当前请求完成或被新一代请求取代
- **AND** 不同 generation、reason 或目标身份的 repair MUST NOT 复用同一 Promise
- **AND** 修复失败 MUST NOT 触发完整 thread detail 或完整消息读取

### Requirement: Scroll Pagination Uses Cursor Level Locking
前端 SHALL 对历史分页请求按 `threadId`、`HistoryStamp` 和 `cursor` 加锁，避免滚动停留在顶部时重复拉取同一页历史；分页响应和其 `nextCursor` MUST 只提交到发起请求时的相同 generation。协议错误和服务端错误 SHALL 维持有界请求行为。

#### Scenario: Repeated top scroll while page is loading
- **WHEN** 用户停留在会话顶部且同一 `threadId`、同一 `HistoryStamp` 和同一 `cursor` 的历史分页请求尚未完成
- **THEN** 前端 MUST NOT 再次请求该历史分页

#### Scenario: Pagination failure can be retried
- **WHEN** 历史分页请求失败
- **THEN** 前端 SHALL 只释放该请求 token 对应的 `HistoryStamp` 与 `cursor` 分页锁，允许用户显式重试
- **AND** 前端 MUST NOT 自动循环请求失败页
- **AND** 前端 MUST NOT 通过全量会话读取修复失败页

#### Scenario: Old generation history page is discarded
- **WHEN** 客户端以 generation G1 和 cursor C 请求更早历史
- **AND** rollback、repair 或服务重启使当前 `HistoryStamp` 变为 G2 后，G1 的分页响应才返回
- **THEN** 客户端 MUST 丢弃 G1 的 entries 和 `nextCursor`
- **AND** G1 请求的完成或失败 MUST NOT 释放、覆盖或修改 G2 的分页锁与 cursor

#### Scenario: Authoritative null cursor clears the old cursor
- **WHEN** 当前 generation 的历史页成功返回 `nextCursor: null`
- **THEN** 前端 MUST 清除该 generation 先前保存的旧 cursor
- **AND** 页面 MUST 标记已到达历史起点，不得继续使用旧 cursor 请求同一历史页

### Requirement: Sending A Message Is Idempotent Per User Action
发送消息 SHALL 以单次用户发送动作生成的稳定 `clientUserMessageId` 或等价 operation id 作为幂等键，前端和后端 MUST 使用该键避免同一次发送动作启动多个 turn。客户端 MUST 为该动作保存 payload fingerprint、发起时 bootId 和 outcome 类型；超时、连接中断、5xx 或响应解析失败等无法证明服务端未接受请求的结果 MUST 视为 ambiguous，查询或重试时 MUST 复用原 `clientUserMessageId`。同一 boot 内后端 MUST 复用幂等记录；boot 已变化时，只有 app-server 查询或 bounded history recovery 唯一确认既有 turn 后才能恢复结果，无法证明时 MUST 返回显式 unresolved 且 MUST NOT 再次调用 `turn/start`。只有服务端明确拒绝且确认未创建 turn，或用户确认将内容作为新发送动作提交时，才 SHALL 生成新幂等键。

#### Scenario: Double tapping send starts one turn
- **WHEN** 用户对同一条待发送消息快速点击发送按钮两次
- **THEN** 前端 MUST 只调用一次 `turn/start`，并且后端 MUST 对相同 `threadId` 与 `clientUserMessageId` 的并发重复请求返回同一个 `turnId`

#### Scenario: Same text can be sent again as a new action
- **WHEN** 用户在上一轮发送完成后再次明确发送相同文本
- **THEN** 前端 SHALL 将其视为新的发送动作，生成新的幂等键，不得因为 payload 相同而永久拦截

#### Scenario: Not loaded thread resume is not duplicated
- **WHEN** 用户在 `notLoaded` 会话中发送消息且恢复请求正在进行中
- **THEN** 前端 SHALL 避免重复调用同一会话的恢复请求，并且发送流程 MUST 在有效恢复结果或已可发送状态后继续

#### Scenario: Ambiguous turn start failure reuses the original identity
- **WHEN** `turn/start` 因超时、连接断开、5xx 或响应解析失败而没有给出可证明的未接受结果
- **THEN** 失败 user entry MUST 保留原 `clientUserMessageId`、payload fingerprint 和 ambiguous outcome
- **AND** 用户对该发送动作执行重试时 MUST 复用原 `clientUserMessageId` 和未修改 payload，或先按该 identity 查询已创建 turn
- **AND** 客户端 MUST NOT 自动生成新 ID 再次启动同一发送动作

#### Scenario: Ambiguous retry after service restart fails closed
- **WHEN** ambiguous `turn/start` 记录属于旧 boot，且服务端已重启
- **AND** app-server 查询或 bounded latest-page recovery 无法唯一确认原 `clientUserMessageId` 是否已创建 turn
- **THEN** 后端 MUST 返回 `ambiguous-start-unresolved` 或等价显式结果
- **AND** MUST NOT 再次调用 app-server `turn/start`
- **AND** 前端 MUST 保留未决消息并允许用户刷新恢复，或明确确认后作为新的发送动作提交

### Requirement: Recovery requests cannot widen timeline scope
前端恢复请求 SHALL 按 metadata、latest-page、history-page 和目标 mutation 使用独立稳定 key。timeline repair key MUST 包含 `threadId`、`HistoryStamp`、reason 以及可用的目标 `turnId` / `itemId`，重试 MUST 沿用同一恢复身份和 attempt 计数。任何失败重试 MUST 保持原请求范围，MUST NOT 从有界 page 升级为 resume、完整 detail 或完整 timeline 请求。旧 generation 请求的完成、失败或 `finally` MUST 只清理其自身 token，MUST NOT 清除新 generation 的 pending repair 或 suppression 状态。

#### Scenario: Repeated repair signals during send
- **WHEN** 发送期间收到多个 `turn-completed`、`timeline-gap` 或 stream recovery signal
- **THEN** 客户端 MUST 只合并 `threadId`、`HistoryStamp`、reason 和目标身份全部相同的 metadata/latest-page 请求
- **AND** 每个有效请求 MUST 只返回有界页或 metadata
- **AND** 重试 MUST NOT 扩展为完整历史读取

#### Scenario: Stale mutation response arrives after pagination
- **WHEN** 用户已加载新的历史页后，较早的 resume、rename、steer 或 review 响应才返回
- **THEN** 该响应 MUST NOT replace、清空或扩展当前 timeline 窗口

#### Scenario: Old repair completion cannot clear a newer repair
- **WHEN** generation G1 的 repair 仍在进行时，当前 thread 进入 G2 并为同一 reason 建立新的 repair token
- **AND** G1 请求随后成功、失败或进入 `finally`
- **THEN** G1 生命周期 MUST 只清理 G1 自己持有的 token
- **AND** G2 repair MUST 保持 pending 并能够独立提交或重试

### Requirement: Completion repair retries are bounded and deduplicated
同一 `threadId`、目标 `turnId`、`HistoryStamp` 和 completion reason 的 completion repair SHALL 只有一个 pending 请求与一个重试计时器，MUST 设置固定最大尝试次数。retry token MUST 保存原始 turn、generation、reason 和 attempt；持久化延迟或瞬时失败后的下一次尝试 MUST 复用该完整身份，不得降级为无目标的通用 latest-page repair。只有目标 turn 已出现非 user 可见输出或达到最大尝试次数时，repair 生命周期才 SHALL 结束；单次 latest page 未出现输出 MUST NOT 被视为权威空结果而提前结束。

#### Scenario: Duplicate completion signals
- **WHEN** 同一 turn 的 completion event、summary idle 和 startTurn fast completion 同时请求 repair
- **THEN** 客户端 MUST 合并为同一 repair 生命周期
- **AND** 每次尝试 MUST 只读取 metadata 和一页 latest items

#### Scenario: Persistence lag keeps the original completion identity
- **WHEN** 目标 turn 完成后的第一次 latest-page repair 仍只包含 user item，尚未包含 assistant、reasoning、tool、diff 或 error 输出
- **THEN** 客户端 MUST 在有界延迟后重试
- **AND** 重试 MUST 继续使用相同 `threadId`、目标 `turnId`、`HistoryStamp` 和 completion reason，仅递增 attempt
- **AND** 输出持久化并被权威 latest page 或同 generation live overlay 确认后，客户端 MUST 结束该 repair 生命周期

#### Scenario: Generation change supersedes completion retry
- **WHEN** completion repair 的重试计时器属于 generation G1
- **AND** 当前 thread 在计时器触发前进入 generation G2
- **THEN** G1 计时器 MUST NOT 发起或提交到 G2
- **AND** G1 的取消或完成 MUST NOT 清除 G2 针对同一 turn 或其他目标建立的 repair token
